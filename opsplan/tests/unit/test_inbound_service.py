import json
from pathlib import Path

import pytest

from config.settings import settings
from data.db import init_db
from services.notification.inbound import (
    insert_inbound_message,
    list_inbound_messages,
    normalize_acs_event,
    validate_acs_headers,
    validate_graph_notification_client_state,
)
from services.notification.parsers import parse_assessment_from_text


@pytest.fixture()
def temp_db(tmp_path: Path):
    settings.database.path = str(tmp_path / "opsplan_test.db")
    init_db()
    return settings.database.path


def test_normalize_acs_event():
    event = {
        "id": "evt-1",
        "eventType": "Microsoft.Communication.SMSReceived",
        "eventTime": "2026-03-06T12:00:00Z",
        "data": {
            "from": "+15555550123",
            "to": "+15555559999",
            "message": "fips:48007950100 damage_pct:40 notes:roof damage",
            "messageId": "msg-123",
            "receivedTimestamp": "2026-03-06T12:00:01Z",
        },
    }
    normalized = normalize_acs_event(event)
    assert normalized["channel"] == "sms"
    assert normalized["provider"] == "acs"
    assert normalized["provider_event_id"] == "evt-1"
    assert normalized["from_address"] == "+15555550123"
    assert "fips:48007950100" in normalized["body_text"]
    assert json.loads(normalized["raw_payload_json"])["id"] == "evt-1"


def test_validate_headers_and_client_state():
    settings.azure_comm.eventgrid_topic_key = "topic123"
    settings.azure_comm.sms_webhook_secret = "secret123"
    assert validate_acs_headers({"aeg-sas-key": "topic123", "x-webhook-secret": "secret123"})
    assert not validate_acs_headers({"aeg-sas-key": "bad", "x-webhook-secret": "secret123"})

    settings.graph.notification_client_state = "state123"
    assert validate_graph_notification_client_state("state123")
    assert not validate_graph_notification_client_state("bad")


@pytest.mark.asyncio
async def test_idempotent_insert(temp_db):
    payload = {
        "id": "inb-1",
        "channel": "sms",
        "provider": "acs",
        "provider_event_id": "event-unique-1",
        "received_at": "2026-03-06T12:00:00Z",
        "from_address": "+15550000001",
        "to_address": "+15550000002",
        "subject": None,
        "body_text": "hello",
        "body_html": None,
        "attachments_json": "[]",
        "raw_payload_json": "{}",
        "parse_status": "raw_only",
        "parse_error": None,
    }
    inserted_first = await insert_inbound_message(payload)
    inserted_second = await insert_inbound_message({**payload, "id": "inb-2"})

    rows = await list_inbound_messages(limit=10)
    assert inserted_first is True
    assert inserted_second is False
    assert len(rows) == 1
    assert rows[0]["provider_event_id"] == "event-unique-1"


def test_parse_assessment_from_text():
    parsed = parse_assessment_from_text("fips: 48007950100 structure_id:abc123 damage_pct:62 notes:major roof failure")
    assert parsed is not None
    assert parsed["fips_tract"] == "48007950100"
    assert parsed["structure_id"] == "abc123"
    assert parsed["damage_classification"] == "major"
