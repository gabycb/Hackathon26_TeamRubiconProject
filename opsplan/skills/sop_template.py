"""SOP Template Skill — Validate SOP JSON against Team Rubicon schema."""
import json
from semantic_kernel.functions import kernel_function

REQUIRED_SECTIONS = ["situation", "mission", "execution", "sustainment", "command_signal"]
REQUIRED_SITUATION_FIELDS = ["event_summary", "affected_area", "impact_summary"]
REQUIRED_EXECUTION_FIELDS = ["phases"]


class SOPTemplateSkill:

    @kernel_function(name="validate_sop", description="Validate that an SOP JSON document has all required sections and fields per Team Rubicon format. Returns validation result with any missing fields.")
    async def validate_sop(self, sop_json: str) -> str:
        try:
            sop = json.loads(sop_json)
        except json.JSONDecodeError:
            return json.dumps({"valid": False, "error": "Invalid JSON"})
        issues = []
        for section in REQUIRED_SECTIONS:
            if section not in sop:
                issues.append(f"Missing section: {section}")
        if "situation" in sop:
            for field in REQUIRED_SITUATION_FIELDS:
                if field not in sop["situation"]:
                    issues.append(f"Missing situation.{field}")
        if "execution" in sop:
            for field in REQUIRED_EXECUTION_FIELDS:
                if field not in sop["execution"]:
                    issues.append(f"Missing execution.{field}")
        return json.dumps({"valid": len(issues) == 0, "issues": issues})
