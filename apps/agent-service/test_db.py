from continuity_agent.schemas import ProductionAnalysis

from services.database import ClickHouseService

db = ClickHouseService()

analysis = ProductionAnalysis(
    production_name="The Last Train",
    continuity_score=82,
    status="AT_RISK",
    summary="Database test.",
    issues=[],
)

db.save_analysis(analysis)

print(db.list_analysis())