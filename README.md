🎬 Agentic Cinema

Agentic Cinema is an AI-powered production intelligence system that uses a specialized multi-agent workflow to detect production continuity problems, retrieve historical production knowledge, and support production decisions.

Instead of relying on a single AI response, Agentic Cinema orchestrates multiple specialized agents using Google ADK and Gemini, while ClickHouse provides persistent production memory through MCP.

🎯 The Problem

Film and video productions generate large amounts of fragmented information across scripts, scenes, props, characters, wardrobe, and production history.

Continuity mistakes can easily survive into production.

For example:

A prop is destroyed in Scene 6.

The same prop appears intact in Scene 9.

The inconsistency may not be discovered until editing or post-production.

Fixing it later may require expensive VFX work or a reshoot.

Agentic Cinema turns this problem into an automated production intelligence workflow.

💡 The Solution

A user submits production or screenplay context through the Agentic Cinema interface.

The system then launches a specialized AI production crew.

1. Script Agent

Extracts structured production facts such as:

scenes

characters

props

wardrobe

locations

story events

2. Continuity Agent

Compares production states across the story timeline and identifies contradictions.

Example:

Scene 6: The black radio is destroyed.Scene 9: Lena carries the black radio intact.

The system identifies this as a high-confidence prop continuity issue.

3. Production Memory Agent

Searches historical production intelligence stored in ClickHouse through an MCP server.

It retrieves similar historical incidents and provides production precedent for the current issue.

4. Producer Agent

Combines:

current screenplay evidence

continuity findings

confidence and severity

historical production memory

and produces an actionable production decision such as:

REVIEW

FIX_IN_POST

RESHOOT

along with priority, reasoning, recommended actions, and next steps.

🧠 Production Memory

Agentic Cinema does more than analyze one request.

Every production analysis can become reusable production memory.

Historical cases stored in ClickHouse can later be retrieved by the Production Memory Agent to support future decisions.

This creates a feedback loop:

Production Input
      ↓
Multi-Agent Analysis
      ↓
Production Decision
      ↓
Persistent Production Memory
      ↓
Future Production Analysis

The system therefore becomes more useful as production history accumulates.

🏗️ Architecture

                         ┌─────────────────────┐
                         │        USER         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Next.js Web UI    │
                         │   Agentic Cinema    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    FastAPI API      │
                         │    Cloud Run        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │      Google ADK Runner      │
                    │        Gemini Models        │
                    └─────────────┬───────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Script Agent │  │ Continuity   │  │ Production   │
        │              │  │ Agent        │  │ Memory Agent │
        └──────────────┘  └──────────────┘  └──────┬───────┘
                                                   │
                                                   │ MCP
                                                   ▼
                                            ┌──────────────┐
                                            │  ClickHouse  │
                                            │ Production   │
                                            │ Memory       │
                                            └──────────────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │   Producer   │
                                            │    Agent     │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            Final Production
                                                Decision

⚡ Real-Time Multi-Agent Workflow

The backend exposes a Server-Sent Events (SSE) stream.

The interface displays the production workflow as it happens:

Script Agent
   ↓
Continuity Agent
   ↓
Production Memory Agent
   ↓
Producer Agent

Each agent emits start and completion events, allowing the user to observe the production intelligence pipeline instead of waiting for a single opaque AI response.

🧰 Technology Stack

AI & Agent Orchestration

Google Agent Development Kit (ADK)

Gemini

Google Gen AI SDK

Vertex AI

Production Memory

ClickHouse

ClickHouse MCP Server

MCP (Model Context Protocol)

Backend

Python 3.12

FastAPI

Uvicorn

Pydantic

Server-Sent Events (SSE)

Frontend

Next.js

React

TypeScript

Tailwind CSS

Cloud

Google Cloud Run

Google Cloud Build

Artifact Registry

Vertex AI

🎬 Example

Input:

Production: Broken Signal

Scene 4:
Lena enters the control room wearing a white jacket.
She is carrying a black radio.

Scene 6:
The black radio is destroyed.

Scene 9:
This scene occurs later in story order than Scene 6.
Lena is carrying the black radio completely intact.

Agentic Cinema detects:

Category: PROP
Severity: HIGH
Confidence: 0.95

Issue:
Destroyed black radio reappears intact.

The Production Memory Agent retrieves previous related production cases from ClickHouse.

The Producer Agent then combines current evidence and historical precedent to produce a final decision such as:

Decision: RESHOOT
Priority: CRITICAL

with supporting reasoning and an actionable production plan.

## 📂 Repository Structure

```text
agentic-cinema/
│
├── apps/
│   ├── agent-service/
│   │   ├── production_pipeline/
│   │   ├── services/
│   │   │   └── pipeline_analyzer.py
│   │   ├── api.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── web/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── Dockerfile
│
├── README.md
└── LICENSE
```

🚀 Running Locally

Prerequisites

Python 3.12

Node.js

Google Cloud project with Vertex AI access

ClickHouse instance

### Backend

```bash
cd apps/agent-service

python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt

uvicorn api:app --host 0.0.0.0 --port 8001
```

Create the required environment configuration locally.

Example variable names:

GOOGLE_GENAI_USE_VERTEXAI
GOOGLE_CLOUD_PROJECT
GOOGLE_CLOUD_LOCATION

CLICKHOUSE_HOST
CLICKHOUSE_PORT
CLICKHOUSE_USER
CLICKHOUSE_PASSWORD
CLICKHOUSE_DATABASE

Do not commit credentials or secrets to the repository.

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Configure:

```text
AGENT_API_URL
```

Then open:

```text
http://localhost:3000
```

☁️ Deployment

Both the frontend and backend are containerized and deployed to Google Cloud Run.

The production workflow uses Google Cloud services for the AI runtime, while ClickHouse provides persistent production memory through MCP.

🔐 Security

Secrets and environment-specific credentials are excluded from source control.

The repository ignores environment files such as:

.env
.env.local

Production secrets should be supplied through the deployment environment rather than committed to Git.

🧪 Demo Scenario

The included demo demonstrates a continuity failure in the fictional production Broken Signal.

The black radio is destroyed in Scene 6 but reappears intact in Scene 9.

Agentic Cinema:

structures the screenplay information;

detects the continuity contradiction;

searches ClickHouse production memory;

finds previous related production cases;

combines historical and current evidence;

produces a final production recommendation;

writes the completed analysis back into persistent production memory.

This demonstrates how persistent production intelligence can influence future agent decision-making.

🌟 Why Agentic Cinema?

Traditional AI assistants answer questions.

Agentic Cinema is designed as a production decision system.

Its key distinction is the combination of:

specialized agents + production continuity reasoning + persistent historical memory + actionable producer decisions

The goal is to help production teams detect expensive mistakes earlier and turn previous production experience into reusable organizational intelligence.

📺 Demo

Demo video: youtube.com/watch?v=AuPVjnIqLVI&time_continue=1&source_ve_path=MjM4NTE&embeds_referring_euri=https%3A%2F%2Fdevpost.com%2F

Live application: https://agentic-cinema-web-207811053230.asia-southeast1.run.app/

📄 License

This project is released under the MIT License.

Built With

Google ADK • Gemini • Vertex AI • Google Cloud Run • ClickHouse • MCP • FastAPI • Next.js
