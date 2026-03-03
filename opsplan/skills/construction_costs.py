"""Construction Costs Skill — Regional replacement cost estimation."""
import json
from semantic_kernel.functions import kernel_function
from data.db import query


class ConstructionCostsSkill:

    @kernel_function(name="estimate_replacement_costs", description="Estimate replacement costs for structures in a tract by building type and region. Returns per-sqft and total costs.")
    async def estimate_replacement_costs(self, fips_tract: str, region: str = "gulf_coast") -> str:
        gbs = await query("SELECT * FROM hazus_gbs WHERE fips_tract = ?", (fips_tract,))
        if not gbs:
            return json.dumps({"error": "No building stock data"})
        gbs = gbs[0]
        materials = await query("SELECT * FROM materials_lookup WHERE region = ?", (region,))
        # Compute estimates from building stock × cost rates
        return json.dumps({"fips_tract": fips_tract, "building_value_total": gbs.get("building_value_total"), "note": "Full implementation computes per-type costs"})
