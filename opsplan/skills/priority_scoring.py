"""
Priority Scoring Skill — Deterministic weighted composite scoring.

This is NOT an LLM function — it's pure math. The agent calls this to
compute priority scores for census tracts based on configurable weights.
"""
import json
from semantic_kernel.functions import kernel_function


DEFAULT_WEIGHTS = {
    "svi": 0.30,
    "nri": 0.30,
    "housing_vulnerability": 0.25,
    "population_density": 0.15,
}


class PriorityScoringSkill:
    """Compute composite priority scores for census tracts."""

    @kernel_function(
        name="score_zones",
        description="Compute composite priority scores for a list of zones. Each zone needs svi_score (0-1), nri_score (0-1), housing_vulnerability (0-1), and population_density (0-1). Returns ranked zones with scores and risk levels.",
    )
    async def score_zones(self, zones_json: str, weights_json: str = "") -> str:
        """
        Args:
            zones_json: JSON array of zone objects, each with:
                - fips_tract, area_name
                - svi_score (0-1 percentile)
                - nri_score (0-1 percentile)
                - housing_vulnerability (0-1, computed from mobile_home_pct, pre1980_pct, etc.)
                - population_density (0-1, normalized)
            weights_json: Optional JSON object with custom weights.
                Default: {"svi": 0.30, "nri": 0.30, "housing_vulnerability": 0.25, "population_density": 0.15}
        """
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

        # Normalize weights to sum to 1.0
        total = sum(weights.values())
        weights = {k: v / total for k, v in weights.items()}

        scored = []
        for zone in zones:
            composite = (
                zone.get("svi_score", 0) * weights.get("svi", 0)
                + zone.get("nri_score", 0) * weights.get("nri", 0)
                + zone.get("housing_vulnerability", 0) * weights.get("housing_vulnerability", 0)
                + zone.get("population_density", 0) * weights.get("population_density", 0)
            )
            # Scale to 0-100
            score = round(composite * 100, 1)

            # Assign risk level
            if score >= 85:
                risk = "Critical"
            elif score >= 70:
                risk = "High"
            elif score >= 50:
                risk = "Moderate"
            else:
                risk = "Low"

            scored.append({
                **zone,
                "composite_score": score,
                "risk_level": risk,
            })

        # Sort by composite score descending
        scored.sort(key=lambda z: z["composite_score"], reverse=True)

        # Assign ranks
        for i, zone in enumerate(scored):
            zone["rank"] = i + 1

        return json.dumps({
            "zones": scored,
            "weights_used": weights,
            "total_zones": len(scored),
        })

    @kernel_function(
        name="compute_housing_vulnerability",
        description="Compute a housing vulnerability sub-score (0-1) from housing characteristics. Input: mobile_home_pct, pre1980_pct, vacant_pct, median_home_value, median_sqft.",
    )
    async def compute_housing_vulnerability(
        self,
        mobile_home_pct: float,
        pre1980_pct: float,
        vacant_pct: float = 0.0,
        median_home_value: float = 150000.0,
    ) -> str:
        """
        Compute housing vulnerability as a weighted sub-score.

        Higher manufactured housing %, older stock, higher vacancy,
        and lower home values all increase vulnerability.
        """
        # Normalize each factor to 0-1
        mh_score = min(mobile_home_pct / 50.0, 1.0)  # 50%+ manufactured = max
        age_score = min(pre1980_pct / 60.0, 1.0)       # 60%+ pre-1980 = max
        vacant_score = min(vacant_pct / 20.0, 1.0)      # 20%+ vacant = max
        value_score = max(0, 1 - (median_home_value / 300000.0))  # Lower value = higher vuln

        # Weighted combination
        vulnerability = (
            mh_score * 0.35
            + age_score * 0.30
            + value_score * 0.20
            + vacant_score * 0.15
        )

        return json.dumps({
            "housing_vulnerability": round(vulnerability, 3),
            "components": {
                "manufactured_housing": round(mh_score, 3),
                "aging_stock": round(age_score, 3),
                "low_value": round(value_score, 3),
                "vacancy": round(vacant_score, 3),
            },
        })
