"""
Base agent class for OpsPlan Semantic Kernel agents.

All three agents (Disaster Context, Construction Profile, Mission Planning)
inherit from this base. It handles:
- Semantic Kernel kernel initialization with Azure OpenAI
- Chat completion with automatic function calling
- Structured output parsing
- Conversation history management
- Logging
"""
import json
import structlog
from typing import Any
from semantic_kernel import Kernel
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
from semantic_kernel.connectors.ai.function_choice_behavior import FunctionChoiceBehavior
from semantic_kernel.connectors.ai.open_ai.prompt_execution_settings import (
    OpenAIChatPromptExecutionSettings,
)
from semantic_kernel.contents import ChatHistory

from config.settings import settings

logger = structlog.get_logger()


class BaseAgent:
    """
    Base class for all OpsPlan agents.

    Subclasses must implement:
        - agent_name: str property
        - system_prompt: str property
        - register_skills(): registers native function plugins

    The run() method uses Semantic Kernel's chat completion service
    with automatic function calling — the LLM calls registered skills
    in a loop until it has enough data to produce a final response.
    """

    def __init__(self):
        self.kernel = Kernel()
        self._service_id = "azure-gpt4o"
        self._setup_ai_service()
        self.history = ChatHistory()
        self.history.add_system_message(self.system_prompt)
        self.register_skills()
        logger.info("agent.initialized", agent=self.agent_name)

    @property
    def agent_name(self) -> str:
        raise NotImplementedError

    @property
    def system_prompt(self) -> str:
        raise NotImplementedError

    def register_skills(self) -> None:
        raise NotImplementedError

    def _setup_ai_service(self) -> None:
        """Configure Azure OpenAI as the chat completion service."""
        service = AzureChatCompletion(
            deployment_name=settings.azure_openai.deployment_name,
            endpoint=settings.azure_openai.endpoint,
            api_key=settings.azure_openai.api_key,
            api_version=settings.azure_openai.api_version,
            service_id=self._service_id,
        )
        self.kernel.add_service(service)

    def _get_execution_settings(
        self, temperature: float = 0.3, max_tokens: int = 4096
    ) -> OpenAIChatPromptExecutionSettings:
        """
        Execution settings with auto function calling.

        FunctionChoiceBehavior.Auto() tells SK to:
        1. Send registered functions as tools to the LLM
        2. When LLM returns tool_call, execute the function
        3. Send result back to LLM
        4. Repeat until LLM responds with text (no more tool calls)
        """
        exec_settings = OpenAIChatPromptExecutionSettings(
            service_id=self._service_id,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        exec_settings.function_choice_behavior = FunctionChoiceBehavior.Auto(
            auto_invoke=True,
            filters={"included_plugins": self._get_plugin_names()},
        )
        return exec_settings

    def _get_plugin_names(self) -> list[str]:
        return list(self.kernel.plugins.keys()) if self.kernel.plugins else []

    async def run(self, user_input: str, **kwargs) -> dict[str, Any]:
        """
        Execute the agent with user input.

        Handles the full tool-calling loop automatically via SK:
        User message → LLM → tool calls → execute skills → results → LLM → final text

        Returns structured dict parsed from the agent's JSON response.
        """
        self.history.add_user_message(user_input)
        logger.info("agent.run.start", agent=self.agent_name, input_length=len(user_input))

        try:
            chat_service = self.kernel.get_service(self._service_id)
            exec_settings = self._get_execution_settings()

            # SK handles the full tool-calling loop here
            result = await chat_service.get_chat_message_contents(
                chat_history=self.history,
                settings=exec_settings,
                kernel=self.kernel,
            )

            response_text = ""
            if result:
                for msg in result:
                    if msg.content:
                        response_text += msg.content
                    self.history.add_message(msg)

            output = self._parse_structured_output(response_text)
            logger.info(
                "agent.run.complete",
                agent=self.agent_name,
                output_keys=list(output.keys()) if isinstance(output, dict) else "text",
                history_length=len(self.history),
            )
            return output

        except Exception as e:
            logger.error("agent.run.error", agent=self.agent_name, error=str(e))
            raise

    def _parse_structured_output(self, text: str) -> dict[str, Any]:
        """Parse agent response as JSON. Handles code blocks and embedded JSON."""
        clean = text.strip()

        # Extract from ```json ... ``` blocks
        if "```json" in clean:
            start = clean.index("```json") + 7
            rest = clean[start:]
            end = rest.index("```") if "```" in rest else len(rest)
            clean = rest[:end].strip()
        elif clean.startswith("```"):
            clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        # Direct JSON parse
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            pass

        # Find first JSON object in text
        for i, ch in enumerate(clean):
            if ch == "{":
                depth = 0
                for j in range(i, len(clean)):
                    if clean[j] == "{":
                        depth += 1
                    elif clean[j] == "}":
                        depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(clean[i : j + 1])
                        except json.JSONDecodeError:
                            break
                break

        return {"text": text}

    async def chat(self, message: str) -> str:
        """
        Chat interaction for the side-drawer feature.
        Agent can still call tools to answer questions.
        """
        self.history.add_user_message(message)
        chat_service = self.kernel.get_service(self._service_id)
        exec_settings = self._get_execution_settings(temperature=0.5)

        result = await chat_service.get_chat_message_contents(
            chat_history=self.history,
            settings=exec_settings,
            kernel=self.kernel,
        )

        response = ""
        if result:
            for msg in result:
                if msg.content:
                    response += msg.content
                self.history.add_message(msg)

        return response

    def get_history_summary(self) -> dict:
        return {
            "agent": self.agent_name,
            "message_count": len(self.history),
            "plugins": self._get_plugin_names(),
        }

    def reset(self) -> None:
        self.history = ChatHistory()
        self.history.add_system_message(self.system_prompt)
        logger.info("agent.reset", agent=self.agent_name)
