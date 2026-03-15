# OpsPlan — AI-Powered Disaster Response Mission Planning

**Hackathon:** Microsoft Dev Days Hackathon  
**Live Demo:** [https://nice-coast-0b3959d1e.1.azurestaticapps.net](https://nice-coast-0b3959d1e.1.azurestaticapps.net)

---

## What It Does

OpsPlan automates disaster response planning for Team Rubicon using a multi-agent AI pipeline. Field commanders input a disaster event and OpsPlan generates a complete 5-Paragraph Mission Plan with prioritized zones, construction vulnerability profiles, resource allocation, and team assignments — all backed by real Census, SVI, and NRI data.

### Part 1 — Mission Planning (4-Step Wizard)

1. **Define Event** — Enter FEMA declaration, location, or free text. Select from weather sentinel alerts. The **Priority Analysis Agent** queries SVI/NRI/Census databases to identify and rank affected census tracts.
2. **Priority Analysis** — Review ranked zones with composite scoring (SVI × NRI × Housing Vulnerability × Population Density). Adjust weights, re-score, drill into zone details. Hover/tap any data point to ask the agent about it.
3. **Construction Profiles** — Per-zone structural data across 6 tabs: Structural, Exterior, Site & Hazard, Financial, Demographics, TR Vulnerability. All sourced from real Census ACS and CDC SVI data.
4. **Mission Plan** — Complete Team Rubicon 5-Paragraph Operations Order: Situation, Mission, Execution (phased with team assignments), Sustainment (personnel, equipment, materials), Command & Signal. Fully editable. Export as .docx or email to team.

### Part 2 — Field Assessment (6-Screen Mobile Flow)

1. **Select Zone** — Pick from priority zones identified in Part 1
2. **Capture Photos** — Multi-photo upload with camera or gallery
3. **AI Analysis** — Two-stage pipeline: Azure AI Vision 4.0 (scene detection, tags, OCR) → GPT-4o (structured damage classification). Photo overlay annotations. Human approve/reject per component finding.
4. **Tag & Annotate** — Add hazard and damage tags, field notes
5. **Review & Submit** — Confirm and save to mission database
6. **Summary** — Export assessment report (.docx), view history, assess another structure

---

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────────────────────────┐
│  Azure Static Web Apps  │────▶│  Azure Container Apps (FastAPI Backend)  │
│  React Frontend         │     │                                          │
│  Built-in Auth (AAD)    │     │  ┌─────────────────────────────────────┐ │
└─────────────────────────┘     │  │  Semantic Kernel Agent Pipeline     │ │
                                │  │                                     │ │
                                │  │  Agent 1: Priority Analysis         │ │
                                │  │    → SVI, NRI, Census, Geocoding    │ │
                                │  │    → Priority Scoring (deterministic)│ │
                                │  │                                     │ │
                                │  │  Agent 2: Construction Profile      │ │
                                │  │    → Census Housing, SVI Themes     │ │
                                │  │                                     │ │
                                │  │  Agent 3: Mission Planning          │ │
                                │  │    → Resource Allocation, Timeline  │ │
                                │  │                                     │ │
                                │  │  Agent 4: Field Assessment          │ │
                                │  │    → Azure AI Vision + GPT-4o       │ │
                                │  └─────────────────────────────────────┘ │
                                │                                          │
                                │  ┌──────────┐  ┌───────────────────────┐ │
                                │  │ Model     │  │ MCP Server (8 tools)  │ │
                                │  │ Router    │  │ SSE + REST fallback   │ │
                                │  └──────────┘  └───────────────────────┘ │
                                │                                          │
                                │  ┌──────────────────────────────────┐    │
                                │  │  SQLite: SVI + NRI + Census ACS  │    │
                                │  │  6,884 SVI tracts · 6,883 NRI    │    │
                                │  └──────────────────────────────────┘    │
                                └──────────────────────────────────────────┘
                                         │              │
                                         ▼              ▼
                                ┌──────────────┐ ┌──────────────────┐
                                │ Azure OpenAI │ │ Azure AI Vision  │
                                │ GPT-4o       │ │ 4.0 (Florence)   │
                                └──────────────┘ └──────────────────┘
```

---

## Azure Services Used

| Service | Purpose | Criterion |
|---------|---------|-----------|
| **Azure OpenAI (GPT-4o)** | Powers all 4 SK agents | Core AI |
| **Azure AI Vision 4.0** | Stage 1 photo analysis — captions, tags, objects, OCR | Computer Vision |
| **Azure Container Apps** | Backend deployment via container registry | Production Deployment |
| **Azure Static Web Apps** | Frontend hosting with built-in auth | Production Deployment |
| **Azure Container Registry** | Docker image storage | DevOps |

## Microsoft Technologies

| Technology | Implementation |
|-----------|---------------|
| **Semantic Kernel** | Agent framework — 4 agents with native function plugins and auto function calling |
| **Model Router** | Per-agent model assignment (configurable gpt-4o / gpt-4o-mini per agent) |
| **MCP Server** | 8 disaster data tools exposed via Model Context Protocol (SSE + REST) |
| **Azure AI Foundry** | Container Apps deployment via ACR build pipeline |

---

## Project Structure

```
opsplan/
├── frontend/                    # React + Vite UI
│   └── src/
│       ├── App.jsx              # 4-step wizard + chat + mobile responsive
│       └── FieldAssessment.jsx  # Part 2: 6-screen mobile assessment flow
├── agents/                      # Semantic Kernel agents
│   ├── base_agent.py            # Base class with Model Router integration
│   ├── disaster_context/        # Agent 1: Priority Analysis
│   ├── construction_profile/    # Agent 2: Construction Profiles
│   └── mission_planning/        # Agent 3: Mission Plan generation
├── skills/                      # SK native function plugins (12 tools)
│   ├── svi_lookup.py            # CDC SVI queries
│   ├── nri_lookup.py            # FEMA NRI queries
│   ├── census_lookup.py         # Census ACS + vulnerability profiles
│   ├── priority_scoring.py      # Deterministic composite scoring
│   ├── resource_allocation.py   # Personnel/equipment calculator
│   ├── timeline_generator.py    # Phased ops timeline
│   └── ...
├── services/
│   └── mcp_server.py            # MCP Server — 8 tools via SSE transport
├── config/
│   ├── settings.py              # Environment config loader
│   └── model_router.py          # Per-agent model assignment
├── api/
│   ├── main.py                  # FastAPI — endpoints + CORS + MCP mount
│   ├── photo_assessment.py      # Azure AI Vision + GPT-4o pipeline
│   ├── export_sop.py            # Mission Plan .docx generator
│   └── export_assessment.py     # Field Assessment .docx report
├── data/
│   ├── schema.sql               # SQLite schema (9 tables)
│   ├── db.py                    # Async database module
│   ├── opsplan.db               # Pre-loaded SVI/NRI/Census data
│   └── loaders/                 # Data loading scripts
├── Dockerfile                   # Container build
├── deploy.ps1                   # Azure deployment script (PowerShell)
├── requirements.txt             # Python dependencies
└── staticwebapp.config.json     # SWA auth + routing config
```

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Azure OpenAI resource with GPT-4o deployment
- Census API key (free: https://api.census.gov/data/key_signup.html)

### Setup

```bash
cd opsplan

# Backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Configure
copy config\.env.example config\.env
# Edit config\.env with your Azure OpenAI endpoint, key, and Census API key

# Initialize database
python scripts/setup_db.py
python -m data.loaders.load_materials
python -m data.loaders.load_svi data/SVI_2022_US.csv --state 48
python -m data.loaders.load_nri data/NRI_Table_CensusTracts.csv --state Texas
python -m data.loaders.load_census --state 48 --counties 007,391,057,469,409

# Start backend
uvicorn api.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Environment Variables

```
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_VISION_ENDPOINT=https://your-vision.cognitiveservices.azure.com/
AZURE_VISION_API_KEY=your-key
CENSUS_API_KEY=your-census-key
```

---

## Production Deployment

### Backend → Azure Container Apps

```powershell
az login
az acr build --registry opsplanacr905 --image opsplan:latest --file Dockerfile .
az containerapp update --name opsplan-api --resource-group rg-opsplan --image opsplanacr905.azurecr.io/opsplan:latest
```

### Frontend → Azure Static Web Apps

```powershell
cd frontend
npm run build
swa deploy ./dist --env production --app-name opsplan
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + version |
| GET | `/api/config/models` | Model Router + MCP Server config |
| GET | `/api/mcp/tools` | MCP tool listing (REST fallback) |
| POST | `/api/events/analyze` | Run Priority Analysis Agent |
| POST | `/api/profiles/build` | Run Construction Profile Agent |
| POST | `/api/plan/generate` | Run Mission Planning Agent |
| POST | `/api/chat/{agent}` | Agent chat with context injection |
| POST | `/api/export/plan` | Export Mission Plan as .docx |
| POST | `/api/assess/photo` | Analyze single photo (Vision + GPT-4o) |
| POST | `/api/assess/photos` | Analyze multiple photos + merge |
| POST | `/api/assess/save` | Save field assessment to database |
| POST | `/api/assess/report` | Export assessment report as .docx |
| GET | `/api/assess/history/{fips}` | Get assessment history for a zone |

---

## Data Sources

| Dataset | Source | Records |
|---------|--------|---------|
| CDC SVI 2022 | CDC/ATSDR | 6,884 TX tracts |
| FEMA NRI | FEMA Hazards | 6,883 TX tracts |
| Census ACS 5-Year | Census API | Harvey impact area |
| Materials Reference | Built-in | Static reference |

---

## Team

**THYNK UNLIMITED** — Team Rubicon × Microsoft Azure AI Hackathon
