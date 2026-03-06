# OpsPlan — Disaster Response Mission Planning

**Team:** THYNK UNLIMITED  
**Hackathon:** Team Rubicon  
**Stack:** Python + FastAPI + Semantic Kernel (backend) · React + Vite (frontend) · Azure AI (agents)

---

## What It Does

OpsPlan automates disaster response planning using a 3-agent AI pipeline:

1. **Disaster Context Agent** — Takes an event description or FEMA declaration, queries SVI/NRI/Census data, and produces ranked priority zones.
2. **Construction Profile Agent** — Builds detailed structural profiles for each zone using Hazus and Census housing data.
3. **Mission Planning Agent** — Generates a Team Rubicon 5-paragraph SOP (Standard Operating Procedure) with phased timelines, resource allocation, and team assignments.

Each agent step has a human approval gate. A side-drawer chat lets operators ask questions or request adjustments at any step.

---

## Project Structure

```
opsplan/
├── frontend/                # React + Vite UI
│   ├── src/
│   │   ├── App.jsx          # Full 4-step wizard app
│   │   └── main.jsx         # React entry point
│   ├── index.html           # HTML shell
│   ├── vite.config.js       # Dev server + API proxy
│   └── package.json         # Node dependencies
├── agents/                  # Semantic Kernel agents
│   ├── base_agent.py        # Shared agent base class
│   ├── disaster_context/    # Agent 1: zone prioritization
│   ├── construction_profile/# Agent 2: structural profiles
│   └── mission_planning/    # Agent 3: SOP generation
├── skills/                  # SK native function plugins
│   ├── svi_lookup.py        # CDC SVI queries
│   ├── nri_lookup.py        # FEMA NRI queries
│   ├── census_lookup.py     # Census ACS queries
│   ├── geocoding.py         # Address → FIPS tract
│   ├── priority_scoring.py  # Deterministic scoring
│   ├── housing_stock.py     # Hazus building stock
│   ├── construction_costs.py# Replacement cost estimation
│   ├── material_profile.py  # Building materials lookup
│   ├── sop_template.py      # SOP JSON validation
│   ├── resource_allocation.py# Personnel/equipment calc
│   ├── timeline_generator.py# Phased ops timeline
│   └── docx_renderer.py     # SOP → Word document
├── api/                     # FastAPI backend
│   └── main.py              # Endpoints + CORS + lifespan
├── data/
│   ├── schema.sql           # SQLite schema (9 tables)
│   ├── db.py                # Async database module
│   └── loaders/             # Data loading scripts
│       ├── load_svi.py      # CDC SVI 2022 CSV loader
│       ├── load_nri.py      # FEMA NRI CSV loader
│       ├── load_census.py   # Census ACS API loader
│       └── load_materials.py# Reference materials seeder
├── config/
│   ├── settings.py          # Environment config
│   └── .env.example         # Template for secrets
├── scripts/
│   └── setup_db.py          # Database initialization
├── services/                # Future: Weather Sentinel, Auth, Notifications
├── tests/                   # Unit + integration tests
├── requirements.txt         # Python dependencies
└── pyproject.toml           # Project metadata
```

---

## Quick Start

### Prerequisites

- **Python 3.11+** — https://python.org (check "Add to PATH" during install)
- **Node.js 18+** — https://nodejs.org (LTS version)
- **Azure OpenAI** — An Azure OpenAI resource with a GPT-4o deployment
- **Census API key** (free) — https://api.census.gov/data/key_signup.html

### 1. Clone / extract the project

```bash
cd your-projects-folder
unzip opsplan-project.zip
cd opsplan
```

### 2. Backend setup

```bash
# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 3. Configure environment

```bash
# Windows:
copy config\.env.example config\.env
# Mac/Linux:
cp config/.env.example config/.env
```

Open `config/.env` in any text editor and fill in:

```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o
CENSUS_API_KEY=your-census-key-here
```

The Azure OpenAI values come from Azure Portal → your OpenAI resource → "Keys and Endpoint."
Optional inbound communications config:

```
ACS_EVENTGRID_TOPIC_KEY=...
ACS_SMS_WEBHOOK_SECRET=...
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
GRAPH_MAILBOX_USER_ID=...
GRAPH_NOTIFICATION_CLIENT_STATE=...
GRAPH_SUBSCRIPTION_CALLBACK_URL=...
INBOUND_AUTO_PARSE=false
```

### 4. Initialize database and load data

```bash
# Create the SQLite database
python scripts/setup_db.py

# Load materials reference data (instant, no download)
python -m data.loaders.load_materials
```

Then download and load the open-source datasets:

```bash
# SVI — download CSV from:
#   https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html
#   Select: 2022 → United States → CSV
#   Move file to: data/SVI_2022_US.csv
python -m data.loaders.load_svi data/SVI_2022_US.csv --state 48

# NRI — download CSV from:
#   https://hazards.fema.gov/nri/data-resources
#   Click: Census Tracts → CSV
#   Move file to: data/NRI_Table_CensusTracts.csv
python -m data.loaders.load_nri data/NRI_Table_CensusTracts.csv --state Texas

# Census ACS — fetches from API, no download needed
python -m data.loaders.load_census --state 48 --counties 007,391,057,469,409
```

The `--state 48` and `--state Texas` flags filter to Texas only so you don't have to load the entire US. The county codes are: Aransas (007), Refugio (391), Calhoun (057), Victoria (469), San Patricio (409).

### 5. Start the backend

```bash
uvicorn api.main:app --reload
```

Verify it works: open http://localhost:8000/health — you should see `{"status":"ok","version":"0.1.0"}`.

### 6. Frontend setup (new terminal)

Open a **second** terminal window, navigate to the project, then:

```bash
cd opsplan/frontend
npm install
npm run dev
```

This starts the React dev server. Open http://localhost:5173 in your browser — you'll see the OpsPlan app.

The Vite dev server automatically proxies any `/api/*` requests to your backend at `localhost:8000`, so the frontend and backend work together seamlessly.

### 7. Use the app

1. **Step 1 — Define Event:** Click "Pre-fill from Alert" to load Hurricane Harvey data, then click "Run Disaster Context Agent."
2. **Step 2 — Priority Analysis:** Review the ranked zones, click rows to see details. Click "Approve Rankings."
3. **Step 3 — Construction Profiles:** Switch between zones and data tabs. Click "Approve Profiles."
4. **Step 4 — Mission Plan:** Browse all 5 SOP sections. Click "Export .docx" to download.
5. **Chat:** Toggle the Agent Chat drawer from the header at any step.

The app currently runs in **demo mode** with pre-loaded Harvey data. Once the backend agents are connected to your Azure OpenAI deployment and the database is loaded, it will use real agent responses.

---

## Data Sources

| Dataset | Source | Size | What It Provides |
|---------|--------|------|-----------------|
| CDC SVI 2022 | CDC/ATSDR | ~85 MB | Social vulnerability scores by census tract |
| FEMA NRI | FEMA | ~180 MB | Natural hazard risk scores by census tract |
| Census ACS 5-Year | Census API | API call | Housing types, demographics, financials by tract |
| Materials Reference | Built-in | Instant | Building materials + costs by type/era/region |

---

## Azure Services

| Service | Purpose | Required For |
|---------|---------|-------------|
| Azure OpenAI (GPT-4o) | Powers all 3 agents | Core pipeline |
| Azure AI Vision | Mobile photo damage assessment | Part 2 |
| Azure Blob Storage | Photo storage | Part 2 |
| Azure Communication Services | Inbound SMS webhook events | Inbound communications |
| Microsoft Graph | Inbound mailbox notifications + email fetch | Inbound communications |
| Microsoft Entra ID | Authentication | Production |

For the hackathon demo, only Azure OpenAI is required. For inbound communications, configure ACS + Graph.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/events/analyze` | Run Disaster Context Agent |
| POST | `/api/profiles/build` | Run Construction Profile Agent |
| POST | `/api/plan/generate` | Run Mission Planning Agent |
| POST | `/api/chat/{agent_name}` | Side-drawer agent chat |
| POST | `/api/webhooks/acs/sms` | ACS/Event Grid SMS inbound webhook |
| POST | `/api/webhooks/graph/email` | Microsoft Graph email notification webhook |
| POST | `/api/webhooks/graph/email/lifecycle` | Graph subscription lifecycle callback |
| GET | `/api/inbound/messages` | List normalized inbound messages |

---

## Team

**THYNK UNLIMITED** — Team Rubicon Hackathon

