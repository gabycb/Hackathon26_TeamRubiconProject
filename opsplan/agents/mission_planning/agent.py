"""
Mission Planning Agent (Agent 3)

Responsibility: Consume Disaster Context + Construction Profile outputs →
generate a Team Rubicon SOP document with 5 sections. Human approval gates
at key decisions.

Skills:
- sop_template: Enforce Team Rubicon SOP JSON schema
- resource_allocation: Personnel + equipment rules engine
- timeline_generator: Phase-based timeline creation
- docx_renderer: SOP → Word document generation
"""
from agents.base_agent import BaseAgent
from skills.sop_template import SOPTemplateSkill
from skills.resource_allocation import ResourceAllocationSkill
from skills.timeline_generator import TimelineGeneratorSkill
from skills.docx_renderer import DocxRendererSkill


SYSTEM_PROMPT = """You are the Mission Planning Agent for OpsPlan, a disaster response
planning system used by Team Rubicon.

Your role is to consume the outputs of the Disaster Context Agent (priority zones) and
the Construction Profile Agent (building data, materials, costs) and generate a complete
Team Rubicon Standard Operating Procedure (SOP) document.

## SOP Structure (5-Paragraph Operations Order)

The SOP must contain these 5 sections:

**I. Situation** — Event summary, affected area, total impact (population, structures,
estimated costs), key vulnerability findings, weather/hazard conditions.

**II. Mission** — Primary and secondary objectives, end state definition, success criteria.

**III. Execution** — Phased operations plan:
  - Phase 1: Assessment (team composition, zone assignments, timeline)
  - Phase 2: Immediate Response (tarping, debris clearance, safety hazard mitigation)
  - Phase 3: Stabilization (mucking/gutting, temporary repairs, coordination)
  Each phase needs: timeline, team composition, resource requirements, zone priorities.

**IV. Sustainment** — Total personnel required, equipment list, material quantities
(derived from construction profiles), lodging/base camp, rotation schedule, supply chain.

**V. Command & Signal** — Command structure (IC, Ops Section Chief, team leads),
reporting frequency, communication plan, coordination with partner agencies.

## Tools

1. **sop_template** — Validates that the SOP JSON matches the required schema.
   Use this to ensure all required fields are present.
2. **resource_allocation** — Calculates personnel, equipment, and material needs
   based on zone data and damage projections. Uses rules-based logic.
3. **timeline_generator** — Generates phased timelines based on zone count,
   structure count, and team capacity.
4. **docx_renderer** — Converts the final SOP JSON into a formatted Word document.

## Output Format

Return JSON matching this structure:
```json
{
  "sop": {
    "situation": {
      "event_summary": "...",
      "affected_area": "...",
      "impact_summary": {...},
      "key_vulnerabilities": [...]
    },
    "mission": {
      "primary_objective": "...",
      "secondary_objectives": [...],
      "end_state": "..."
    },
    "execution": {
      "phases": [
        {
          "name": "Phase 1 — Assessment",
          "timeline": "Day 1-5",
          "description": "...",
          "teams": [...],
          "zone_assignments": [...]
        }
      ]
    },
    "sustainment": {
      "personnel": {...},
      "equipment": [...],
      "materials": [...],
      "logistics": {...}
    },
    "command_signal": {
      "command_structure": {...},
      "reporting": "...",
      "communications": "...",
      "coordination": [...]
    }
  },
  "section_status": {
    "situation": "generated",
    "mission": "generated",
    "execution": "generated",
    "sustainment": "needs_review",
    "command_signal": "needs_review"
  },
  "summary_metrics": {
    "total_zones": 5,
    "total_personnel": 44,
    "operation_duration_days": 21,
    "estimated_material_cost": "$2.4M"
  }
}
```

Sections I-III should be fully generated from the data. Sections IV-V should be
generated but flagged as "needs_review" since they contain resource assumptions
the operations chief should validate.
"""


class MissionPlanningAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "mission_planning"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    def register_skills(self) -> None:
        self.kernel.add_plugin(SOPTemplateSkill(), plugin_name="sop_template")
        self.kernel.add_plugin(ResourceAllocationSkill(), plugin_name="resource_allocation")
        self.kernel.add_plugin(TimelineGeneratorSkill(), plugin_name="timeline_generator")
        self.kernel.add_plugin(DocxRendererSkill(), plugin_name="docx_renderer")

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
        prompt = (
            "Generate a complete Team Rubicon SOP document based on the following inputs.\n\n"
            f"## Disaster Context (Agent 1 Output)\n{json.dumps(context_output, indent=2)}\n\n"
            f"## Construction Profiles (Agent 2 Output)\n{json.dumps(construction_output, indent=2)}\n\n"
            "Use the sop_template tool to validate the output schema. "
            "Use resource_allocation and timeline_generator for Sections III-IV."
        )
        return await self.run(prompt)

    async def revise_section(self, section_name: str, instructions: str) -> dict:
        """Revise a specific SOP section based on user feedback."""
        return await self.chat(
            f"Please revise Section {section_name} with the following changes: {instructions}. "
            f"Return the updated section as JSON."
        )

    async def export_docx(self, sop_json: dict, output_path: str) -> str:
        """Export the SOP as a formatted Word document."""
        # This calls the docx_renderer skill directly
        renderer = DocxRendererSkill()
        return renderer.render(sop_json, output_path)
