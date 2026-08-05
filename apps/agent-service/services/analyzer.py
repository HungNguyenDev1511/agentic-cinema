from pathlib import Path

from dotenv import load_dotenv
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from continuity_agent.agent import root_agent


# analyzer.py:
# agentic-cinema/apps/agent-service/services/analyzer.py
# parents[3] points to agentic-cinema.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(ENV_FILE, override=True)


class ContinuityAnalyzer:
    APP_NAME = "continuity_agent"
    USER_ID = "demo-user"

    def __init__(self) -> None:
        self.session_service = InMemorySessionService()

        self.runner = Runner(
            agent=root_agent,
            app_name=self.APP_NAME,
            session_service=self.session_service,
        )

    async def analyze(self, prompt: str) -> str:
        normalized_prompt = prompt.strip()

        if len(normalized_prompt) < 20:
            raise ValueError(
                "The production input must contain at least 20 characters."
            )

        session = await self.session_service.create_session(
            app_name=self.APP_NAME,
            user_id=self.USER_ID,
        )

        final_response = ""

        async for event in self.runner.run_async(
            user_id=self.USER_ID,
            session_id=session.id,
            new_message=types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=normalized_prompt),
                ],
            ),
        ):
            if not event.is_final_response():
                continue

            content = getattr(event, "content", None)

            if content is None:
                continue

            parts = getattr(content, "parts", None)

            if not parts:
                continue

            for part in parts:
                text = getattr(part, "text", None)

                if text:
                    final_response = text
                    break

        if not final_response:
            raise RuntimeError(
                "The continuity agent completed without returning text."
            )

        return final_response