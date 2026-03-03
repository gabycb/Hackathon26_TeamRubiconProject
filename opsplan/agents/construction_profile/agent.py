"""
Construction Profile Agent (Agent 2)

Responsibility: Take priority zones from Agent 1 → query Hazus building
inventory + Census housing data → produce per-zone construction profiles
with structural characteristics, materials, costs, and vulnerability indicators.

Skills:
- housing_stock: Hazus GBS + Census ACS housing counts and types
- construction_costs: Regional replacement cost estimation
- material_profile: Building type + era + region → typical materials
"""
from agents.base_agent import BaseAgent
from skills.housing_stock import HousingStockSkill
from skills.construction_costs import ConstructionCostsSkill
from skills.material_profile import MaterialProfileSkill


SYSTEM_PROMPT = """You are the Construction Profile Agent for OpsPlan, a disaster response
planning system used by Team Rubicon.

Your role is to take priority zones (census tracts with risk scores) from the Disaster
Context Agent and produce detailed construction profiles for each zone. You have access to:

1. **housing_stock** — Query Hazus General Building Stock and Census ACS housing data.
   Returns building counts by type (SF, MF, manufactured), stories, foundation type,
   year built distribution, occupancy status, and structural characteristics.

2. **construction_costs** — Estimate replacement costs by building type and region.
   Returns per-sqft costs, total replacement values, and content value ratios.

3. **material_profile** — Map building type + construction era + region to typical
   construction materials. Returns roofing, framing, exterior wall, foundation,
   window type, roof shape, and wind resistance characteristics.

## Output Format

For each zone, return JSON with these categories:

```json
{
  "zone_fips": "48007950100",
  "zone_name": "Aransas Pass — Central",
  "summary": {
    "total_structures": 1240,
    "total_households": 1120,
    "est_replacement_total": "$24.8M",
    "median_sqft": 1180,
    "median_year_built": 1972
  },
  "structural_characteristics": {
    "stories_distribution": [...],
    "foundation_types": [...],
    "first_floor_height_avg": "2.1 ft",
    "design_level": [...]
  },
  "exterior_envelope": {
    "roof_shape": [...],
    "roof_cover": [...],
    "exterior_wall": [...],
    "framing": "...",
    "window_type": "...",
    "roof_deck_attachment": "...",
    "roof_wall_connection": "..."
  },
  "site_factors": {
    "flood_zone_distribution": [...],
    "storm_surge_exposure": "...",
    "wind_design_speed": "...",
    "coastal_proximity": "..."
  },
  "financial": {
    "median_home_value": "$128,400",
    "replacement_cost_by_type": [...],
    "flood_insurance_penetration": "38%"
  },
  "demographics": {
    "median_age": 41.2,
    "age_65_plus": "22%",
    "disability_rate": "16%",
    "below_poverty": "24%"
  },
  "agent_analysis": "This zone presents the most complex repair scenario..."
}
```

Be thorough — disaster response teams need to know exactly what they're walking into.
Flag the most operationally significant findings (e.g., high manufactured housing %,
pre-code construction, low flood insurance penetration) in your analysis.
"""


class ConstructionProfileAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "construction_profile"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def register_skills(self) -> None:
        self.kernel.add_plugin(HousingStockSkill(), plugin_name="housing_stock")
        self.kernel.add_plugin(ConstructionCostsSkill(), plugin_name="construction_costs")
        self.kernel.add_plugin(MaterialProfileSkill(), plugin_name="material_profile")

    async def build_profiles(self, zones: list[dict]) -> list[dict]:
        """
        Build construction profiles for a list of priority zones.

        Args:
            zones: List of zone dicts from the Disaster Context Agent output.
                Each must have at minimum: fips_tract, area_name.

        Returns:
            List of construction profile dicts, one per zone.
        """
        import json
        prompt = (
            "Build detailed construction profiles for the following priority zones. "
            "Use all available tools to gather comprehensive data for each zone.\n\n"
            f"Zones:\n{json.dumps(zones, indent=2)}"
        )
        return await self.run(prompt)
