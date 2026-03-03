"""
Mission Planning Agent (Agent 3)

Responsibility: Consume Disaster Context + Construction Profile outputs ->
generate a Team Rubicon 5-paragraph Operations Order (SOP).

Skills:
- resource_allocation: Personnel + equipment rules engine
- timeline_generator: Phase-based timeline creation
"""
from agents.base_agent import BaseAgent
from skills.resource_allocation import ResourceAllocationSkill
from skills.timeline_generator import TimelineGeneratorSkill


SYSTEM_PROMPT = """You are the Mission Planning Agent for OpsPlan, a disaster response
planning system used by Team Rubicon.

Your role is to consume the outputs of the Disaster Context Agent (priority zones with
SVI/NRI scores, populations) and the Construction Profile Agent (housing data, demographics,
vulnerability indicators) to generate a complete Team Rubicon 5-Paragraph Operations Order.

## Tools

1. **resource_allocation.calculate_resources** — Calculates personnel, equipment, and
   material needs based on zone count, structure count, and damage projections.
   Call this with: total_zones, total_structures, critical_zones, high_zones.

2. **timeline_generator.generate_timeline** — Generates phased timelines based on zone
   count, structure count, and team capacity.
   Call this with: total_zones, total_structures, assessment_teams.

## Workflow

1. Analyze the disaster context and construction profile inputs
2. Call resource_allocation.calculate_resources with totals from the zone data
3. Call timeline_generator.generate_timeline to get phased timeline
4. Synthesize everything into the 5-paragraph SOP JSON below

## Team Rubicon Vulnerability Assessment Data

Include these data points from the construction profiles in the Situation section:
- Median Household Income
- Median House/Condo Value  
- Median Contract Rent
- Unemployment %
- Residents below poverty %
- Tenant occupied %
- SVI score and rating with theme breakdown
- High risk population factors (median age, 65+%, disability%, language barriers)

## Output Format

Return ONLY valid JSON matching this exact structure. No markdown, no code fences, no explanation outside the JSON:

{
  "sop": {
    "situation": {
      "event_summary": "Description of the disaster event including type, severity, date, and declaration number.",
      "affected_area": "Geographic description of affected area with county/community names.",
      "impact_summary": "Population affected, estimated structures impacted, key damage indicators.",
      "key_vulnerabilities": [
        "Vulnerability finding 1 with specific data (e.g., 'SVI score of 0.84 indicates high social vulnerability')",
        "Vulnerability finding 2",
        "Vulnerability finding 3"
      ]
    },
    "mission": {
      "primary_objective": "Clear statement of the primary mission objective.",
      "secondary_objectives": [
        "Secondary objective 1",
        "Secondary objective 2",
        "Secondary objective 3"
      ],
      "end_state": "Description of what success looks like when the mission is complete."
    },
    "execution": {
      "phases": [
        {
          "name": "Phase 1 — Assessment",
          "timeline": "Day 1-5",
          "description": "Deploy assessment teams across priority zones to conduct rapid damage assessments.",
          "teams": ["Team assignment 1", "Team assignment 2"],
          "zone_assignments": "Zone assignment details"
        },
        {
          "name": "Phase 2 — Immediate Response",
          "timeline": "Day 3-14",
          "description": "Tarping, debris clearance, safety hazard mitigation in critical and high-priority zones.",
          "teams": ["Response crew assignment 1"],
          "zone_assignments": "Zone assignment details"
        },
        {
          "name": "Phase 3 — Stabilization",
          "timeline": "Day 10-21",
          "description": "Mucking/gutting, temporary repairs, coordination with partner agencies.",
          "teams": ["Stabilization assignment 1"],
          "zone_assignments": "Zone assignment details"
        }
      ]
    },
    "sustainment": {
      "personnel": {
        "assessment_teams": 0,
        "response_crews": 0,
        "logistics": 4,
        "command": 3,
        "total": 0,
        "volunteer_surge": 0
      },
      "equipment": ["Item 1 (quantity)", "Item 2 (quantity)"],
      "materials": ["Material 1 (quantity)", "Material 2 (quantity)"],
      "logistics": "Staging area, supply chain, and rotation plan description."
    },
    "command_signal": {
      "command_structure": "Incident Commander -> Operations Section Chief -> Team Leads",
      "reporting": "Twice daily SITREPs at 0800 and 1800; daily OPREP to regional coordinator.",
      "communications": "Primary: Verizon FirstNet. Backup: VHF radio. Third: satellite phone.",
      "coordination": [
        "FEMA Region VI",
        "Texas Division of Emergency Management",
        "Local emergency management agencies",
        "American Red Cross"
      ]
    }
  }
}

CRITICAL RULES:
- Return ONLY the JSON object. No text before or after.
- Use REAL numbers from the resource_allocation and timeline_generator tools.
- Populate personnel counts from resource_allocation output.
- Populate phase timelines from timeline_generator output.
- Reference specific zone data, SVI scores, and population numbers in the situation section.
- Do NOT call sop_template.validate_sop — the schema above is the template.
- Include specific TR vulnerability data points in key_vulnerabilities.
"""


class MissionPlanningAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "mission_planning"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def register_skills(self) -> None:
        # Only register the two skills that work and are needed
        self.kernel.add_plugin(ResourceAllocationSkill(), plugin_name="resource_allocation")
        self.kernel.add_plugin(TimelineGeneratorSkill(), plugin_name="timeline_generator")

    async def generate_plan(
        self,
        context_output: dict,
        construction_output: dict | list,
    ) -> dict:
        """
        Generate a complete SOP from Agent 1 + Agent 2 outputs.

        Args:
            context_output: Full output from DisasterContextAgent.analyze_event()
            construction_output: Full output from ConstructionProfileAgent.build_profiles()

        Returns:
            SOP document as structured JSON.
        """
        import json

        # Extract key numbers for the prompt so the LLM has concrete data
        zones = context_output.get("zones", [])
        total_zones = len(zones)
        total_pop = sum(z.get("population", 0) or 0 for z in zones)
        total_structures = sum(z.get("total_structures", 0) or 0 for z in zones)
        # Estimate structures from population if not available
        if total_structures == 0:
            total_structures = int(total_pop * 0.4)  # rough estimate

        critical = sum(1 for z in zones if z.get("risk_level") == "Critical")
        high = sum(1 for z in zones if z.get("risk_level") == "High")

        prompt = (
            "Generate a complete Team Rubicon 5-Paragraph Operations Order based on "
            "the following disaster analysis.\n\n"
            "FIRST: Call resource_allocation.calculate_resources with these values:\n"
            f"  total_zones={total_zones}, total_structures={total_structures}, "
            f"critical_zones={critical}, high_zones={high}\n\n"
            "SECOND: Call timeline_generator.generate_timeline with:\n"
            f"  total_zones={total_zones}, total_structures={total_structures}\n\n"
            "THIRD: Use those results plus the data below to fill in the SOP JSON.\n\n"
            f"## Key Numbers\n"
            f"- Total zones: {total_zones}\n"
            f"- Total population affected: {total_pop:,}\n"
            f"- Estimated structures: {total_structures:,}\n"
            f"- Critical zones: {critical}, High zones: {high}\n\n"
            f"## Disaster Context (Agent 1 Output)\n{json.dumps(context_output, indent=2)}\n\n"
            f"## Construction Profiles (Agent 2 Output)\n{json.dumps(construction_output, indent=2)}\n\n"
            "Return ONLY the JSON object with the sop key. No markdown fences."
        )

        result = await self.run(prompt)

        # If the LLM returned a dict with "sop" key, great
        if isinstance(result, dict) and "sop" in result:
            return result
        # If it returned the sop content directly
        if isinstance(result, dict) and "situation" in result:
            return {"sop": result}
        # Fallback
        return result

    async def revise_section(self, section_name: str, instructions: str) -> dict:
        """Revise a specific SOP section based on user feedback."""
        return await self.chat(
            f"Please revise Section {section_name} with the following changes: {instructions}. "
            f"Return the updated section as JSON."
        )
