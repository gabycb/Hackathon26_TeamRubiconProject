import os
import asyncio
import json
import logging
import uuid
from typing import cast, Any

from dotenv import load_dotenv
from agent_framework import (
    tool,
    Agent,
    AgentResponseUpdate,
    Message,
    WorkflowEvent,
)
from agent_framework.openai import OpenAIChatClient
from agent_framework.orchestrations import (
    GroupChatRequestSentEvent,
    MagenticBuilder,
    MagenticProgressLedger,
)
from agent_framework._workflows._checkpoint import (
    CheckpointStorage,
    WorkflowCheckpoint,
    CheckpointID,
    WorkflowCheckpointException,
)

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

load_dotenv()

CHECKPOINT_DIR = "checkpoints"
WORKFLOW_NAME  = "downed_tree_workflow"


# ─── Custom Tool ──────────────────────────────────────────────────────────────

@tool
def execute_code(code: str) -> str:
    """Executes Python code and returns the output"""
    import subprocess, sys
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        timeout=10
    )
    return result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr.strip()}"


# ─── FileCheckpointStorage ────────────────────────────────────────────────────
# Implements the CheckpointStorage protocol using one JSON file per checkpoint.
# Layout: checkpoints/<workflow_name>/<checkpoint_id>.json

class FileCheckpointStorage(CheckpointStorage):

    def __init__(self, base_dir: str = CHECKPOINT_DIR):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    # ── internal helpers ────────────────────────────────────────────────────

    def _workflow_dir(self, workflow_name: str) -> str:
        path = os.path.join(self.base_dir, workflow_name)
        os.makedirs(path, exist_ok=True)
        return path

    def _filepath(self, workflow_name: str, checkpoint_id: CheckpointID) -> str:
        return os.path.join(self._workflow_dir(workflow_name), f"{checkpoint_id}.json")

    def _serialize(self, checkpoint: WorkflowCheckpoint) -> dict[str, Any]:
        """Use the dataclass's own to_dict() then JSON-encode nested objects."""
        raw = checkpoint.to_dict()
        # to_dict() is a shallow copy — walk values and convert anything that
        # isn't natively JSON-serialisable (WorkflowMessage, WorkflowEvent, etc.)
        # by falling back to their own to_dict() / __dict__ if available.
        def jsonify(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {k: jsonify(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [jsonify(i) for i in obj]
            if hasattr(obj, "to_dict"):
                return jsonify(obj.to_dict())
            if hasattr(obj, "__dict__"):
                return jsonify(obj.__dict__)
            return obj
        return jsonify(raw)

    def _deserialize(self, data: dict[str, Any]) -> WorkflowCheckpoint:
        """Reconstruct using the dataclass's own from_dict() classmethod."""
        return WorkflowCheckpoint.from_dict(data)

    # ── protocol methods ────────────────────────────────────────────────────

    async def save(self, checkpoint: WorkflowCheckpoint) -> CheckpointID:
        checkpoint_id = checkpoint.checkpoint_id   # already set by dataclass default
        path = self._filepath(checkpoint.workflow_name, checkpoint_id)
        with open(path, "w") as f:
            json.dump(self._serialize(checkpoint), f, indent=2, default=str)
        print(f"💾 Checkpoint saved → {path}")
        return checkpoint_id

    async def load(self, checkpoint_id: CheckpointID) -> WorkflowCheckpoint:
        # Search all workflow subdirs
        for workflow_name in os.listdir(self.base_dir):
            path = self._filepath(workflow_name, checkpoint_id)
            if os.path.exists(path):
                with open(path) as f:
                    return self._deserialize(json.load(f))
        raise WorkflowCheckpointException(f"No checkpoint found with id: {checkpoint_id}")

    async def list_checkpoints(self, *, workflow_name: str) -> list[WorkflowCheckpoint]:
        wdir = self._workflow_dir(workflow_name)
        checkpoints = []
        for fname in sorted(os.listdir(wdir)):
            if fname.endswith(".json"):
                with open(os.path.join(wdir, fname)) as f:
                    checkpoints.append(self._deserialize(json.load(f)))
        return checkpoints

    async def delete(self, checkpoint_id: CheckpointID) -> bool:
        for workflow_name in os.listdir(self.base_dir):
            path = self._filepath(workflow_name, checkpoint_id)
            if os.path.exists(path):
                os.remove(path)
                print(f"🗑️  Checkpoint deleted → {path}")
                return True
        return False

    async def get_latest(self, *, workflow_name: str) -> WorkflowCheckpoint | None:
        checkpoints = await self.list_checkpoints(workflow_name=workflow_name)
        return checkpoints[-1] if checkpoints else None

    async def list_checkpoint_ids(self, *, workflow_name: str) -> list[CheckpointID]:
        wdir = self._workflow_dir(workflow_name)
        return [
            fname.replace(".json", "")
            for fname in sorted(os.listdir(wdir))
            if fname.endswith(".json")
        ]

    # ── convenience helper ──────────────────────────────────────────────────

    async def clear_all(self, *, workflow_name: str) -> None:
        """Delete all checkpoints for a given workflow name."""
        for cid in await self.list_checkpoint_ids(workflow_name=workflow_name):
            await self.delete(cid)


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main() -> None:

    # ── Client ──────────────────────────────────────────────────────────────
    client = OpenAIChatClient(
        base_url=os.getenv("GITHUB_ENDPOINT", "https://models.inference.ai.azure.com"),
        api_key=os.getenv("GITHUB_TOKEN"),
        model_id=os.getenv("GITHUB_MODEL_ID", "gpt-4o-mini")
    )

    # ── Agents ──────────────────────────────────────────────────────────────
    researcher_agent = Agent(
        client=client,
        name="ResearcherAgent",
        description="Researches costs, regulations, and resource requirements",
        instructions=(
            "You are a Researcher. Gather factual information about emergency response "
            "costs, required personnel, equipment, permits, and disposal for downed trees. "
            "Do not perform calculations — leave that to the Coder."
        ),
    )

    coder_agent = Agent(
        client=client,
        name="CoderAgent",
        description="Performs cost calculations and produces summary tables",
        instructions=(
            "You are a Coder. Use the execute_code tool to calculate total cost estimates "
            "based on research data. Produce itemized cost breakdowns and summary tables."
        ),
        tools=[execute_code],
    )

    manager_agent = Agent(
        client=client,
        name="MagenticManager",
        description="Orchestrates the research and cost estimation workflow",
        instructions=(
            "You coordinate the team to produce a complete, accurate cost estimate report. "
            "Ensure the researcher gathers all relevant data before the coder calculates totals."
        ),
    )

    # ── Task ────────────────────────────────────────────────────────────────
    task = (
        "A large tree (approx. 60ft oak) has fallen across a residential road during a storm, "
        "blocking traffic and partially damaging a fence. Estimate the total cost required to "
        "respond to and resolve this incident. Include: emergency callout fees, crew size and "
        "hourly rates, equipment (chainsaw crews, chipper, crane if needed), debris disposal, "
        "road closure/traffic management, fence repair estimate, permit costs if applicable, "
        "and a risk/complexity buffer. Provide an itemized cost table and a final total range "
        "(low/mid/high estimate). Assume a suburban US location."
    )

    # ── Checkpoint: check for existing run ──────────────────────────────────
    checkpoint_storage = FileCheckpointStorage(CHECKPOINT_DIR)
    latest = await checkpoint_storage.get_latest(workflow_name=WORKFLOW_NAME)

    if latest:
        loop = asyncio.get_event_loop()
        resume_choice = await loop.run_in_executor(
            None, lambda: input("\n⚡ Found existing checkpoint. Resume? (y/n): ").strip().lower()
        )
        if resume_choice != "y":
            await checkpoint_storage.clear_all(workflow_name=WORKFLOW_NAME)
            latest = None
            print("🔄 Starting fresh.\n")
        else:
            print("▶️  Resuming from checkpoint...\n")

    # ── Build workflow ───────────────────────────────────────────────────────
    builder = MagenticBuilder(
        participants=[researcher_agent, coder_agent],
        intermediate_outputs=True,
        manager_agent=manager_agent,
        max_round_count=10,
        max_stall_count=3,
        max_reset_count=2,
    ).with_checkpointing(checkpoint_storage)

    # Only attach plan review on a fresh run
    if latest is None:
        builder = builder.with_plan_review()

    workflow = builder.build()

    if latest is None:
        print(f"\n📋 Task:\n{task}")
        print("\n🔍 The manager will generate a plan for your review before execution.\n")

    # ── Run ──────────────────────────────────────────────────────────────────
    last_response_id: str | None = None
    output_event: WorkflowEvent | None = None
    current_round = 0
    loop = asyncio.get_event_loop()

    try:
        async for event in workflow.run(task, stream=True):

            # Streaming agent token output
            if event.type == "output" and isinstance(event.data, AgentResponseUpdate):
                response_id = event.data.response_id
                if response_id != last_response_id:
                    if last_response_id is not None:
                        print("\n")
                    print(f"\n- {event.executor_id}:", end=" ", flush=True)
                    last_response_id = response_id
                print(event.data, end="", flush=True)

            # Orchestrator events
            elif event.type == "magentic_orchestrator":
                content = event.data.content
                event_type = event.data.event_type.name
                print(f"\n\n[🧠 Magentic Orchestrator — {event_type}]")

                # Plan review — block here, framework resumes when handler returns
                if isinstance(content, Message):
                    print(f"\n📝 Proposed Plan:\n{content.text}\n")
                    print("─" * 60)
                    print("Options: (y) approve  |  (e) edit plan  |  (s) skip")

                    choice = await loop.run_in_executor(
                        None, lambda: input("Your choice: ").strip().lower()
                    )

                    if choice == "e":
                        print("✏️  Enter revised plan (blank line to finish):")
                        lines = []
                        while True:
                            line = await loop.run_in_executor(None, input)
                            if line == "":
                                break
                            lines.append(line)
                        content.text = "\n".join(lines)
                        print("✅ Revised plan submitted. Proceeding...\n")

                    elif choice == "s":
                        print("⏭️  Skipping.")
                        return

                    else:
                        print("✅ Plan approved. Proceeding...\n")
                    # Returning from handler unblocks the framework

                # Progress ledger
                elif isinstance(content, MagenticProgressLedger):
                    print(f"\n📊 Progress Ledger:\n{json.dumps(content.to_dict(), indent=2)}")
                    await loop.run_in_executor(None, input, "Press Enter to continue...")

            # Round tracking
            elif event.type == "group_chat" and isinstance(event.data, GroupChatRequestSentEvent):
                current_round = event.data.round_index
                print(f"\n[🔁 Round {current_round}] → {event.data.participant_name}")

            # Capture final output
            elif event.type == "output":
                output_event = event

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted. Checkpoint saved — re-run to resume.")
        return

    # ── Final output ─────────────────────────────────────────────────────────
    if output_event:
        outputs = cast(list[Message], output_event.data)
        print("\n\n" + "=" * 80)
        print("\n🌳 DOWNED TREE RESPONSE — FINAL COST ESTIMATE REPORT\n")
        print("=" * 80 + "\n")
        for message in outputs:
            print(f"{message.author_name or message.role}:\n{message.text}\n")

    # Clean up on successful completion
    await checkpoint_storage.clear_all(workflow_name=WORKFLOW_NAME)
    print("\n✅ Workflow complete. Checkpoints cleared.")


if __name__ == "__main__":
    asyncio.run(main())