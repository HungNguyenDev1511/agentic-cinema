import asyncio
import json

from continuity_agent.schemas import ProductionAnalysis
from services.analyzer import ContinuityAnalyzer
from services.risk_engine import RiskEngine


PROMPT = """
Production name: Broken Signal

Scene 4:
Lena enters carrying a black radio.

Scene 6:
The radio is destroyed.

Scene 9:
Production footage still shows Lena carrying the same radio.

Analyze the production continuity.
"""


async def main() -> None:
    analyzer = ContinuityAnalyzer()

    raw_result = await analyzer.analyze(PROMPT)

    analysis = ProductionAnalysis.model_validate_json(raw_result)

    risk = RiskEngine.evaluate(analysis.issues)

    analysis.continuity_score = risk["continuity_score"]
    analysis.status = risk["status"]

    print(
        json.dumps(
            analysis.model_dump(),
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())