"""Resource Allocation Skill — Personnel + equipment rules engine."""
import json
from semantic_kernel.functions import kernel_function


class ResourceAllocationSkill:

    @kernel_function(name="calculate_resources", description="Calculate personnel, equipment, and material needs based on zone count, structure count, and damage projections. Returns staffing plan, equipment list, and material quantities.")
    async def calculate_resources(self, total_zones: int, total_structures: int, critical_zones: int = 0, high_zones: int = 0) -> str:
        # Assessment teams: 1 team of 4 per critical zone, shared teams for others
        assessment_teams = critical_zones + max(1, (high_zones + (total_zones - critical_zones - high_zones)) // 2)
        assessment_personnel = assessment_teams * 4
        # Response crews: 2 per critical zone, 1 per high zone
        response_crews = critical_zones * 2 + high_zones
        response_personnel = response_crews * 4
        # Equipment based on structure count
        tarps = int(total_structures * 0.4)
        plywood_sheets = int(total_structures * 10)
        generators = max(4, total_zones * 2)
        return json.dumps({
            "personnel": {"assessment": assessment_personnel, "response": response_personnel, "total": assessment_personnel + response_personnel},
            "equipment": {"box_trucks": max(2, total_zones), "skid_steers": max(1, critical_zones), "chainsaws": max(4, total_zones * 2), "generators": generators},
            "materials": {"tarps": tarps, "plywood_sheets_4x8": plywood_sheets, "roofing_felt_rolls": int(total_structures * 0.3)},
        })
