import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from continuity_agent.schemas import ProductionAnalysis
from services.analyzer import ContinuityAnalyzer
from services.risk_engine import RiskEngine


app = FastAPI(
    title="Agentic Cinema API",
    version="0.1.0",
)

analyzer = ContinuityAnalyzer()


class AnalyzeRequest(BaseModel):
    production_text: str


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> dict:
    try:
        raw_result = await analyzer.analyze(request.production_text)

        analysis = ProductionAnalysis.model_validate_json(raw_result)

        risk = RiskEngine.evaluate(analysis.issues)

        analysis.continuity_score = risk["continuity_score"]
        analysis.status = risk["status"]

        return analysis.model_dump()

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc