from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from config.settings import settings
from data.db import init_db


@pytest.fixture()
def client(tmp_path: Path):
    settings.database.path = str(tmp_path / "opsplan_api_test.db")
    settings.azure_comm.eventgrid_topic_key = ""
    settings.azure_comm.sms_webhook_secret = ""
    settings.graph.notification_client_state = "graph-state"
    settings.inbound_auto_parse = False
    init_db()
    return TestClient(app)


def test_acs_sms_webhook_insert_and_dedupe(client: TestClient):
    payload = [
        {
            "id": "evt-acs-1",
            "eventType": "Microsoft.Communication.SMSReceived",
            "eventTime": "2026-03-06T12:00:00Z",
            "data": {
                "from": "+15550000001",
                "to": "+15550000002",
                "message": "fips:48007950100 damage_pct:12 notes:minor leak",
                "messageId": "sms-1",
                "receivedTimestamp": "2026-03-06T12:00:01Z",
            },
        }
    ]

    res1 = client.post("/api/webhooks/acs/sms", json=payload)
    assert res1.status_code == 200
    assert res1.json()["inserted"] == 1

    res2 = client.post("/api/webhooks/acs/sms", json=payload)
    assert res2.status_code == 200
    assert res2.json()["duplicates"] == 1

    res_list = client.get("/api/inbound/messages?limit=10")
    assert res_list.status_code == 200
    body = res_list.json()
    assert body["count"] == 1
    assert body["messages"][0]["channel"] == "sms"


def test_graph_validation_token(client: TestClient):
    res = client.post("/api/webhooks/graph/email?validationToken=abc123")
    assert res.status_code == 200
    assert res.text == "abc123"


def test_graph_email_notification_insert(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_fetch_graph_message(message_id: str):
        return {
            "id": message_id,
            "subject": "Incoming Ops Update",
            "receivedDateTime": "2026-03-06T12:05:00Z",
            "from": {"emailAddress": {"address": "ops.sender@example.org", "name": "Ops Sender"}},
            "toRecipients": [{"emailAddress": {"address": "ops@teamrubicon.org"}}],
            "body": {"contentType": "text", "content": "fips:48007950100 damage_pct:35"},
            "bodyPreview": "fips:48007950100 damage_pct:35",
            "hasAttachments": False,
            "internetMessageId": "<abc@example.org>",
        }

    monkeypatch.setattr("api.main.fetch_graph_message", fake_fetch_graph_message)

    payload = {
        "value": [
            {
                "subscriptionId": "sub-1",
                "clientState": "graph-state",
                "changeType": "created",
                "resource": "users/user-1/messages/msg-1",
                "resourceData": {"id": "msg-1"},
            }
        ]
    }
    res = client.post("/api/webhooks/graph/email", json=payload)
    assert res.status_code == 200
    assert res.json()["inserted"] == 1

    res_list = client.get("/api/inbound/messages?limit=10")
    assert res_list.status_code == 200
    messages = res_list.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["channel"] == "email"


def test_graph_lifecycle_renew(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    async def fake_renew_graph_subscription(subscription_id: str, renew_hours: int = 24):
        return {"id": subscription_id, "expirationDateTime": "2026-03-07T12:00:00Z"}

    monkeypatch.setattr("api.main.renew_graph_subscription", fake_renew_graph_subscription)
    payload = {"value": [{"subscriptionId": "sub-renew-1"}]}
    res = client.post("/api/webhooks/graph/email/lifecycle", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert len(body["renewed"]) == 1
    assert body["renewed"][0]["subscription_id"] == "sub-renew-1"
