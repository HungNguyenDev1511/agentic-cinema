import json
import os
from datetime import datetime

import clickhouse_connect


class RunMemoryService:
    def __init__(self) -> None:
        self.client = clickhouse_connect.get_client(
            host=os.environ["CLICKHOUSE_HOST"],
            port=int(os.getenv("CLICKHOUSE_PORT", "8443")),
            username=os.getenv("CLICKHOUSE_USER", "default"),
            password=os.environ["CLICKHOUSE_PASSWORD"],
            database=os.getenv("CLICKHOUSE_DATABASE", "default"),
            secure=True,
        )

    def save_agent_event(
        self,
        run_id: str,
        agent_name: str,
        event_type: str,
        message: str,
        output,
    ) -> None:
        output_json = (
            json.dumps(output, ensure_ascii=False)
            if output is not None
            else ""
        )

        self.client.insert(
            "production_agent_events",
            [[
                run_id,
                agent_name,
                event_type,
                message,
                output_json,
            ]],
            column_names=[
                "run_id",
                "agent_name",
                "event_type",
                "message",
                "output_json",
            ],
        )

    def save_issue(
        self,
        run_id: str,
        production_name: str,
        issue: dict,
    ) -> None:
        self.client.insert(
            "production_run_issues",
            [[
                run_id,
                production_name,
                int(issue.get("scene_number", 0)),
                issue.get("category", ""),
                issue.get("severity", ""),
                issue.get("title", ""),
                issue.get("expected_state", ""),
                issue.get("observed_state", ""),
                float(issue.get("confidence", 0)),
            ]],
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
            ],
        )

    def save_run(
        self,
        run_id: str,
        production_name: str,
        continuity_score: int,
        status: str,
        producer_decision: dict,
        historical_context: dict,
        started_at: datetime,
        completed_at: datetime,
    ) -> None:
        self.client.insert(
            "production_runs",
            [[
                run_id,
                production_name,
                status,
                continuity_score,
                producer_decision.get("decision", ""),
                producer_decision.get("priority", ""),
                producer_decision.get("executive_summary", ""),
                historical_context.get("historical_signal", ""),
                int(historical_context.get("similar_cases", 0)),
                started_at,
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
            ],
        )