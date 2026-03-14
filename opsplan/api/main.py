"""
OpsPlan API — FastAPI backend for the disaster response planning system.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://orange-grass-0a3e66e1e.1.azurestaticapps.net",
        "https://nice-coast-0b3959d1e.1.azurestaticapps.net",
        "https://opsplan-api.blackgrass-5f5980e2.eastus.azurecontainerapps.io",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Mount MCP Server for tool interoperability
try:
    from services.mcp_server import mcp_app
    app.mount("/mcp", mcp_app)
    logger.info("mcp.mounted", endpoint="/mcp/sse")
except Exception as e:
    logger.warning("mcp.mount_failed", error=str(e))

# MCP tool listing fallback (always available even if SSE mount fails)
@app.get("/api/mcp/tools")
async def mcp_tools():
    """List available MCP tools — REST fallback for the SSE-based MCP server."""
    return {
        "protocol": "MCP (Model Context Protocol)",
        "sse_endpoint": "/mcp/sse",
        "description": "Disaster response data tools for cross-agent interoperability",
        "tools": [
            {"name": "get_svi_by_tract", "description": "CDC Social Vulnerability Index for a census tract"},
            {"name": "get_svi_by_county", "description": "SVI for all tracts in a county"},
            {"name": "get_nri_by_tract", "description": "FEMA National Risk Index for a census tract"},
            {"name": "get_nri_by_county", "description": "NRI for all tracts in a county"},
            {"name": "get_census_housing", "description": "Housing unit types, year built, values"},
            {"name": "get_census_demographics", "description": "Population, age, income, poverty"},
            {"name": "county_to_tracts", "description": "List all tract FIPS codes in a county"},
            {"name": "get_field_assessments", "description": "Field damage assessments for a zone"},
        ]
    }


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.3.0", "mcp": "/mcp/sse"}


@app.get("/api/config/models")
async def model_config():
    """Show model routing configuration — which deployment each agent uses."""
    from config.model_router import model_router
    return {
        "model_routes": model_router.summary(),
        "mcp_server": {
            "sse_endpoint": "/mcp/sse",
            "rest_fallback": "/api/mcp/tools",
            "tools_count": 8,
            "protocol": "MCP via SSE transport",
            "description": "Model Context Protocol server exposing disaster response data tools for cross-agent interoperability"
        }
    }


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
    Side-drawer chat endpoint with context injection.
    Receives: { text, context: {step, event, zones, ...}, history: [{role, text}] }
    """
    agent_map = {
        "context": "agents.disaster_context.agent.DisasterContextAgent",
        "construction": "agents.construction_profile.agent.ConstructionProfileAgent",
        "mission": "agents.mission_planning.agent.MissionPlanningAgent",
    }
    if agent_name not in agent_map:
        return {"error": f"Unknown agent: {agent_name}"}

    module_path, class_name = agent_map[agent_name].rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    agent_class = getattr(module, class_name)
    agent = agent_class()

    # Inject context into agent's chat history so it knows what data exists
    ctx = message.get("context", {})
    if ctx:
        context_msg = f"Current analysis context: Step {ctx.get('step', '?')}. "
        if ctx.get("event"):
            context_msg += f"Event: {ctx['event'].get('type', '')} {ctx['event'].get('declaration', '')}. "
        if ctx.get("zones"):
            zone_summary = ", ".join([f"#{z.get('rank','?')} {z.get('area_name','')} (score {z.get('composite_score','')})" for z in ctx["zones"][:3]])
            context_msg += f"Top zones: {zone_summary}. "
        if ctx.get("summary"):
            context_msg += f"Summary: {ctx['summary']}. "
        if ctx.get("plan_available"):
            context_msg += "Mission plan has been generated. "
        agent.history.add_system_message(f"[CONTEXT] {context_msg}")

    # Inject recent chat history for continuity
    history = message.get("history", [])
    for h in history[-4:]:  # Last 4 exchanges
        if h.get("role") == "user":
            agent.history.add_user_message(h.get("text", ""))
        elif h.get("role") == "agent":
            agent.history.add_assistant_message(h.get("text", ""))

    response = await agent.chat(message.get("text", ""))
    return {"response": response}


@app.post("/api/export/plan")
async def export_sop(payload: dict):
    """
    Export Mission Plan as a formatted .docx document.
    Accepts the full SOP JSON + optional event/zones data.
    Returns a downloadable .docx file.
    """
    from api.export_sop import build_sop_docx

    sop = payload.get("sop", {})
    event = payload.get("event", None)
    zones = payload.get("zones", None)

    buffer = build_sop_docx(sop, event=event, zones=zones)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=OpsPlan_MissionPlan.docx"},
    )


# ---- Part 2: Field Assessment Endpoints ----

@app.post("/api/assess/photo")
async def assess_photo(payload: dict):
    """Analyze a single photo for structural damage."""
    from api.photo_assessment import analyze_photo_azure_vision
    image_b64 = payload.get("image", "")
    content_type = payload.get("content_type", "image/jpeg")
    if not image_b64:
        return {"error": "No image data provided"}
    result = await analyze_photo_azure_vision(image_b64, content_type)
    return result


@app.post("/api/assess/photos")
async def assess_photos(payload: dict):
    """Analyze multiple photos of the same property and merge results."""
    from api.photo_assessment import analyze_multiple_photos
    images = payload.get("images", [])
    if not images:
        return {"error": "No images provided"}
    result = await analyze_multiple_photos(images)
    return result


@app.post("/api/assess/save")
async def save_assessment(payload: dict):
    """Save a completed field assessment to the database."""
    from api.photo_assessment import save_assessment as _save
    return await _save(payload)


@app.get("/api/assess/history/{fips_tract}")
async def get_assessments(fips_tract: str):
    """Get assessment history for a zone."""
    from api.photo_assessment import get_zone_assessments
    rows = await get_zone_assessments(fips_tract)
    return {"assessments": rows}


@app.post("/api/assess/report")
async def export_assessment_report(payload: dict):
    """Generate a downloadable .docx assessment report."""
    from api.export_assessment import build_assessment_docx
    buffer = build_assessment_docx(payload)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=FieldAssessment_Report.docx"},
    )
