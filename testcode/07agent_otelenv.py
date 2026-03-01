import os
import asyncio
import logging
from typing import cast
from typing import Annotated, Literal
from typing import TYPE_CHECKING
from random import randint
import random
import json
import argparse
from contextlib import suppress

if TYPE_CHECKING:
    from agent_framework import SupportsChatGetResponse


from dotenv import load_dotenv
from agent_framework import (
    tool, 
    Agent, 
    AgentResponseUpdate,
    Message,
    WorkflowEvent,
)
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework.openai import OpenAIChatClient
from agent_framework.orchestrations import GroupChatRequestSentEvent, MagenticBuilder, MagenticProgressLedger

from pydantic import BaseModel, Field

from agent_framework.observability import configure_otel_providers, get_tracer
from opentelemetry import trace
from opentelemetry.trace import SpanKind
from opentelemetry.trace.span import format_trace_id


# Load environment variables from .env file
load_dotenv()

# Define the scenarios that can be run to show the telemetry data collected by the SDK
SCENARIOS = ["client", "client_stream", "tool", "all"]
"""
This  shows how you can observe an agent in Agent Framework by using the
same observability setup function.
"""

# NOTE: approval_mode="never_require" is for sample brevity. Use "always_require" in production;
# See:
# samples/02-agents/tools/function_tool_with_approval.py
# samples/02-agents/tools/function_tool_with_approval_and_sessions.py.
@tool(approval_mode="never_require")
async def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    await asyncio.sleep(randint(0, 10) / 10.0)  # Simulate a network call
    conditions = ["sunny", "cloudy", "rainy", "stormy"]
    return f"The weather in {location} is {conditions[randint(0, 3)]} with a high of {randint(10, 30)}°C."

async def run_chat_client(client: "SupportsChatGetResponse", stream: bool = False) -> None:
    """Run an AI service.

    This function runs an AI service and prints the output.
    Telemetry will be collected for the service execution behind the scenes,
    and the traces will be sent to the configured telemetry backend.

    The telemetry will include information about the AI service execution.

    Args:
        client: The chat client to use.
        stream: Whether to use streaming for the response

    Remarks:
        For the scenario below, you should see the following:
        1 Client span, with 4 children:
            2 Internal span with gen_ai.operation.name=chat
                The first has finish_reason "tool_calls"
                The second has finish_reason "stop"
            2 Internal span with gen_ai.operation.name=execute_tool

    """
    scenario_name = "Chat Client Stream" if stream else "Chat Client"
    with get_tracer().start_as_current_span(name=f"Scenario: {scenario_name}", kind=trace.SpanKind.CLIENT):
        print("Running scenario:", scenario_name)
        message = "What's the weather in Amsterdam and in Paris?"
        print(f"User: {message}")
        if stream:
            print("Assistant: ", end="")
            async for chunk in client.get_response(
                [Message(role="user", text=message)], tools=get_weather, stream=True
            ):
                if chunk.text:
                    print(chunk.text, end="")
            print("")
        else:
            response = await client.get_response([Message(role="user", text=message)], tools=get_weather)
            print(f"Assistant: {response}")


async def run_tool() -> None:
    """Run a AI function.

    This function runs a AI function and prints the output.
    Telemetry will be collected for the function execution behind the scenes,
    and the traces will be sent to the configured telemetry backend.

    The telemetry will include information about the AI function execution
    and the AI service execution.
    """
    with get_tracer().start_as_current_span("Scenario: AI Function", kind=trace.SpanKind.CLIENT):
        print("Running scenario: AI Function")
        weather = await get_weather.invoke(location="Amsterdam")
        print(f"Weather in Amsterdam:\n{weather}")


async def main(scenario: Literal["client", "client_stream", "tool", "all"] = "all"):
    """Run the selected scenario(s)."""

    # This will enable tracing and create the necessary tracing, logging and metrics providers
    # based on environment variables. See the .env.example file for the available configuration options.
    configure_otel_providers()

    with get_tracer().start_as_current_span("Sample Scenarios", kind=trace.SpanKind.CLIENT) as current_span:
        print(f"Trace ID: {format_trace_id(current_span.get_span_context().trace_id)}")

        # set client
        client = OpenAIChatClient(
            base_url=os.getenv("GITHUB_ENDPOINT", "https://models.inference.ai.azure.com"),
            api_key=os.getenv("GITHUB_TOKEN"),
            model_id=os.getenv("GITHUB_MODEL_ID", "gpt-4o-mini")
        )

        # Scenarios where telemetry is collected in the SDK, from the most basic to the most complex.
        if scenario == "tool" or scenario == "all":
            with suppress(Exception):
                await run_tool()
        if scenario == "client_stream" or scenario == "all":
            with suppress(Exception):
                await run_chat_client(client, stream=True)
        if scenario == "client" or scenario == "all":
            with suppress(Exception):
                await run_chat_client(client, stream=False)


if __name__ == "__main__":
    arg_parser = argparse.ArgumentParser()

    arg_parser.add_argument(
        "--scenario",
        type=str,
        choices=SCENARIOS,
        default="all",
        help="The scenario to run. Default is all.",
    )

    args = arg_parser.parse_args()
    asyncio.run(main(args.scenario))