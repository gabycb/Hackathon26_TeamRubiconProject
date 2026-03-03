"""Census Lookup Skill — Query Census ACS 5-Year housing and demographic data."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class CensusLookupSkill:

    @kernel_function(name="get_housing_by_tract", description="Get Census ACS housing data for a census tract. Returns housing types, year built, occupancy, financial data.")
    async def get_housing_by_tract(self, fips_tract: str) -> str:
        rows = await query("SELECT * FROM census_housing WHERE fips_tract = ?", (fips_tract,))
        return json.dumps(rows[0] if rows else {"error": "No Census data found"})

    @kernel_function(name="get_housing_by_county", description="Get Census ACS housing summary for all tracts in a county.")
    async def get_housing_by_county(self, state_fips: str, county_fips: str) -> str:
        rows = await query(
            "SELECT * FROM census_housing WHERE state_fips = ? AND county_fips = ? ORDER BY total_population DESC",
            (state_fips, county_fips),
        )
        return json.dumps(rows if rows else {"error": "No Census data found"})
