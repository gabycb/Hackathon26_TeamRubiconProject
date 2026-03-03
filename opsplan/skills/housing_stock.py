"""Housing Stock Skill — Query Hazus GBS + Census housing data."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class HousingStockSkill:

    @kernel_function(name="get_building_stock", description="Get Hazus General Building Stock data for a tract. Returns structure counts, types, stories, foundations, design levels.")
    async def get_building_stock(self, fips_tract: str) -> str:
        rows = await query("SELECT * FROM hazus_gbs WHERE fips_tract = ?", (fips_tract,))
        return json.dumps(rows[0] if rows else {"error": "No Hazus data found"})

    @kernel_function(name="get_hurricane_building_types", description="Get Hazus hurricane model building type details for a tract. Returns roof shape, cover, connections, wall types.")
    async def get_hurricane_building_types(self, fips_tract: str) -> str:
        rows = await query("SELECT * FROM hazus_hurricane WHERE fips_tract = ?", (fips_tract,))
        return json.dumps(rows if rows else {"error": "No hurricane building data found"})

    @kernel_function(name="get_flood_zones", description="Get FEMA flood zone distribution for structures in a tract.")
    async def get_flood_zones(self, fips_tract: str) -> str:
        rows = await query("SELECT * FROM flood_zones WHERE fips_tract = ?", (fips_tract,))
        return json.dumps(rows if rows else {"error": "No flood zone data found"})
