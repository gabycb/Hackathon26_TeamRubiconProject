"""
OpsPlan API — FastAPI backend for the disaster response planning system.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from config.settings import settings
from data.db import init_db

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and validate config on startup."""
    # Validate configuration
    issues = settings.validate()
    if issues:
        for issue in issues:
            logger.warning("config.missing", issue=issue)
        logger.warning("config.incomplete", count=len(issues),
                       note="Some features may not work without all config values")
    else:
        logger.info("config.valid")

    # Initialize database
    init_db()
    logger.info("app.startup", debug=settings.debug)

    yield

    logger.info("app.shutdown")


app = FastAPI(
    title="OpsPlan API",
    description="Disaster Response Mission Planning — Team Rubicon",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ---- Agent Pipeline Endpoints ----

@app.post("/api/events/analyze")
async def analyze_event(event: dict):
    """
    Step 1: Run the Disaster Context Agent.
    Accepts event description, returns ranked priority zones.
    """
    from agents.disaster_context.agent import DisasterContextAgent
    agent = DisasterContextAgent()
    result = await agent.analyze_event(
        event_description=event.get("description", ""),
        scoring_weights=event.get("weights"),
    )
    return result


@app.post("/api/profiles/build")
async def build_profiles(zones: dict):
    """
    Step 2: Run the Construction Profile Agent.
    Accepts priority zones, returns construction profiles.
    """
    from agents.construction_profile.agent import ConstructionProfileAgent
    agent = ConstructionProfileAgent()
    result = await agent.build_profiles(zones.get("zones", []))
    return result


@app.post("/api/plan/generate")
async def generate_plan(inputs: dict):
    """
    Step 3: Run the Mission Planning Agent.
    Accepts context + construction outputs, returns SOP.
    """
    from agents.mission_planning.agent import MissionPlanningAgent
    agent = MissionPlanningAgent()
    result = await agent.generate_plan(
        context_output=inputs.get("context", {}),
        construction_output=inputs.get("construction", {}),
    )
    return result


@app.post("/api/chat/{agent_name}")
async def agent_chat(agent_name: str, message: dict):
    """
    Side-drawer chat endpoint — routes to the appropriate agent.
    """
    agent_map = {
        "context": "agents.disaster_context.agent.DisasterContextAgent",
        "construction": "agents.construction_profile.agent.ConstructionProfileAgent",
        "mission": "agents.mission_planning.agent.MissionPlanningAgent",
    }
    # In production, agents would be session-persistent.
    # For now, create a fresh instance per request.
    if agent_name not in agent_map:
        return {"error": f"Unknown agent: {agent_name}"}

    module_path, class_name = agent_map[agent_name].rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    agent_class = getattr(module, class_name)
    agent = agent_class()

    response = await agent.chat(message.get("text", ""))
    return {"response": response}
