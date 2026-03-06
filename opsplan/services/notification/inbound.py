"""
Inbound communications ingestion service.

Normalizes ACS SMS and Microsoft Graph email notifications into a shared
inbound_messages table shape and performs idempotent persistence.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
import structlog

from config.settings import settings
from data.db import execute, query

logger = structlog.get_logger()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pick_first(values: list[Any], default: str = "") -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def validate_acs_headers(headers: dict[str, str]) -> bool:
    """Validate ACS/Event Grid request headers using optional shared secrets."""
    if settings.azure_comm.eventgrid_topic_key:
        if headers.get("aeg-sas-key", "") != settings.azure_comm.eventgrid_topic_key:
            return False
    if settings.azure_comm.sms_webhook_secret:
        if headers.get("x-webhook-secret", "") != settings.azure_comm.sms_webhook_secret:
            return False
    return True


def graph_validation_token_response(validation_token: str | None) -> str | None:
    """Echo Graph validation token for subscription setup handshake."""
    return validation_token if validation_token else None


def validate_graph_notification_client_state(client_state: str | None) -> bool:
    """Validate Graph client state if configured."""
    expected = settings.graph.notification_client_state
    if not expected:
        return True
    return bool(client_state) and client_state == expected


def normalize_acs_event(event: dict[str, Any]) -> dict[str, Any]:
    """Normalize a single ACS/Event Grid event into inbound_messages schema."""
    data = event.get("data", {}) or {}
    event_id = _pick_first(
        [
            event.get("id"),
            data.get("messageId"),
            data.get("inboundMessageId"),
        ],
        default=str(uuid.uuid4()),
    )
    received_at = _pick_first(
        [data.get("receivedTimestamp"), event.get("eventTime")],
        default=_utc_now_iso(),
    )

    return {
        "id": str(uuid.uuid4()),
        "channel": "sms",
        "provider": "acs",
        "provider_event_id": str(event_id),
        "received_at": received_at,
        "from_address": _pick_first([data.get("from"), data.get("fromPhoneNumber")]),
        "to_address": _pick_first([data.get("to"), data.get("toPhoneNumber")]),
        "subject": None,
        "body_text": _pick_first([data.get("message"), data.get("messageText")]),
        "body_html": None,
        "attachments_json": json.dumps(data.get("attachments", [])),
        "raw_payload_json": json.dumps(event),
        "parse_status": "raw_only",
        "parse_error": None,
    }


def _extract_graph_message_id(notification: dict[str, Any]) -> str:
    resource_data = notification.get("resourceData") or {}
    if resource_data.get("id"):
        return str(resource_data["id"])
    resource = str(notification.get("resource", ""))
    match = re.search(r"/messages/([^/?]+)", resource)
    if match:
        return match.group(1)
    return ""


async def _graph_token() -> str:
    tenant = settings.graph.tenant_id
    client_id = settings.graph.client_id
    client_secret = settings.graph.client_secret
    if not all([tenant, client_id, client_secret]):
        raise RuntimeError("Graph credentials are not fully configured")

    token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(token_url, data=payload)
        res.raise_for_status()
        return res.json()["access_token"]


async def fetch_graph_message(message_id: str) -> dict[str, Any]:
    """Fetch full email message details from Microsoft Graph."""
    mailbox = settings.graph.mailbox_user_id
    if not mailbox:
        raise RuntimeError("GRAPH_MAILBOX_USER_ID is required")
    token = await _graph_token()
    url = (
        f"https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}"
        "?$select=id,subject,receivedDateTime,from,toRecipients,body,bodyPreview,hasAttachments,internetMessageId"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        res.raise_for_status()
        return res.json()


async def renew_graph_subscription(subscription_id: str, renew_hours: int = 24) -> dict[str, Any]:
    """Renew an existing Graph subscription expiration time."""
    token = await _graph_token()
    expiration = (datetime.now(timezone.utc) + timedelta(hours=renew_hours)).replace(microsecond=0).isoformat()
    url = f"https://graph.microsoft.com/v1.0/subscriptions/{subscription_id}"
    body = {"expirationDateTime": expiration}
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.patch(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
        )
        res.raise_for_status()
        return res.json()


def normalize_graph_notification(notification: dict[str, Any], message: dict[str, Any]) -> dict[str, Any]:
    """Normalize Graph notification + fetched message into inbound_messages schema."""
    from_obj = (message.get("from") or {}).get("emailAddress") or {}
    to_recipients = message.get("toRecipients") or []
    to_value = ",".join(
        (item.get("emailAddress") or {}).get("address", "")
        for item in to_recipients
        if item.get("emailAddress")
    )
    body = message.get("body") or {}

    provider_event_id = _pick_first(
        [
            (notification.get("resourceData") or {}).get("id"),
            message.get("id"),
            message.get("internetMessageId"),
        ],
        default=str(uuid.uuid4()),
    )

    return {
        "id": str(uuid.uuid4()),
        "channel": "email",
        "provider": "graph",
        "provider_event_id": str(provider_event_id),
        "received_at": _pick_first([message.get("receivedDateTime")], default=_utc_now_iso()),
        "from_address": _pick_first([from_obj.get("address"), from_obj.get("name")]),
        "to_address": to_value,
        "subject": message.get("subject"),
        "body_text": _pick_first([message.get("bodyPreview")]),
        "body_html": body.get("content") if body.get("contentType", "").lower() == "html" else None,
        "attachments_json": json.dumps({"hasAttachments": bool(message.get("hasAttachments"))}),
        "raw_payload_json": json.dumps({"notification": notification, "message": message}),
        "parse_status": "raw_only",
        "parse_error": None,
    }


async def insert_inbound_message(normalized: dict[str, Any]) -> bool:
    """
    Insert normalized inbound message idempotently.
    Returns True if inserted, False if duplicate provider_event_id.
    """
    sql = """
    INSERT OR IGNORE INTO inbound_messages (
        id, channel, provider, provider_event_id, received_at, from_address, to_address,
        subject, body_text, body_html, attachments_json, raw_payload_json, parse_status, parse_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        normalized["id"],
        normalized["channel"],
        normalized["provider"],
        normalized["provider_event_id"],
        normalized.get("received_at"),
        normalized.get("from_address"),
        normalized.get("to_address"),
        normalized.get("subject"),
        normalized.get("body_text"),
        normalized.get("body_html"),
        normalized.get("attachments_json"),
        normalized["raw_payload_json"],
        normalized.get("parse_status", "raw_only"),
        normalized.get("parse_error"),
    )
    row_count = await execute(sql, params)
    inserted = row_count > 0
    logger.info(
        "inbound.persisted",
        provider=normalized["provider"],
        channel=normalized["channel"],
        provider_event_id=normalized["provider_event_id"],
        inserted=inserted,
    )
    return inserted


async def mark_parse_status(inbound_id: str, parse_status: str, parse_error: str | None = None) -> None:
    await execute(
        "UPDATE inbound_messages SET parse_status = ?, parse_error = ? WHERE id = ?",
        (parse_status, parse_error, inbound_id),
    )


async def list_inbound_messages(limit: int = 100) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 500))
    return await query(
        """
        SELECT
            id, channel, provider, provider_event_id, received_at, from_address, to_address,
            subject, body_text, parse_status, parse_error, created_at
        FROM inbound_messages
        ORDER BY datetime(COALESCE(received_at, created_at)) DESC
        LIMIT ?
        """,
        (safe_limit,),
    )
