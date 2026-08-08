import asyncio

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from continuity_agent.schemas import ProductionAnalysis
from services.analyzer import ContinuityAnalyzer
from services.database import ClickHouseService
from services.risk_engine import RiskEngine


app = FastAPI(
    title="Agentic Cinema API",
    version="1.0.0",
)

# Không kết nối mạng khi container vừa khởi động.
analyzer = ContinuityAnalyzer()


class AnalyzeRequest(BaseModel):
    production_text: str = Field(min_length=20)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "Agentic Cinema API",
        "status": "running",
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
    # Chỉ tạo kết nối ClickHouse khi thực sự cần lưu dữ liệu.
    database = ClickHouseService()
    database.save_analysis(analysis)


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> dict:
    try:
        raw_result = await analyzer.analyze(
            request.production_text,
        )

        analysis = ProductionAnalysis.model_validate_json(
            raw_result,
        )

        risk = RiskEngine.evaluate(analysis.issues)

        analysis.continuity_score = risk["continuity_score"]
        analysis.status = risk["status"]

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