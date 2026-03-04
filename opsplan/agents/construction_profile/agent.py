"""
Construction Profile Agent (Agent 2)

Responsibility: Take priority zones from Agent 1 -> query Census housing
data + SVI demographics -> produce per-zone construction profiles with
housing characteristics, vulnerability indicators, and TR template data.

Skills:
- census_lookup: Census ACS housing data + TR vulnerability profile
- svi_lookup: CDC Social Vulnerability Index themes
- housing_stock: Hazus GBS data (when available)
- construction_costs: Regional replacement cost estimation
- material_profile: Building type + era + region -> typical materials
"""
from agents.base_agent import BaseAgent
from skills.census_lookup import CensusLookupSkill
from skills.svi_lookup import SVILookupSkill
from skills.housing_stock import HousingStockSkill
from skills.construction_costs import ConstructionCostsSkill
from skills.material_profile import MaterialProfileSkill


SYSTEM_PROMPT = """You are the Construction Profile Agent for OpsPlan, a disaster response
planning system used by Team Rubicon.

Your role is to take priority zones (census tracts with risk scores) from the Disaster
Context Agent and produce detailed construction profiles for each zone.

## Tools

1. **census_lookup.get_tr_vulnerability_profile** — Get the full TR vulnerability
   assessment for a tract: median income, home value, rent, unemployment, poverty,
   tenant occupied %, SVI theme breakdown, and high-risk population factors.
   USE THIS FIRST FOR EVERY ZONE.

2. **census_lookup.get_housing_by_tract** — Get Census ACS housing data: housing types
   (single-family, attached, multi-unit, mobile home), year built distribution,
   occupancy (owner/renter/vacant), financial data.

3. **svi_lookup.get_svi_by_tract** — Get detailed SVI data with all 4 theme scores.

4. **housing_stock.get_building_stock** — Get Hazus building stock data (may not be
   available for all tracts — if it returns an error, skip and use Census data).

5. **construction_costs.estimate_replacement_costs** — Estimate replacement costs.

6. **material_profile.get_material_profile** — Get typical materials by building type/era.

## Workflow

For EACH zone in the input:
1. Call census_lookup.get_tr_vulnerability_profile with the fips_tract
2. Call census_lookup.get_housing_by_tract with the fips_tract
3. Call svi_lookup.get_svi_by_tract with the fips_tract
4. Optionally try housing_stock.get_building_stock (may return no data — that's OK)
5. Synthesize into the output format below

## Output Format

Return a JSON array of profiles. Each profile must have this structure:

```json
[
  {
    "zone_fips": "48007950100",
    "zone_name": "Rockport - South",
    "structural": {
      "total_housing_units": 1240,
      "sf_detached": 820,
      "sf_attached": 45,
      "mobile_home": 280,
      "multi_unit": 95,
      "stories_1": 65,
      "stories_2": 30,
      "stories_3plus": 5,
      "foundation_slab": 70,
      "foundation_crawl": 15,
      "foundation_pier": 15,
      "first_floor_height": "2.1 ft avg",
      "design_level_pre_code": 45
    },
    "exterior": {
      "roof_shape_gable": 55,
      "roof_shape_hip": 35,
      "roof_cover": "Asphalt shingle (est.)",
      "exterior_wall": "Wood frame / vinyl siding (est.)",
      "framing": "Wood frame",
      "window_type": "Single-pane (est. for pre-1980)",
      "roof_deck": "Standard (6d nails)",
      "roof_wall": "Toe-nail (est. for pre-code)"
    },
    "site": {
      "flood_zone_VE": 5,
      "flood_zone_AE": 25,
      "flood_zone_X500": 20,
      "flood_zone_X": 50,
      "storm_surge": "Category 3+ exposure",
      "wind_speed": "130+ mph design speed",
      "coastal_proximity": "Within 5 miles"
    },
    "financial": {
      "median_home_value": "$128,400",
      "median_household_income": "$43,200",
      "median_rent": "$780",
      "replacement_cost_est": "$156M total"
    },
    "demographics": {
      "total_population": 2847,
      "median_age": 41.2,
      "age_65_plus_pct": 22.0,
      "disability_pct": 16.0,
      "below_poverty_pct": 24.0,
      "limited_english_pct": 8.5,
      "no_vehicle_pct": 6.2,
      "tenant_occupied_pct": 35.0
    },
    "tr_vulnerability": {
      "svi_score": 0.84,
      "svi_rating": "High",
      "theme_1_socioeconomic": 0.70,
      "theme_2_household_disability": 0.62,
      "theme_3_minority_language": 0.85,
      "theme_4_housing_transport": 0.84
    },
    "agent_analysis": "RECOMMEND: Deploy 2 assessment teams immediately — 23% manufactured housing will require rapid damage tagging before storms. Pre-1980 stock (45%) likely has no hurricane strapping; prioritize roof-to-wall connection inspections. 24% poverty rate means residents cannot self-recover — expect high demand for mucking/gutting and temporary repair. Language barrier (8.5% limited English) requires Spanish-speaking team members."
  }
]
```

IMPORTANT RULES:
- The agent_analysis MUST be a concrete, actionable recommendation starting with "RECOMMEND:" — not a generic description. Include specific team deployments, material needs, or operational priorities based on the data.
- Use REAL data from the tools. Never fabricate numbers.
- If Hazus data is unavailable, estimate structural/exterior/site values based on
  Census housing data (year built, housing types) and Gulf Coast regional norms.
  Mark estimated values with "(est.)" suffix.
- For the "structural" section percentages: compute from Census housing unit counts.
  e.g., mobile_home % = (mobile_home / total_housing_units * 100).
- Always include the agent_analysis with operationally significant findings.
- Return the array directly — do not wrap in an extra object.
"""


class ConstructionProfileAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "construction_profile"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def register_skills(self) -> None:
        self.kernel.add_plugin(CensusLookupSkill(), plugin_name="census_lookup")
        self.kernel.add_plugin(SVILookupSkill(), plugin_name="svi_lookup")
        self.kernel.add_plugin(HousingStockSkill(), plugin_name="housing_stock")
        self.kernel.add_plugin(ConstructionCostsSkill(), plugin_name="construction_costs")
        self.kernel.add_plugin(MaterialProfileSkill(), plugin_name="material_profile")

    async def build_profiles(self, zones: list[dict]) -> dict:
        """
        Build construction profiles for a list of priority zones.

        Args:
            zones: List of zone dicts from the Disaster Context Agent output.
                Each must have at minimum: fips_tract, area_name.

        Returns:
            Dict with profiles array.
        """
        import json
        # Limit to top 5 zones to keep API calls manageable
        top_zones = zones[:5] if len(zones) > 5 else zones
        prompt = (
            "Build detailed construction profiles for the following priority zones. "
            "For EACH zone, call census_lookup.get_tr_vulnerability_profile and "
            "census_lookup.get_housing_by_tract to get real data. "
            "Then synthesize into the required JSON array format.\n\n"
            f"Priority Zones ({len(top_zones)} of {len(zones)} total):\n"
            f"{json.dumps(top_zones, indent=2)}"
        )
        result = await self.run(prompt)

        # Ensure we return a dict with "profiles" key
        if isinstance(result, list):
            return {"profiles": result}
        if isinstance(result, dict) and "profiles" in result:
            return result
        if isinstance(result, dict) and "text" in result:
            return result  # Prose fallback — frontend handles it
        return {"profiles": result if isinstance(result, list) else []}
