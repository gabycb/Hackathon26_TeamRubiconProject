"""Timeline Generator Skill — Phase-based timeline creation."""
import json
from semantic_kernel.functions import kernel_function


class TimelineGeneratorSkill:

    @kernel_function(name="generate_timeline", description="Generate a phased operations timeline based on zone count, structure count, and team capacity. Returns phases with start/end days and milestones.")
    async def generate_timeline(self, total_zones: int, total_structures: int, assessment_teams: int = 3) -> str:
        structures_per_team_per_day = 25
        assessment_days = max(3, int(total_structures / (assessment_teams * structures_per_team_per_day)))
        response_start = max(3, assessment_days - 2)  # Overlap
        response_days = int(assessment_days * 1.5)
        stabilization_start = response_start + int(response_days * 0.6)
        total_days = stabilization_start + 14
        return json.dumps({
            "phases": [
                {"name": "Phase 1 — Assessment", "start_day": 1, "end_day": assessment_days, "description": f"Deploy {assessment_teams} teams across {total_zones} zones"},
                {"name": "Phase 2 — Immediate Response", "start_day": response_start, "end_day": response_start + response_days, "description": "Tarping, debris clearance, safety hazard mitigation"},
                {"name": "Phase 3 — Stabilization", "start_day": stabilization_start, "end_day": total_days, "description": "Mucking/gutting, temporary repairs, coordination"},
            ],
            "total_operation_days": total_days,
        })
