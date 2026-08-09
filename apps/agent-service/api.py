import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from continuity_agent.schemas import ProductionAnalysis
from services.analyzer import ContinuityAnalyzer
from services.database import ClickHouseService
from services.pipeline_analyzer import ProductionPipelineAnalyzer
from services.risk_engine import RiskEngine


app = FastAPI(
    title="Agentic Cinema API",
    version="2.0.0",
)

# Endpoint cũ vẫn giữ để frontend hiện tại không bị hỏng.
continuity_analyzer = ContinuityAnalyzer()

# Pipeline multi-agent mới.
pipeline_analyzer = ProductionPipelineAnalyzer()


class AnalyzeRequest(BaseModel):
    production_text: str = Field(min_length=20)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "Agentic Cinema API",
        "status": "running",
        "version": "2.0.0",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "agentic-cinema-api",
    }


def save_analysis_to_clickhouse(
    analysis: ProductionAnalysis,
) -> None:
    database = ClickHouseService()
    database.save_analysis(analysis)


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> dict:
    """
    Endpoint cũ.
    Giữ lại để web hiện tại tiếp tục hoạt động.
    """

    try:
        raw_result = await continuity_analyzer.analyze(
            request.production_text,
        )

        analysis = ProductionAnalysis.model_validate_json(
            raw_result,
        )

        risk = RiskEngine.evaluate(
            analysis.issues,
        )

        analysis.continuity_score = risk[
            "continuity_score"
        ]

        analysis.status = risk[
            "status"
        ]

        await asyncio.to_thread(
            save_analysis_to_clickhouse,
            analysis,
        )

        return analysis.model_dump()

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc


@app.post("/analyze/stream")
async def analyze_stream(
    request: AnalyzeRequest,
) -> StreamingResponse:
    """
    Multi-agent realtime endpoint.

    Frontend receives real agent lifecycle events using SSE.
    """

    async def event_generator():
        try:
            async for event in pipeline_analyzer.stream(
                request.production_text,
            ):
                payload = json.dumps(
                    event,
                    ensure_ascii=False,
                )

                yield f"data: {payload}\n\n"

        except Exception as exc:
            payload = json.dumps(
                {
                    "type": "pipeline_failed",
                    "error": str(exc),
                },
                ensure_ascii=False,
            )

            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )