from continuity_agent.schemas import ContinuityIssue


class RiskEngine:
    SCORE_PENALTY = {
        "LOW": 5,
        "MEDIUM": 12,
        "HIGH": 25,
        "CRITICAL": 50,
    }

    COST_USD = {
        "LOW": 150,
        "MEDIUM": 500,
        "HIGH": 1_200,
        "CRITICAL": 3_000,
    }

    DELAY_HOURS = {
        "LOW": 0.5,
        "MEDIUM": 1.0,
        "HIGH": 2.0,
        "CRITICAL": 5.0,
    }

    @classmethod
    def evaluate(cls, issues: list[ContinuityIssue]) -> dict:
        score = 100
        total_cost = 0.0
        total_delay = 0.0

        for issue in issues:
            severity = issue.severity

            score -= cls.SCORE_PENALTY[severity]
            total_cost += cls.COST_USD[severity]
            total_delay += cls.DELAY_HOURS[severity]

            issue.recommended_action.estimated_cost_usd = cls.COST_USD[
                severity
            ]
            issue.recommended_action.estimated_delay_hours = cls.DELAY_HOURS[
                severity
            ]

        score = max(score, 0)

        if score >= 90:
            status = "HEALTHY"
        elif score >= 40:
            status = "AT_RISK"
        else:
            status = "CRITICAL"

        return {
            "continuity_score": score,
            "status": status,
            "estimated_cost_usd": total_cost,
            "estimated_delay_hours": total_delay,
        }