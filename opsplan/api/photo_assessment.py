"""
Field Assessment API — Two-stage damage analysis pipeline.

Stage 1: Azure AI Vision 4.0 — captions, tags, objects, OCR
Stage 2: GPT-4o with vision — structured damage classification

Images are resized to max 1500px before sending to stay under API limits.
"""
import io
import json
import uuid
import base64
import httpx
import structlog
from datetime import datetime
from PIL import Image
from config.settings import settings
from data.db import execute, query

logger = structlog.get_logger()

MAX_IMAGE_DIMENSION = 1500  # px — keeps payload under 4MB
JPEG_QUALITY = 80


def _resize_image_b64(image_b64: str, content_type: str = "image/jpeg") -> tuple[bytes, str]:
    """Resize image to fit within API limits. Returns (jpeg_bytes, 'image/jpeg')."""
    raw_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(raw_bytes))

    # Convert RGBA/palette to RGB
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")

    # Resize if too large
    w, h = img.size
    if max(w, h) > MAX_IMAGE_DIMENSION:
        ratio = MAX_IMAGE_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    jpeg_bytes = buf.getvalue()

    logger.info("image.resized", original_size=len(raw_bytes), new_size=len(jpeg_bytes),
                original_dims=f"{w}x{h}", new_dims=f"{img.size[0]}x{img.size[1]}")
    return jpeg_bytes, "image/jpeg"


DAMAGE_PROMPT = """You are a disaster damage assessment AI for Team Rubicon field operations.

IMPORTANT: First determine if any man-made structure is visible.
If NO structure is visible, return: {{"structure_detected": false, "damage_classification": "none", "damage_percentage": 0, "components": {{}}, "hazards": [], "recommended_actions": ["Re-photograph — no structure visible."], "confidence": 0.95, "summary": "No structure detected."}}

{vision_context}

If a structure IS visible, return ONLY valid JSON:
{{
  "structure_detected": true,
  "structure_type": "single_family|multi_family|mobile_home|commercial|utility|other",
  "damage_classification": "destroyed|major|minor|affected|none",
  "damage_percentage": 0-100,
  "components": {{
    "roof": {{"damage": "none|minor|moderate|severe|destroyed", "notes": "..."}},
    "walls": {{"damage": "none|minor|moderate|severe|destroyed", "notes": "..."}},
    "foundation": {{"damage": "none|minor|moderate|severe|destroyed", "notes": "..."}},
    "windows": {{"damage": "none|minor|moderate|severe|destroyed", "notes": "..."}},
    "utilities": {{"damage": "none|minor|moderate|severe|destroyed", "notes": "..."}}
  }},
  "hazards": ["visible hazards"],
  "recommended_actions": ["immediate actions"],
  "estimated_repair_category": "emergency_tarp|debris_clearance|mucking_gutting|structural_repair|full_rebuild|none",
  "confidence": 0.0-1.0,
  "summary": "One sentence damage summary.",
  "detected_objects": ["key objects identified"],
  "scene_description": "Brief scene description"
}}

Confidence: 0.9+ clear full view, 0.7-0.9 partial, 0.5-0.7 obstructed, <0.5 poor.
Be conservative — only report damage you can SEE.
"""


async def _stage1_azure_vision(image_b64: str, content_type: str) -> dict | None:
    """Stage 1: Azure AI Vision 4.0 Image Analysis."""
    endpoint = settings.azure_vision.endpoint
    api_key = settings.azure_vision.api_key

    if not endpoint or not api_key:
        logger.info("vision.stage1.skip", reason="not configured")
        return None

    # Resize image to stay under 4MB limit
    jpeg_bytes, _ = _resize_image_b64(image_b64, content_type)

    url = f"{endpoint.rstrip('/')}/computervision/imageanalysis:analyze"
    params = {
        "api-version": "2024-02-01",
        "features": "caption,tags,objects,read",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                params=params,
                content=jpeg_bytes,
                headers={
                    "Ocp-Apim-Subscription-Key": api_key,
                    "Content-Type": "image/jpeg",
                },
            )
            if resp.status_code != 200:
                error_body = resp.text[:500]
                logger.error("vision.stage1.http_error", status=resp.status_code, body=error_body)
                return None

            data = resp.json()
            result = {
                "caption": data.get("captionResult", {}).get("text", ""),
                "caption_confidence": data.get("captionResult", {}).get("confidence", 0),
                "tags": [t["name"] for t in data.get("tagsResult", {}).get("values", []) if t.get("confidence", 0) > 0.5],
                "objects": [
                    {
                        "name": o.get("tags", [{}])[0].get("name", "") if o.get("tags") else "",
                        "confidence": o.get("tags", [{}])[0].get("confidence", 0) if o.get("tags") else 0,
                        "bbox": o.get("boundingBox", {}),
                    }
                    for o in data.get("objectsResult", {}).get("values", [])
                ],
                "read_text": [
                    line.get("text", "")
                    for block in data.get("readResult", {}).get("blocks", [])
                    for line in block.get("lines", [])
                ],
            }
            logger.info("vision.stage1.complete", caption=result["caption"], tag_count=len(result["tags"]))
            return result

    except Exception as e:
        logger.error("vision.stage1.error", error=str(e))
        return None


async def _stage2_gpt4o_assess(image_b64: str, content_type: str, vision_context: str) -> dict:
    """Stage 2: GPT-4o with vision for structured damage assessment."""
    endpoint = settings.azure_openai.endpoint
    api_key = settings.azure_openai.api_key
    deployment = settings.azure_openai.deployment_name
    api_version = settings.azure_openai.api_version

    if not endpoint or not api_key:
        logger.warning("vision.stage2.no_config")
        return _mock_assessment()

    # Resize for GPT-4o (base64 in JSON — needs to be small)
    jpeg_bytes, _ = _resize_image_b64(image_b64, content_type)
    small_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")

    url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    prompt = DAMAGE_PROMPT.replace("{vision_context}", vision_context)

    payload = {
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": [
                {"type": "text", "text": "Analyze this structure photo for disaster damage assessment."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{small_b64}", "detail": "high"}},
            ]},
        ],
        "max_tokens": 1200,
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers={"api-key": api_key, "Content-Type": "application/json"})
            if resp.status_code != 200:
                error_body = resp.text[:500]
                logger.error("vision.stage2.http_error", status=resp.status_code, body=error_body)
                return {"error": f"GPT-4o error {resp.status_code}: {error_body[:200]}", **_mock_assessment()}

            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            clean = content.strip()
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0].strip()
            elif clean.startswith("```"):
                clean = clean[3:]
                if clean.endswith("```"): clean = clean[:-3]
                clean = clean.strip()
            result = json.loads(clean)
            logger.info("vision.stage2.complete", cls=result.get("damage_classification"))
            return result
    except json.JSONDecodeError:
        logger.error("vision.stage2.parse_error", content=content[:300])
        return {"error": "Failed to parse AI response", **_mock_assessment()}
    except Exception as e:
        logger.error("vision.stage2.error", error=str(e))
        return {"error": str(e), **_mock_assessment()}


async def analyze_photo_azure_vision(image_b64: str, content_type: str = "image/jpeg") -> dict:
    """Two-stage pipeline: Azure AI Vision → GPT-4o."""
    vision_result = await _stage1_azure_vision(image_b64, content_type)

    vision_context = ""
    if vision_result:
        vision_context = (
            f"Azure AI Vision pre-analysis:\n"
            f"- Caption: \"{vision_result['caption']}\" (confidence: {vision_result['caption_confidence']:.2f})\n"
            f"- Detected tags: {', '.join(vision_result['tags'][:20])}\n"
            f"- Detected objects: {', '.join(o['name'] for o in vision_result['objects'][:10])}\n"
            f"- OCR text found: {'; '.join(vision_result['read_text'][:5]) if vision_result['read_text'] else 'none'}\n"
            f"\nUse this context to improve your assessment. "
            f"If caption/tags indicate no building, set structure_detected=false."
        )
    else:
        vision_context = "No Azure AI Vision pre-analysis available. Assess the image directly."

    result = await _stage2_gpt4o_assess(image_b64, content_type, vision_context)

    if vision_result:
        result["vision_tags"] = vision_result["tags"]
        result["vision_caption"] = vision_result["caption"]
        result["vision_objects"] = vision_result["objects"]
        result["ocr_text"] = vision_result["read_text"]
        result["pipeline"] = "azure_vision_4.0 + gpt-4o"
    else:
        result["pipeline"] = "gpt-4o_only"

    return result


async def analyze_multiple_photos(images: list) -> dict:
    if not images:
        return {"error": "No images provided"}

    results = []
    for img in images:
        r = await analyze_photo_azure_vision(img["image"], img.get("content_type", "image/jpeg"))
        results.append(r)

    structural = [r for r in results if r.get("structure_detected", True)]
    if not structural:
        return results[0] if results else _mock_assessment()

    severity = {"none": 0, "affected": 1, "minor": 2, "major": 3, "destroyed": 4}
    worst = max(structural, key=lambda r: severity.get(r.get("damage_classification", "none"), 0))

    all_hazards, all_actions, all_tags = [], [], []
    for r in structural:
        all_hazards.extend(r.get("hazards", []))
        all_actions.extend(r.get("recommended_actions", []))
        all_tags.extend(r.get("vision_tags", []))

    return {
        **worst,
        "hazards": list(dict.fromkeys(all_hazards)),
        "recommended_actions": list(dict.fromkeys(all_actions)),
        "vision_tags": list(dict.fromkeys(all_tags)),
        "photos_analyzed": len(images),
        "photos_with_structure": len(structural),
        "confidence": min(r.get("confidence", 0.5) for r in structural),
    }


async def save_assessment(assessment: dict) -> dict:
    assessment_id = assessment.get("assessment_id", str(uuid.uuid4()))
    await execute(
        """INSERT OR REPLACE INTO field_assessments
        (assessment_id, fips_tract, latitude, longitude, timestamp,
         tags_hazards, tags_damage, notes,
         overall_damage_pct, damage_classification, damage_by_component,
         estimated_repair_cost, materials_required, assessed_by, photo_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (assessment_id, assessment.get("fips_tract", ""),
         assessment.get("latitude"), assessment.get("longitude"),
         assessment.get("timestamp", datetime.now().isoformat()),
         json.dumps(assessment.get("hazards", [])),
         json.dumps(assessment.get("tags_damage", [])),
         assessment.get("notes", ""),
         assessment.get("damage_percentage", 0),
         assessment.get("damage_classification", "unknown"),
         json.dumps(assessment.get("components", {})),
         assessment.get("estimated_repair_cost"),
         json.dumps(assessment.get("materials_required", [])),
         assessment.get("assessed_by", "field_team"),
         assessment.get("photo_count", 1)),
    )
    logger.info("assessment.saved", id=assessment_id)
    return {"assessment_id": assessment_id, "status": "saved"}


async def get_zone_assessments(fips_tract: str) -> list:
    rows = await query(
        "SELECT * FROM field_assessments WHERE fips_tract = ? ORDER BY created_at DESC",
        (fips_tract,),
    )
    return rows


def _mock_assessment() -> dict:
    return {
        "_mock": True,
        "structure_detected": True,
        "structure_type": "single_family",
        "damage_classification": "major",
        "damage_percentage": 62,
        "components": {
            "roof": {"damage": "severe", "notes": "Large section of shingles missing, decking exposed."},
            "walls": {"damage": "moderate", "notes": "Vinyl siding stripped on windward side."},
            "foundation": {"damage": "none", "notes": "Slab foundation intact."},
            "windows": {"damage": "severe", "notes": "3 of 5 visible windows broken."},
            "utilities": {"damage": "minor", "notes": "Power line intact but utility pole leaning."},
        },
        "hazards": ["Exposed roof decking", "Broken glass — PPE required", "Leaning utility pole"],
        "recommended_actions": ["Emergency tarp — south-facing roof", "Board broken windows", "Flag utility pole"],
        "estimated_repair_category": "emergency_tarp",
        "confidence": 0.85,
        "summary": "Major damage — severe roof and window damage. Foundation intact. Recommend immediate tarping.",
        "pipeline": "mock_demo",
    }
