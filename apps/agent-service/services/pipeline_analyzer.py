import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import clickhouse_connect
from dotenv import load_dotenv
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from production_pipeline.agent import root_agent


load_dotenv(override=False)


class ProductionPipelineAnalyzer:
    APP_NAME = "production_pipeline"
    USER_ID = "production-user"

    AGENT_NAMES = {
        "script_agent",
        "continuity_agent",
        "history_agent",
        "producer_agent",
    }

    def __init__(self) -> None:
        required_variables = [
            "GOOGLE_GENAI_USE_VERTEXAI",
            "GOOGLE_CLOUD_PROJECT",
            "GOOGLE_CLOUD_LOCATION",
        ]

        missing = [
            name
            for name in required_variables
            if not os.getenv(name)
        ]

        if missing:
            raise RuntimeError(
                "Missing required environment variables: "
                + ", ".join(missing)
            )

        self.session_service = InMemorySessionService()

        self.runner = Runner(
            agent=root_agent,
            app_name=self.APP_NAME,
            session_service=self.session_service,
        )

        self.clickhouse_client = self._build_clickhouse_client()

        if self.clickhouse_client is not None:
            self._ensure_memory_tables()

    # =====================================================
    # CLICKHOUSE MEMORY
    # =====================================================

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc).replace(tzinfo=None)

    def _build_clickhouse_client(self):
        required = [
            "CLICKHOUSE_HOST",
            "CLICKHOUSE_PASSWORD",
        ]

        missing = [
            name
            for name in required
            if not os.getenv(name)
        ]

        if missing:
            print(
                "Production memory write-back disabled. "
                "Missing ClickHouse environment variables: "
                + ", ".join(missing)
            )
            return None

        try:
            return clickhouse_connect.get_client(
                host=os.environ["CLICKHOUSE_HOST"],
                port=int(
                    os.getenv(
                        "CLICKHOUSE_PORT",
                        "8443",
                    )
                ),
                username=os.getenv(
                    "CLICKHOUSE_USER",
                    "default",
                ),
                password=os.environ["CLICKHOUSE_PASSWORD"],
                database=os.getenv(
                    "CLICKHOUSE_DATABASE",
                    "default",
                ),
                secure=True,
            )
        except Exception as exc:
            print(
                "Production memory write-back disabled. "
                f"Unable to connect to ClickHouse: {exc}"
            )
            return None

    def _ensure_memory_tables(self) -> None:
        if self.clickhouse_client is None:
            return

        try:
            self.clickhouse_client.command(
                """
                CREATE TABLE IF NOT EXISTS production_runs
                (
                    run_id UUID,
                    production_name String,
                    status String,
                    continuity_score UInt8,
                    producer_decision String,
                    producer_priority String,
                    executive_summary String,
                    historical_signal String,
                    similar_cases UInt16,
                    started_at DateTime,
                    completed_at DateTime,
                    created_at DateTime DEFAULT now()
                )
                ENGINE = MergeTree
                ORDER BY (
                    production_name,
                    created_at,
                    run_id
                )
                """
            )

            self.clickhouse_client.command(
                """
                CREATE TABLE IF NOT EXISTS production_run_issues
                (
                    run_id UUID,
                    production_name String,
                    scene_number UInt32,
                    category String,
                    severity String,
                    title String,
                    expected_state String,
                    observed_state String,
                    confidence Float32,
                    created_at DateTime DEFAULT now()
                )
                ENGINE = MergeTree
                ORDER BY (
                    production_name,
                    run_id,
                    scene_number
                )
                """
            )

            self.clickhouse_client.command(
                """
                CREATE TABLE IF NOT EXISTS production_agent_events
                (
                    run_id UUID,
                    agent_name String,
                    event_type String,
                    message String,
                    output_json String,
                    event_time DateTime DEFAULT now()
                )
                ENGINE = MergeTree
                ORDER BY (
                    run_id,
                    event_time,
                    agent_name
                )
                """
            )

        except Exception as exc:
            print(
                "Unable to ensure production memory tables: "
                f"{exc}"
            )

    def _save_agent_event(
        self,
        run_id: uuid.UUID,
        agent_name: str,
        event_type: str,
        message: str,
        output: Any = None,
    ) -> None:
        if self.clickhouse_client is None:
            return

        try:
            output_json = ""

            if output is not None:
                output_json = json.dumps(
                    output,
                    ensure_ascii=False,
                    default=str,
                )

            self.clickhouse_client.insert(
                "production_agent_events",
                [[
                    run_id,
                    agent_name,
                    event_type,
                    message,
                    output_json,
                    self._utc_now(),
                ]],
                column_names=[
                    "run_id",
                    "agent_name",
                    "event_type",
                    "message",
                    "output_json",
                    "event_time",
                ],
            )
        except Exception as exc:
            print(
                f"Unable to save agent event "
                f"[{agent_name}/{event_type}]: {exc}"
            )

    def _save_continuity_issues(
        self,
        run_id: uuid.UUID,
        continuity_result: Any,
    ) -> None:
        if self.clickhouse_client is None:
            return

        if not isinstance(
            continuity_result,
            dict,
        ):
            return

        production_name = str(
            continuity_result.get(
                "production_name",
                "Unknown",
            )
        )

        issues = continuity_result.get(
            "issues",
            [],
        )

        if not isinstance(issues, list):
            return

        rows: list[list[Any]] = []

        for issue in issues:
            if not isinstance(issue, dict):
                continue

            rows.append([
                run_id,
                production_name,
                int(
                    issue.get(
                        "scene_number",
                        0,
                    )
                    or 0
                ),
                str(
                    issue.get(
                        "category",
                        "",
                    )
                    or ""
                ),
                str(
                    issue.get(
                        "severity",
                        "",
                    )
                    or ""
                ),
                str(
                    issue.get(
                        "title",
                        "",
                    )
                    or ""
                ),
                str(
                    issue.get(
                        "expected_state",
                        "",
                    )
                    or ""
                ),
                str(
                    issue.get(
                        "observed_state",
                        "",
                    )
                    or ""
                ),
                float(
                    issue.get(
                        "confidence",
                        0,
                    )
                    or 0
                ),
                self._utc_now(),
            ])

        if not rows:
            return

        try:
            self.clickhouse_client.insert(
                "production_run_issues",
                rows,
                column_names=[
                    "run_id",
                    "production_name",
                    "scene_number",
                    "category",
                    "severity",
                    "title",
                    "expected_state",
                    "observed_state",
                    "confidence",
                    "created_at",
                ],
            )
        except Exception as exc:
            print(
                "Unable to save continuity issues: "
                f"{exc}"
            )

    @staticmethod
    def _derive_score_and_status(
        continuity_result: Any,
    ) -> tuple[int, str]:
        if not isinstance(
            continuity_result,
            dict,
        ):
            return 100, "OK"

        issues = continuity_result.get(
            "issues",
            [],
        )

        if not isinstance(
            issues,
            list,
        ) or not issues:
            return 100, "OK"

        severity_rank = {
            "LOW": 1,
            "MEDIUM": 2,
            "HIGH": 3,
            "CRITICAL": 4,
        }

        highest = "LOW"
        highest_rank = 1

        for issue in issues:
            if not isinstance(issue, dict):
                continue

            severity = str(
                issue.get(
                    "severity",
                    "LOW",
                )
            ).upper()

            rank = severity_rank.get(
                severity,
                1,
            )

            if rank > highest_rank:
                highest = severity
                highest_rank = rank

        if highest == "CRITICAL":
            return 35, "CRITICAL"

        if highest == "HIGH":
            return 60, "AT_RISK"

        if highest == "MEDIUM":
            return 80, "REVIEW"

        return 90, "WATCH"

    def _save_run(
        self,
        run_id: uuid.UUID,
        continuity_result: Any,
        history_result: Any,
        producer_result: Any,
        started_at: datetime,
        completed_at: datetime,
    ) -> None:
        if self.clickhouse_client is None:
            return

        production_name = "Unknown"

        if isinstance(
            continuity_result,
            dict,
        ):
            production_name = str(
                continuity_result.get(
                    "production_name",
                    "Unknown",
                )
            )

        continuity_score, status = (
            self._derive_score_and_status(
                continuity_result
            )
        )

        producer_decision = ""
        producer_priority = ""
        executive_summary = ""

        if isinstance(
            producer_result,
            dict,
        ):
            producer_decision = str(
                producer_result.get(
                    "decision",
                    "",
                )
            )

            producer_priority = str(
                producer_result.get(
                    "priority",
                    "",
                )
            )

            executive_summary = str(
                producer_result.get(
                    "executive_summary",
                    "",
                )
            )

        historical_signal = ""
        similar_cases = 0

        if isinstance(
            history_result,
            dict,
        ):
            historical_signal = str(
                history_result.get(
                    "historical_signal",
                    "",
                )
            )

            similar_cases = int(
                history_result.get(
                    "similar_cases",
                    0,
                )
                or 0
            )

        try:
            self.clickhouse_client.insert(
                "production_runs",
                [[
                    run_id,
                    production_name,
                    status,
                    continuity_score,
                    producer_decision,
                    producer_priority,
                    executive_summary,
                    historical_signal,
                    similar_cases,
                    started_at,
                    completed_at,
                    completed_at,
                ]],
                column_names=[
                    "run_id",
                    "production_name",
                    "status",
                    "continuity_score",
                    "producer_decision",
                    "producer_priority",
                    "executive_summary",
                    "historical_signal",
                    "similar_cases",
                    "started_at",
                    "completed_at",
                    "created_at",
                ],
            )
        except Exception as exc:
            print(
                "Unable to save production run: "
                f"{exc}"
            )

    # =====================================================
    # ADK EVENT HELPERS
    # =====================================================

    @staticmethod
    def _extract_text(
        event: Any,
    ) -> str | None:
        content = getattr(
            event,
            "content",
            None,
        )

        if content is None:
            return None

        parts = getattr(
            content,
            "parts",
            None,
        )

        if not parts:
            return None

        texts: list[str] = []

        for part in parts:
            text = getattr(
                part,
                "text",
                None,
            )

            if text:
                texts.append(text)

        if not texts:
            return None

        return "\n".join(texts)

    @staticmethod
    def _try_json(
        text: str | None,
    ) -> Any:
        if not text:
            return None

        cleaned = text.strip()

        if cleaned.startswith(
            "```json"
        ):
            cleaned = cleaned[7:]

        if cleaned.startswith(
            "```"
        ):
            cleaned = cleaned[3:]

        if cleaned.endswith(
            "```"
        ):
            cleaned = cleaned[:-3]

        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except Exception:
            return cleaned

    # =====================================================
    # PIPELINE
    # =====================================================

    async def stream(
        self,
        production_text: str,
    ) -> AsyncGenerator[
        dict[str, Any],
        None,
    ]:
        prompt = production_text.strip()

        if len(prompt) < 20:
            raise ValueError(
                "Production description must contain "
                "at least 20 characters."
            )

        run_id = uuid.uuid4()
        started_at = self._utc_now()

        session = (
            await self.session_service
            .create_session(
                app_name=self.APP_NAME,
                user_id=self.USER_ID,
            )
        )

        started_agents: set[str] = set()
        completed_agents: set[str] = set()

        continuity_result: Any = None
        history_result: Any = None
        final_producer_result: Any = None

        try:
            async for event in (
                self.runner.run_async(
                    user_id=self.USER_ID,
                    session_id=session.id,
                    new_message=types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(
                                text=prompt,
                            ),
                        ],
                    ),
                )
            ):
                author = getattr(
                    event,
                    "author",
                    None,
                )

                if not author:
                    continue

                if author not in self.AGENT_NAMES:
                    continue

                if author not in started_agents:
                    started_agents.add(author)

                    message = {
                        "script_agent":
                            "Reading screenplay and extracting production facts.",

                        "continuity_agent":
                            "Comparing scene states for continuity conflicts.",

                        "history_agent":
                            "Searching production memory through ClickHouse MCP.",

                        "producer_agent":
                            "Combining current evidence with historical production context.",
                    }[author]

                    self._save_agent_event(
                        run_id=run_id,
                        agent_name=author,
                        event_type="started",
                        message=message,
                    )

                    yield {
                        "type": "agent_started",
                        "run_id": str(run_id),
                        "agent": author,
                        "message": message,
                    }

                if not event.is_final_response():
                    continue

                text = self._extract_text(
                    event
                )

                parsed = self._try_json(
                    text
                )

                if author not in completed_agents:
                    completed_agents.add(
                        author
                    )

                    summary = (
                        self._build_summary(
                            author,
                            parsed,
                        )
                    )

                    self._save_agent_event(
                        run_id=run_id,
                        agent_name=author,
                        event_type="completed",
                        message=summary,
                        output=parsed,
                    )

                    yield {
                        "type": "agent_completed",
                        "run_id": str(run_id),
                        "agent": author,
                        "message": summary,
                        "output": parsed,
                    }

                if (
                    author ==
                    "continuity_agent"
                ):
                    continuity_result = parsed

                    self._save_continuity_issues(
                        run_id=run_id,
                        continuity_result=parsed,
                    )

                elif (
                    author ==
                    "history_agent"
                ):
                    history_result = parsed

                elif (
                    author ==
                    "producer_agent"
                ):
                    final_producer_result = parsed

            completed_at = self._utc_now()

            self._save_run(
                run_id=run_id,
                continuity_result=continuity_result,
                history_result=history_result,
                producer_result=final_producer_result,
                started_at=started_at,
                completed_at=completed_at,
            )

            yield {
                "type": "pipeline_completed",
                "run_id": str(run_id),
                "producer_decision":
                    final_producer_result,
            }

        except Exception as exc:
            error_message = str(exc)

            self._save_agent_event(
                run_id=run_id,
                agent_name="orchestrator",
                event_type="failed",
                message=error_message,
                output={
                    "error": error_message,
                },
            )

            yield {
                "type": "pipeline_failed",
                "run_id": str(run_id),
                "error": error_message,
            }

    # =====================================================
    # SUMMARIES
    # =====================================================

    @staticmethod
    def _build_summary(
        agent: str,
        output: Any,
    ) -> str:
        if not isinstance(
            output,
            dict,
        ):
            return "Completed."

        if agent == "script_agent":
            scenes = output.get(
                "scenes",
                [],
            )

            characters: set[str] = set()
            props: set[str] = set()

            for scene in scenes:
                if not isinstance(
                    scene,
                    dict,
                ):
                    continue

                characters.update(
                    str(item)
                    for item in scene.get(
                        "characters",
                        [],
                    )
                )

                for item in scene.get(
                    "props",
                    [],
                ):
                    if isinstance(
                        item,
                        dict,
                    ):
                        props.add(
                            str(
                                item.get(
                                    "name",
                                    item,
                                )
                            )
                        )
                    else:
                        props.add(
                            str(item)
                        )

            return (
                f"Extracted {len(scenes)} scenes, "
                f"{len(characters)} characters and "
                f"{len(props)} props."
            )

        if agent == "continuity_agent":
            issues = output.get(
                "issues",
                [],
            )

            issue_count = len(issues)

            return (
                f"Detected {issue_count} continuity "
                f"{'issue' if issue_count == 1 else 'issues'}."
            )

        if agent == "history_agent":
            similar_cases = output.get(
                "similar_cases",
                0,
            )

            historical_signal = (
                output.get(
                    "historical_signal",
                    "UNKNOWN",
                )
            )

            return (
                f"Found {similar_cases} similar historical "
                f"{'case' if similar_cases == 1 else 'cases'}. "
                f"Historical signal: {historical_signal}."
            )

        if agent == "producer_agent":
            decision = output.get(
                "decision",
                "REVIEW",
            )

            priority = output.get(
                "priority",
                "MEDIUM",
            )

            return (
                f"Decision: {decision}. "
                f"Priority: {priority}."
            )

        return "Completed."