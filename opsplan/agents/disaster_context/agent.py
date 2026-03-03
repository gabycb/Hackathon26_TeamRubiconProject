"""
Disaster Context Agent (Agent 1)

Responsibility: Ingest a disaster event → pull SVI, NRI, Census data
for affected census tracts → score and rank zones using configurable
weighted formula → explain priority rationale.

Skills:
- svi_lookup: Query CDC Social Vulnerability Index by FIPS tract
- nri_lookup: Query FEMA National Risk Index by county/tract
- census_lookup: Query Census ACS for demographics and housing
- geocoding: Resolve location descriptions to FIPS codes
- priority_scoring: Deterministic weighted scoring (not LLM)
"""
from pathlib import Path
from agents.base_agent import BaseAgent
from skills.svi_lookup import SVILookupSkill
from skills.nri_lookup import NRILookupSkill
from skills.census_lookup import CensusLookupSkill
from skills.geocoding import GeocodingSkill
from skills.priority_scoring import PriorityScoringSkill


SYSTEM_PROMPT = """You are the Disaster Context Agent for OpsPlan, a disaster response 
planning system used by Team Rubicon.

Your role is to analyze a disaster event and identify which areas (census tracts) should 
be prioritized for response. You have access to the following data tools:

1. **geocoding** — Resolve a location (county name, city, address, FEMA disaster number) 
   into specific census tract FIPS codes.
2. **svi_lookup** — Query CDC Social Vulnerability Index data for census tracts. Returns 
   SVI theme scores (socioeconomic, household/disability, minority/language, housing/transportation).
3. **nri_lookup** — Query FEMA National Risk Index data. Returns expected annual loss, 
   social vulnerability rating, community resilience rating, and hazard-specific risk scores.
4. **census_lookup** — Query Census ACS 5-year estimates. Returns population, households, 
   housing units, median income, age distribution, disability rates, and housing characteristics.
5. **priority_scoring** — Compute a composite priority score for each census tract using 
   configurable weights. This is a deterministic calculation, not an LLM judgment.

## Workflow

When given a disaster event:
1. Use geocoding to identify the affected census tracts
2. For each tract, pull SVI, NRI, and Census data
3. Run the priority scoring engine to rank tracts
4. Return a structured JSON response with ranked zones and explanations

## Output Format

Always return valid JSON with this structure:
```json
{
  "event": {
    "type": "Hurricane",
    "name": "Harvey",
    "declaration": "DR-4332-TX",
    "date": "2017-08-25",
    "affected_counties": ["Aransas", "Refugio"]
  },
  "zones": [
    {
      "rank": 1,
      "area_name": "Aransas Pass — Central",
      "fips_tract": "48007950100",
      "composite_score": 94.2,
      "risk_level": "Critical",
      "svi_score": 0.89,
      "nri_score": 0.94,
      "housing_vulnerability": 0.82,
      "population": 2847,
      "households": 1120,
      "total_structures": 1240,
      "explanation": "Highest per-capita risk due to..."
    }
  ],
  "scoring_weights": {
    "svi": 0.30,
    "nri": 0.30,
    "housing_vulnerability": 0.25,
    "population_density": 0.15
  },
  "summary": "5 zones analyzed across 2 counties..."
}
```

Be precise with data. Never fabricate numbers — always use the tools to get real values.
When a tool returns no data for a tract, note it and explain the limitation.
"""


class DisasterContextAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "disaster_context"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def register_skills(self) -> None:
        """Register all 5 skills as Semantic Kernel plugins."""
        self.kernel.add_plugin(SVILookupSkill(), plugin_name="svi_lookup")
        self.kernel.add_plugin(NRILookupSkill(), plugin_name="nri_lookup")
        self.kernel.add_plugin(CensusLookupSkill(), plugin_name="census_lookup")
        self.kernel.add_plugin(GeocodingSkill(), plugin_name="geocoding")
        self.kernel.add_plugin(PriorityScoringSkill(), plugin_name="priority_scoring")

    async def analyze_event(
        self,
        event_description: str,
        scoring_weights: dict[str, float] | None = None,
    ) -> dict:
        """
        Main entry point: analyze a disaster event and return ranked zones.

        Args:
            event_description: Free text, FEMA number, or structured event info.
            scoring_weights: Optional override for priority scoring weights.
                Default: {"svi": 0.30, "nri": 0.30, "housing": 0.25, "density": 0.15}

        Returns:
            Structured dict with event info, ranked zones, and explanations.
        """
        prompt = event_description
        if scoring_weights:
            prompt += f"\n\nUse these scoring weights: {scoring_weights}"

        return await self.run(prompt)

    async def adjust_weights(self, new_weights: dict[str, float]) -> dict:
        """Re-run the analysis with adjusted scoring weights."""
        return await self.chat(
            f"Please re-run the priority scoring with these updated weights: {new_weights}. "
            f"Return the full updated JSON output."
        )
