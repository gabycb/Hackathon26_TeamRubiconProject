"""
OpsPlan API — FastAPI backend for the disaster response planning system.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Header, HTTPException, Query
from fastapi.responses import PlainTextResponse
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import structlog

from config.settings import settings
from data.db import init_db
from services.notification.inbound import (
    graph_validation_token_response,
    insert_inbound_message,
    list_inbound_messages,
    mark_parse_status,
    normalize_acs_event,
    normalize_graph_notification,
    validate_acs_headers,
    validate_graph_notification_client_state,
    fetch_graph_message,
    renew_graph_subscription,
)
from services.notification.parsers import parse_assessment_from_text, project_to_field_assessment

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


@app.post("/api/export/sop")
async def export_sop(payload: dict):
    """
    Export SOP as a formatted .docx document.
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
        headers={"Content-Disposition": "attachment; filename=OpsPlan_SOP.docx"},
    )


# ---- Inbound Communications ----

@app.post("/api/webhooks/acs/sms")
async def acs_sms_webhook(
    request: Request,
    aeg_sas_key: str | None = Header(default=None),
    x_webhook_secret: str | None = Header(default=None),
):
    """
    Azure Event Grid endpoint for ACS SMS received events.
    Supports subscription validation and idempotent message ingestion.
    """
    headers = {
        "aeg-sas-key": aeg_sas_key or "",
        "x-webhook-secret": x_webhook_secret or "",
    }
    if not validate_acs_headers(headers):
        raise HTTPException(status_code=401, detail="Unauthorized webhook request")

    payload = await request.json()
    events = payload if isinstance(payload, list) else [payload]

    inserted = 0
    duplicates = 0

    for event in events:
        event_type = event.get("eventType")
        if event_type == "Microsoft.EventGrid.SubscriptionValidationEvent":
            validation_code = ((event.get("data") or {}).get("validationCode") or "").strip()
            if not validation_code:
                raise HTTPException(status_code=400, detail="Missing validationCode")
            return {"validationResponse": validation_code}

        if event_type != "Microsoft.Communication.SMSReceived":
            continue

        normalized = normalize_acs_event(event)
        was_inserted = await insert_inbound_message(normalized)
        inserted += 1 if was_inserted else 0
        duplicates += 0 if was_inserted else 1

        if settings.inbound_auto_parse and was_inserted:
            parsed = parse_assessment_from_text(normalized.get("body_text"))
            if parsed:
                try:
                    await project_to_field_assessment(parsed, normalized)
                    await mark_parse_status(normalized["id"], "parsed")
                except Exception as exc:
                    await mark_parse_status(normalized["id"], "parse_failed", str(exc))

    return {"status": "ok", "inserted": inserted, "duplicates": duplicates}


@app.post("/api/webhooks/graph/email")
async def graph_email_webhook(request: Request, validationToken: str | None = Query(default=None)):
    """
    Microsoft Graph subscription callback for message-created events.
    """
    token = graph_validation_token_response(validationToken)
    if token:
        return PlainTextResponse(content=token)

    payload = await request.json()
    notifications = payload.get("value", []) if isinstance(payload, dict) else []
    if not notifications:
        raise HTTPException(status_code=400, detail="Invalid notification payload")

    inserted = 0
    duplicates = 0
    rejected = 0

    for notification in notifications:
        if not validate_graph_notification_client_state(notification.get("clientState")):
            rejected += 1
            continue

        message_id = ""
        resource_data = notification.get("resourceData") or {}
        if resource_data.get("id"):
            message_id = str(resource_data["id"])
        else:
            resource = str(notification.get("resource", ""))
            if "/messages/" in resource:
                message_id = resource.split("/messages/")[-1].split("?")[0]

        if not message_id:
            rejected += 1
            continue

        try:
            message = await fetch_graph_message(message_id)
            normalized = normalize_graph_notification(notification, message)
            was_inserted = await insert_inbound_message(normalized)
            inserted += 1 if was_inserted else 0
            duplicates += 0 if was_inserted else 1
            if settings.inbound_auto_parse and was_inserted:
                parsed = parse_assessment_from_text(normalized.get("body_text"))
                if parsed:
                    try:
                        await project_to_field_assessment(parsed, normalized)
                        await mark_parse_status(normalized["id"], "parsed")
                    except Exception as exc:
                        await mark_parse_status(normalized["id"], "parse_failed", str(exc))
        except Exception as exc:
            logger.warning("graph.notification.process_failed", error=str(exc))
            rejected += 1

    return {"status": "ok", "inserted": inserted, "duplicates": duplicates, "rejected": rejected}


@app.post("/api/webhooks/graph/email/lifecycle")
async def graph_email_lifecycle(payload: dict):
    """
    Lifecycle callback endpoint for Graph subscriptions.
    Attempts subscription renewal when lifecycle events include a subscriptionId.
    """
    notifications = payload.get("value", []) if isinstance(payload, dict) else []
    renewed = []
    failed = []
    for notification in notifications:
        subscription_id = notification.get("subscriptionId")
        if not subscription_id:
            continue
        try:
            result = await renew_graph_subscription(subscription_id)
            renewed.append({"subscription_id": subscription_id, "expirationDateTime": result.get("expirationDateTime")})
        except Exception as exc:
            logger.warning("graph.lifecycle.renew_failed", subscription_id=subscription_id, error=str(exc))
            failed.append({"subscription_id": subscription_id, "error": str(exc)})
    return {"status": "accepted", "renewed": renewed, "failed": failed}


@app.get("/api/inbound/messages")
async def inbound_messages(limit: int = 50):
    """Operator/debug endpoint for recent inbound messages."""
    rows = await list_inbound_messages(limit=limit)
    return {"messages": rows, "count": len(rows)}
