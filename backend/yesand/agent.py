"""Yes-and agent turn using LangChain ChatOpenAI."""

from typing import AsyncGenerator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from yesand.config import get_text_model
from yesand.persona import Persona


async def run_agent_turn(persona: Persona, history: list[dict]) -> str:
    """Run a single yes-and improv turn for the given persona.

    Args:
        persona: The active persona with system prompt and style.
        history: Conversation history as list of {"role": "human"|"ai", "content": str}.

    Returns:
        The AI's response text.
    """
    messages = [SystemMessage(content=persona.agent_system_prompt)]

    for msg in history:
        if msg["role"] == "human":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    llm = ChatOpenAI(model=get_text_model("gpt-4o"), temperature=0.9)
    response = await llm.ainvoke(messages)
    return ensure_yes_and(response.content)


def ensure_yes_and(text: str) -> str:
    if not text:
        return "yes, and"
    stripped = text.lstrip()
    if stripped.lower().startswith("yes, and"):
        return stripped
    return f"yes, and {stripped}"


async def stream_agent_turn(persona: Persona, history: list[dict]) -> AsyncGenerator[str, None]:
    """Stream a yes-and improv turn for the given persona.

    Yields text chunks as they arrive from the LLM.
    """
    messages = [SystemMessage(content=persona.agent_system_prompt)]

    for msg in history:
        if msg["role"] == "human":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    llm = ChatOpenAI(model=get_text_model("gpt-5-mini"), temperature=0.9, streaming=True)
    buffer = ""
    started = False

    async for chunk in llm.astream(messages):
        content = getattr(chunk, "content", "")
        if not content:
            continue

        if not started:
            buffer += content
            candidate = buffer.lstrip()
            if len(candidate) < len("yes, and"):
                continue
            if candidate.lower().startswith("yes, and"):
                yield buffer
            else:
                yield f"yes, and {candidate}"
            buffer = ""
            started = True
            continue

        yield content

    if not started and buffer:
        yield ensure_yes_and(buffer)
