"""NRI Lookup Skill — Query FEMA National Risk Index data."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class NRILookupSkill:

    @kernel_function(name="get_nri_by_county", description="Get NRI risk scores for a county. Returns overall risk, expected annual loss, and hazard-specific scores.")
    async def get_nri_by_county(self, state_fips: str, county_fips: str) -> str:
        rows = await query("SELECT * FROM nri WHERE fips = ?", (state_fips + county_fips,))
        return json.dumps(rows[0] if rows else {"error": "No NRI data found"})

    @kernel_function(name="get_nri_by_tract", description="Get NRI risk scores for a specific census tract.")
    async def get_nri_by_tract(self, fips_tract: str) -> str:
        rows = await query("SELECT * FROM nri WHERE fips = ?", (fips_tract,))
        return json.dumps(rows[0] if rows else {"error": "No NRI data found"})
