from typing import Literal

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    source: str
    detail: str


class ProductionAction(BaseModel):
    action: str
    priority: Literal["LOW", "MEDIUM", "HIGH"]
    estimated_delay_hours: float = Field(ge=0)
    estimated_cost_usd: float = Field(ge=0)


class ContinuityIssue(BaseModel):
    scene_number: int
    category: Literal[
        "PROP",
        "WARDROBE",
        "CHARACTER",
        "LOCATION",
        "LIGHTING",
        "TIMELINE",
    ]
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    title: str
    expected_state: str
    observed_state: str
    confidence: float = Field(ge=0, le=1)
    evidence: list[EvidenceItem]
    recommended_action: ProductionAction


class ProductionAnalysis(BaseModel):
    production_name: str
    continuity_score: int = Field(ge=0, le=100)
    status: Literal["HEALTHY", "AT_RISK", "CRITICAL"]
    summary: str
    issues: list[ContinuityIssue]