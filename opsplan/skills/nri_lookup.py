"""NRI Lookup Skill — Query FEMA National Risk Index data."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class NRILookupSkill:

    @kernel_function(
        name="get_nri_by_tract",
        description="Get NRI risk scores for a specific census tract. Returns risk_score (0-100), risk_rating, expected_annual_loss (dollars), and hazard-specific scores.",
    )
    async def get_nri_by_tract(self, fips_tract: str) -> str:
        """
        Args:
            fips_tract: 11-digit FIPS census tract code (e.g., '48007950101')
        """
        rows = await query("SELECT * FROM nri WHERE fips = ?", (fips_tract,))
        if not rows:
            return json.dumps({"error": f"No NRI data found for tract {fips_tract}"})
        row = rows[0]
        # Add normalized score (0-1) for the priority scoring engine
        row["nri_score_normalized"] = round(row.get("risk_score", 0) / 100.0, 4) if row.get("risk_score") else 0
        return json.dumps(row)

    @kernel_function(
        name="get_nri_by_county",
        description="Get NRI risk scores for ALL census tracts in a county. Returns a list of tracts with risk scores. Use state_fips + county_fips to form the 5-digit prefix.",
    )
    async def get_nri_by_county(self, state_fips: str, county_fips: str) -> str:
        """
        Args:
            state_fips: 2-digit state FIPS code (e.g., '48' for Texas)
            county_fips: 3-digit county FIPS code (e.g., '007' for Aransas)
        """
        prefix = state_fips + county_fips.zfill(3)
        rows = await query(
            """SELECT fips, name, risk_score, risk_rating, expected_annual_loss,
                      social_vulnerability_score, community_resilience_score,
                      hurricane_eal, tornado_eal, flood_eal
               FROM nri WHERE fips LIKE ?
               ORDER BY risk_score DESC""",
            (prefix + "%",),
        )
        if not rows:
            return json.dumps({"error": f"No NRI data for county prefix {prefix}"})
        # Add normalized scores
        for row in rows:
            row["nri_score_normalized"] = round(row.get("risk_score", 0) / 100.0, 4) if row.get("risk_score") else 0
        return json.dumps(rows)
