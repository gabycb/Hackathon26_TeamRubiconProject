"""
SVI Lookup Skill — Query CDC Social Vulnerability Index data.

Registered as a Semantic Kernel native function plugin.
The agent calls this tool to get SVI scores for census tracts.
"""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class SVILookupSkill:
    """Query CDC Social Vulnerability Index by FIPS tract or county."""

    @kernel_function(
        name="get_svi_by_tract",
        description="Get SVI vulnerability scores for a specific census tract. Returns SVI overall score and 4 theme percentiles (socioeconomic, household/disability, minority/language, housing/transportation).",
    )
    async def get_svi_by_tract(self, fips_tract: str) -> str:
        """
        Args:
            fips_tract: 11-digit FIPS census tract code (e.g., '48007950100')
        """
        rows = await query(
            """SELECT fips_tract, county_name, state_name, svi_score,
                      t1_percentile, t2_percentile, t3_percentile, t4_percentile,
                      below_poverty_pct, disability_pct, mobile_home_pct,
                      no_vehicle_pct, limited_english_pct, population
               FROM svi WHERE fips_tract = ?""",
            (fips_tract,),
        )
        if not rows:
            return json.dumps({"error": f"No SVI data found for tract {fips_tract}"})
        return json.dumps(rows[0])

    @kernel_function(
        name="get_svi_by_county",
        description="Get SVI data for all census tracts within a county. Returns a list of tracts with their SVI scores.",
    )
    async def get_svi_by_county(self, state_fips: str, county_fips: str) -> str:
        """
        Args:
            state_fips: 2-digit state FIPS code (e.g., '48' for Texas)
            county_fips: 3-digit county FIPS code (e.g., '007' for Aransas)
        """
        rows = await query(
            """SELECT fips_tract, county_name, svi_score,
                      t1_percentile, t2_percentile, t3_percentile, t4_percentile,
                      mobile_home_pct, population
               FROM svi
               WHERE state_fips = ? AND county_fips = ?
               ORDER BY svi_score DESC""",
            (state_fips, county_fips),
        )
        if not rows:
            return json.dumps({"error": f"No SVI data for county {state_fips}{county_fips}"})
        return json.dumps(rows)
