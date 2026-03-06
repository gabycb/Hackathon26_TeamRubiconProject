"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ---- Event Analysis (Agent 1) ----

class EventInput(BaseModel):
    """Input for disaster event analysis."""
    description: str = Field(..., description="Event description, FEMA number, or structured input")
    event_type: Optional[str] = Field(None, description="Hurricane, Tornado, Flood, etc.")
    event_name: Optional[str] = Field(None, description="Named storm or event")
    affected_counties: Optional[list[str]] = Field(None, description="List of county names")
    state: Optional[str] = Field(None, description="State name or FIPS")
    weights: Optional[dict[str, float]] = Field(
        None,
        description="Custom scoring weights: svi, nri, housing_vulnerability, population_density",
    )

    def to_prompt(self) -> str:
        """Convert structured input to an agent prompt string."""
        parts = [self.description]
        if self.event_type:
            parts.append(f"Event type: {self.event_type}")
        if self.event_name:
            parts.append(f"Event name: {self.event_name}")
        if self.state:
            parts.append(f"State: {self.state}")
        if self.affected_counties:
            parts.append(f"Affected counties: {', '.join(self.affected_counties)}")
        return "\n".join(parts)


class ZoneResult(BaseModel):
    """A single ranked zone from Agent 1 output."""
    rank: int
    area_name: str
    fips_tract: str
    composite_score: float
    risk_level: str
    svi_score: Optional[float] = None
    nri_score: Optional[float] = None
    housing_vulnerability: Optional[float] = None
    population: Optional[int] = None
    households: Optional[int] = None
    total_structures: Optional[int] = None
    explanation: Optional[str] = None


class EventAnalysisResponse(BaseModel):
    """Response from disaster context analysis."""
    event: dict
    zones: list[dict]
    scoring_weights: dict[str, float]
    summary: str


# ---- Construction Profiles (Agent 2) ----

class ProfileInput(BaseModel):
    """Input for construction profile generation."""
    zones: list[dict] = Field(..., description="Ranked zones from Agent 1 output")
    context_output: Optional[dict] = Field(None, description="Full Agent 1 output for reference")


class ProfileResponse(BaseModel):
    """Response from construction profile agent."""
    profiles: list[dict]
    summary: Optional[str] = None


# ---- Mission Planning (Agent 3) ----

class PlanInput(BaseModel):
    """Input for mission plan generation."""
    context: dict = Field(..., description="Full Agent 1 output")
    construction: dict = Field(..., description="Full Agent 2 output")


class SectionRevision(BaseModel):
    """Request to revise a specific SOP section."""
    section: str = Field(..., description="Section name: situation, mission, execution, sustainment, command_signal")
    instructions: str = Field(..., description="Revision instructions")


class PlanResponse(BaseModel):
    """Response from mission planning agent."""
    sop: dict
    section_status: dict[str, str]
    summary_metrics: Optional[dict] = None


# ---- Chat ----

class ChatMessage(BaseModel):
    """Chat message for the side-drawer agent chat."""
    text: str
    session_id: Optional[str] = Field(None, description="Session ID to maintain conversation")


class ChatResponse(BaseModel):
    """Chat response from an agent."""
    response: str
    agent: str


# ---- Inbound Communications ----

class InboundMessageCreate(BaseModel):
    """Normalized inbound message payload used for database inserts."""
    id: str
    channel: str = Field(..., description="sms|email")
    provider: str = Field(..., description="acs|graph")
    provider_event_id: str
    received_at: Optional[str] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    attachments_json: Optional[str] = None
    raw_payload_json: str
    parse_status: str = "raw_only"
    parse_error: Optional[str] = None


class InboundMessageRecord(InboundMessageCreate):
    """Inbound message record returned by API."""
    created_at: Optional[str] = None


class AcsSmsEvent(BaseModel):
    """Subset of ACS/Event Grid SMS event shape."""
    id: str
    eventType: str
    eventTime: Optional[str] = None
    data: dict


class GraphNotification(BaseModel):
    """Subset of Microsoft Graph notification shape."""
    subscriptionId: str
    clientState: Optional[str] = None
    changeType: Optional[str] = None
    resource: Optional[str] = None
    resourceData: Optional[dict] = None
