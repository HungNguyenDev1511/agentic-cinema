import os
from pathlib import Path
import sys

from dotenv import load_dotenv
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters


MODEL = "gemini-2.5-flash"


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

# Khi chạy local:
# F:\Projects\agentic-cinema\apps\agent-service\production_pipeline\agent.py
# .env nằm tại:
# F:\Projects\agentic-cinema\.env

current_file = Path(__file__).resolve()

env_candidates = [
    Path.cwd() / ".env",
    current_file.parent.parent / ".env",
]

# Chỉ thêm project root nếu cấu trúc thư mục đủ sâu.
if len(current_file.parents) > 3:
    env_candidates.append(
        current_file.parents[3] / ".env"
    )

for env_file in env_candidates:
    if env_file.exists():
        load_dotenv(
            dotenv_path=env_file,
            override=False,
        )
        break


# ============================================================
# CLICKHOUSE MCP
# ============================================================

def build_clickhouse_toolset() -> MCPToolset:
    required = [
        "CLICKHOUSE_HOST",
        "CLICKHOUSE_PASSWORD",
    ]

    missing = [
        key
        for key in required
        if not os.getenv(key)
    ]

    if missing:
        raise RuntimeError(
            "Missing ClickHouse environment variables: "
            + ", ".join(missing)
        )

    env = os.environ.copy()

    env.update(
        {
            "CLICKHOUSE_HOST": os.environ["CLICKHOUSE_HOST"],
            "CLICKHOUSE_PORT": os.getenv("CLICKHOUSE_PORT", "8443"),
            "CLICKHOUSE_USER": os.getenv("CLICKHOUSE_USER", "default"),
            "CLICKHOUSE_PASSWORD": os.environ["CLICKHOUSE_PASSWORD"],
            "CLICKHOUSE_SECURE": "true",
            "CLICKHOUSE_VERIFY": "true",
            "CLICKHOUSE_CONNECT_TIMEOUT": "30",
            "CLICKHOUSE_SEND_RECEIVE_TIMEOUT": "30",
        }
    )

    return MCPToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[
                    "-m",
                    "mcp_clickhouse.main",
                ],
                env=env,
            ),
            timeout=30,
        ),
    )

clickhouse_tools = build_clickhouse_toolset()

script_agent = LlmAgent(
    name="script_agent",
    model=MODEL,
    description=(
        "Extracts structured facts from screenplay and production notes."
    ),
    instruction="""
You are the Script Agent in an AI film production crew.

Your ONLY task is to normalize production material.

Extract:
- production name
- scene numbers
- story order
- characters
- props
- wardrobe
- locations
- important state-changing events

Do not identify continuity problems.
Do not estimate costs.
Do not recommend corrective actions.

Return concise JSON only:

{
  "production_name": "...",
  "scenes": [
    {
      "scene_number": 1,
      "characters": [],
      "props": [],
      "wardrobe": [],
      "location": "...",
      "events": []
    }
  ]
}
""",
    output_key="script_breakdown",
)


continuity_agent = LlmAgent(
    name="continuity_agent",
    model=MODEL,
    description=(
        "Detects continuity conflicts from structured screenplay state."
    ),
    instruction="""
You are the Continuity Agent.

The Script Agent produced:

{script_breakdown}

Analyze continuity only.

Check:
- props disappearing, reappearing, breaking or changing incorrectly
- wardrobe inconsistencies
- character-state inconsistencies
- location inconsistencies
- lighting/time inconsistencies
- timeline contradictions

Do not invent issues.

Return JSON only:

{
  "production_name": "...",
  "issues": [
    {
      "scene_number": 9,
      "category": "PROP",
      "severity": "HIGH",
      "title": "...",
      "expected_state": "...",
      "observed_state": "...",
      "confidence": 0.95,
      "evidence": [
        {
          "source": "...",
          "detail": "..."
        }
      ]
    }
  ]
}
""",
    output_key="continuity_analysis",
)


history_agent = LlmAgent(
    name="history_agent",
    model=MODEL,
    description="Uses ClickHouse production memory to find similar historical incidents.",
    tools=[clickhouse_tools],
    instruction="""
You are the Production Memory Agent.

Current continuity analysis:

{continuity_analysis}

You MUST use the ClickHouse MCP tool before answering.

Use the following production memory tables as the PRIMARY source:

production_runs
- run_id
- production_name
- continuity_score
- status
- producer_decision
- producer_priority
- executive_summary
- historical_signal
- similar_cases
- started_at
- completed_at
- created_at

production_run_issues
- run_id
- production_name
- scene_number
- category
- severity
- title
- expected_state
- observed_state
- confidence
- created_at

Your task:

1. Use ClickHouse MCP to query historical runs and issues.
2. Join production_runs and production_run_issues by run_id.
3. Search for historical issues semantically relevant to the current continuity issue.
4. Prefer matches with:
   - same category
   - same object or prop
   - similar state transition
   - similar severity
   - similar producer decision
5. Never invent rows.
6. Never simulate MCP.
7. Only use actual ClickHouse results.
8. Deduplicate results.
9. Return at most 5 historical cases.

For the current black-radio example, a useful query pattern is:

SELECT
    r.run_id,
    r.production_name,
    r.continuity_score,
    r.status,
    r.producer_decision,
    r.producer_priority,
    r.executive_summary,
    r.created_at,
    i.scene_number,
    i.category,
    i.severity,
    i.title,
    i.expected_state,
    i.observed_state,
    i.confidence
FROM production_runs r
INNER JOIN production_run_issues i
    ON r.run_id = i.run_id
WHERE
    positionCaseInsensitive(i.title, 'radio') > 0
    OR positionCaseInsensitive(i.expected_state, 'radio') > 0
    OR positionCaseInsensitive(i.observed_state, 'radio') > 0
    OR positionCaseInsensitive(i.title, 'prop') > 0
ORDER BY r.created_at DESC
LIMIT 20

After receiving ACTUAL ClickHouse rows, rank them by relevance to the current issue.

Return JSON only:

{
  "similar_cases": 0,
  "historical_context": [
    {
      "run_id": "...",
      "production_name": "...",
      "continuity_score": 0,
      "status": "...",
      "producer_decision": "...",
      "scene_number": 0,
      "category": "...",
      "severity": "...",
      "title": "...",
      "expected_state": "...",
      "observed_state": "...",
      "confidence": 0
    }
  ],
  "historical_signal": "LOW | MEDIUM | HIGH",
  "insight": "...",
  "data_quality_note": "...",
  "mcp_verified": true
}
""",
    output_key="historical_context",
)


producer_agent = LlmAgent(
    name="producer_agent",
    model=MODEL,
    description=(
        "Combines current continuity evidence with historical production memory "
        "to make an executive decision."
    ),
    instruction="""
You are the Producer Agent.

Script breakdown:

{script_breakdown}

Current continuity findings:

{continuity_analysis}

Production memory from ClickHouse:

{historical_context}

Make the final production decision.

Do not rediscover the issue.
Use both current evidence and historical context.

Return JSON only:

{
  "executive_summary": "...",
  "decision": "NO_ACTION | REVIEW | FIX_IN_POST | RESHOOT",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "reason": "...",
  "historical_basis": "...",
  "recommended_plan": "...",
  "next_action": "..."
}
""",
    output_key="producer_decision",
)


root_agent = SequentialAgent(
    name="production_pipeline",
    description=(
        "Coordinates specialist AI agents for film production continuity."
    ),
    sub_agents=[
        script_agent,
        continuity_agent,
        history_agent,
        producer_agent,
    ],
)