import os

import clickhouse_connect
from dotenv import load_dotenv

from continuity_agent.schemas import ProductionAnalysis

load_dotenv()


class ClickHouseService:
    def __init__(self):
        self.client = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST"),
            port=int(os.getenv("CLICKHOUSE_PORT")),
            username=os.getenv("CLICKHOUSE_USER"),
            password=os.getenv("CLICKHOUSE_PASSWORD"),
            database=os.getenv("CLICKHOUSE_DATABASE"),
            secure=True,
        )

    def save_analysis(self, analysis: ProductionAnalysis):
        self.client.insert(
            "production_analysis",
            [[
                analysis.production_name,
                analysis.continuity_score,
                analysis.status,
                analysis.summary,
            ]],
            column_names=[
                "production_name",
                "continuity_score",
                "status",
                "summary",
            ],
        )

    def list_analysis(self):
        return self.client.query(
            """
            SELECT
                production_name,
                continuity_score,
                status,
                summary,
                created_at
            FROM production_analysis
            ORDER BY created_at DESC
            """
        ).result_rows