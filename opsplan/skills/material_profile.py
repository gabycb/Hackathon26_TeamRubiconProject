"""Material Profile Skill — Building type + era → typical materials."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class MaterialProfileSkill:

    @kernel_function(name="get_material_profile", description="Get typical construction materials for a building type, era, and region. Returns roofing, framing, walls, foundation, windows.")
    async def get_material_profile(self, building_type: str, era: str, region: str = "gulf_coast") -> str:
        rows = await query(
            "SELECT * FROM materials_lookup WHERE building_type = ? AND era = ? AND region = ?",
            (building_type, era, region),
        )
        return json.dumps(rows[0] if rows else {"error": "No material profile found"})
