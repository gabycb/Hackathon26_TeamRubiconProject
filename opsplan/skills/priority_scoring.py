"""Priority Scoring Skill - Deterministic weighted composite scoring."""
import json
from semantic_kernel.functions import kernel_function

DEFAULT_WEIGHTS = {
    "svi": 0.30,
    "nri": 0.30,
    "housing_vulnerability": 0.25,
    "population_density": 0.15,
}

class PriorityScoringSkill:

    @kernel_function(
        name="score_zones",
        description="Compute composite priority scores for a list of zones. Each zone needs svi_score (0-1), nri_score (0-1), housing_vulnerability (0-1), population_density (0-1). Returns ranked zones.",
    )
    async def score_zones(self, zones_json: str, weights_json: str = "") -> str:
        try:
            zones = json.loads(zones_json)
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid zones JSON"})
        weights = DEFAULT_WEIGHTS
        if weights_json:
            try:
                weights = json.loads(weights_json)
            except json.JSONDecodeError:
                pass
        total = sum(weights.values())
        weights = {k: v / total for k, v in weights.items()}
        scored = []
        for zone in zones:
            composite = (
                (zone.get("svi_score") or 0) * weights.get("svi", 0)
                + (zone.get("nri_score") or 0) * weights.get("nri", 0)
                + (zone.get("housing_vulnerability") or 0) * weights.get("housing_vulnerability", 0)
                + (zone.get("population_density") or 0) * weights.get("population_density", 0)
            )
            score = round(composite * 100, 1)
            if score >= 85: risk = "Critical"
            elif score >= 70: risk = "High"
            elif score >= 50: risk = "Moderate"
            else: risk = "Low"
            scored.append({**zone, "composite_score": score, "risk_level": risk})
        scored.sort(key=lambda z: z["composite_score"], reverse=True)
        for i, zone in enumerate(scored):
            zone["rank"] = i + 1
        return json.dumps({"zones": scored, "weights_used": weights, "total_zones": len(scored)})

    @kernel_function(
        name="compute_housing_vulnerability",
        description="Compute housing vulnerability sub-score (0-1). ALL parameters are strings to handle null Census data. Pass '0' for missing values. Returns score with component breakdown showing raw values.",
    )
    async def compute_housing_vulnerability(
        self,
        mobile_home_pct: str = "0",
        pre1980_pct: str = "0",
        vacant_pct: str = "0",
        median_home_value: str = "150000",
        renter_occupied_pct: str = "0",
    ) -> str:
        """Compute housing vulnerability. All params are strings to prevent SK type errors with null Census data."""
        def sf(val, default=0.0):
            try:
                return float(val)
            except (TypeError, ValueError):
                return default
        mh = sf(mobile_home_pct)
        pre80 = sf(pre1980_pct)
        vac = sf(vacant_pct)
        value = sf(median_home_value, 150000.0)
        renter = sf(renter_occupied_pct)
        mh_score = min(mh / 50.0, 1.0)
        age_score = min(pre80 / 60.0, 1.0)
        vacant_score = min(vac / 20.0, 1.0)
        value_score = max(0, 1 - (value / 300000.0))
        renter_score = min(renter / 60.0, 1.0)
        vulnerability = (
            mh_score * 0.30 + age_score * 0.25 + value_score * 0.20
            + vacant_score * 0.10 + renter_score * 0.15
        )
        return json.dumps({
            "housing_vulnerability": round(vulnerability, 3),
            "components": {
                "manufactured_housing": {"score": round(mh_score, 3), "raw_pct": round(mh, 1)},
                "aging_stock_pre1980": {"score": round(age_score, 3), "raw_pct": round(pre80, 1)},
                "low_home_value": {"score": round(value_score, 3), "raw_value": round(value, 0)},
                "vacancy": {"score": round(vacant_score, 3), "raw_pct": round(vac, 1)},
                "renter_occupied": {"score": round(renter_score, 3), "raw_pct": round(renter, 1)},
            },
        })
