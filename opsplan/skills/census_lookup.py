"""Census Lookup Skill - Query Census ACS + SVI for TR vulnerability template."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class CensusLookupSkill:

    @kernel_function(name="get_housing_by_tract", description="Get Census ACS housing data for a census tract.")
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

    @kernel_function(
        name="get_tr_vulnerability_profile",
        description="Get the full Team Rubicon vulnerability assessment profile for a census tract. Combines Census ACS and SVI data into the standard TR template: median household income, median home value, median rent, unemployment pct, poverty pct, tenant occupied pct, SVI breakdown by theme, and high-risk population factors.",
    )
    async def get_tr_vulnerability_profile(self, fips_tract: str) -> str:
        census_rows = await query(
            """SELECT total_population, total_households, total_housing_units,
                      median_household_income, median_home_value, median_gross_rent,
                      median_age, owner_occupied, renter_occupied, vacant_units,
                      mobile_home, sf_detached, sf_attached
               FROM census_housing WHERE fips_tract = ?""",
            (fips_tract,),
        )
        svi_rows = await query(
            """SELECT svi_score, t1_percentile, t2_percentile, t3_percentile, t4_percentile,
                      below_poverty_pct, unemployed_pct, per_capita_income, no_hs_diploma_pct,
                      age_65_plus_pct, age_17_minus_pct, disability_pct, single_parent_pct,
                      minority_pct, limited_english_pct,
                      multi_unit_pct, mobile_home_pct, crowding_pct, no_vehicle_pct,
                      group_quarters_pct, population
               FROM svi WHERE fips_tract = ?""",
            (fips_tract,),
        )

        result = {"fips_tract": fips_tract}

        if census_rows:
            c = census_rows[0]
            total_occ = (c.get("owner_occupied") or 0) + (c.get("renter_occupied") or 0)
            tenant_pct = round((c.get("renter_occupied") or 0) / total_occ * 100, 1) if total_occ > 0 else 0
            result["census"] = {
                "median_household_income": c.get("median_household_income"),
                "median_home_value": c.get("median_home_value"),
                "median_contract_rent": c.get("median_gross_rent"),
                "total_population": c.get("total_population"),
                "total_households": c.get("total_households"),
                "total_housing_units": c.get("total_housing_units"),
                "owner_occupied": c.get("owner_occupied"),
                "renter_occupied": c.get("renter_occupied"),
                "tenant_occupied_pct": tenant_pct,
                "vacant_units": c.get("vacant_units"),
                "median_age": c.get("median_age"),
            }
        else:
            result["census"] = {"error": "No Census data for this tract"}

        if svi_rows:
            s = svi_rows[0]
            score = s.get("svi_score") or 0
            rating = "Very High" if score >= 0.9 else "High" if score >= 0.75 else "Moderate" if score >= 0.5 else "Low"
            result["vulnerability"] = {
                "svi_score": s.get("svi_score"),
                "svi_rating": rating,
                "theme_1_socioeconomic": s.get("t1_percentile"),
                "theme_2_household_disability": s.get("t2_percentile"),
                "theme_3_minority_language": s.get("t3_percentile"),
                "theme_4_housing_transport": s.get("t4_percentile"),
                "unemployment_pct": s.get("unemployed_pct"),
                "below_poverty_pct": s.get("below_poverty_pct"),
                "no_hs_diploma_pct": s.get("no_hs_diploma_pct"),
            }
            result["high_risk_populations"] = {
                "median_age": census_rows[0].get("median_age") if census_rows else None,
                "age_65_plus_pct": s.get("age_65_plus_pct"),
                "age_17_minus_pct": s.get("age_17_minus_pct"),
                "disability_pct": s.get("disability_pct"),
                "limited_english_pct": s.get("limited_english_pct"),
                "minority_pct": s.get("minority_pct"),
                "single_parent_pct": s.get("single_parent_pct"),
                "no_vehicle_pct": s.get("no_vehicle_pct"),
                "mobile_home_pct": s.get("mobile_home_pct"),
            }
        else:
            result["vulnerability"] = {"error": "No SVI data for this tract"}
            result["high_risk_populations"] = {}

        return json.dumps(result)
