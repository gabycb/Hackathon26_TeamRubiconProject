"""
Inbound message parsing helpers.

Raw ingest first. Optional parser projects structured values into field_assessments
when minimum required fields are present.
"""
from __future__ import annotations

import json
import re
import uuid
from typing import Any

from data.db import execute


def _extract(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def parse_assessment_from_text(body_text: str | None) -> dict[str, Any] | None:
    """
    Parse lightly structured key/value text.

    Expected keys (case-insensitive):
    - fips / fips_tract
    - structure_id (optional)
    - damage_pct (optional)
    - notes (optional; otherwise full message body)
    """
    if not body_text:
        return None

    fips_tract = _extract(r"(?:fips|fips_tract)\s*[:=]\s*([0-9]{11})", body_text)
    if not fips_tract:
        return None

    structure_id = _extract(r"structure_id\s*[:=]\s*([A-Za-z0-9._-]+)", body_text)
    damage_pct_raw = _extract(r"damage_pct\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)", body_text)
    notes = _extract(r"notes\s*[:=]\s*(.+)", body_text) or body_text
    damage_pct = float(damage_pct_raw) if damage_pct_raw else None

    if damage_pct is None:
        damage_classification = "unknown"
    elif damage_pct >= 75:
        damage_classification = "destroyed"
    elif damage_pct >= 50:
        damage_classification = "major"
    elif damage_pct >= 25:
        damage_classification = "moderate"
    elif damage_pct > 0:
        damage_classification = "minor"
    else:
        damage_classification = "none"

    return {
        "assessment_id": str(uuid.uuid4()),
        "structure_id": structure_id,
        "fips_tract": fips_tract,
        "notes": notes,
        "overall_damage_pct": damage_pct,
        "damage_classification": damage_classification,
    }


async def project_to_field_assessment(parsed: dict[str, Any], source: dict[str, Any]) -> None:
    """Insert parsed assessment into field_assessments table."""
    await execute(
        """
        INSERT INTO field_assessments (
            assessment_id, structure_id, fips_tract,
            notes, overall_damage_pct, damage_classification,
            tags_situational, assessed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            parsed["assessment_id"],
            parsed.get("structure_id"),
            parsed["fips_tract"],
            parsed.get("notes"),
            parsed.get("overall_damage_pct"),
            parsed.get("damage_classification"),
            json.dumps(["inbound_ingest"]),
            source.get("from_address"),
        ),
    )
