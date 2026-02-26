"""Synthesize a DALL-E image prompt from conversation history."""

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from yesand.config import get_text_model
from yesand.persona import Persona


async def synthesize_image_prompt(persona: Persona, history: list[dict]) -> str:
    """Convert a conversation into a single DALL-E image generation prompt.

    Args:
        persona: The active persona with synthesizer system prompt.
        history: Conversation history as list of {"role": "human"|"ai", "content": str}.

    Returns:
        A DALL-E prompt string describing the collaborative scene.
    """
    transcript_lines = []
    for msg in history:
        label = "human" if msg["role"] == "human" else "ai"
        transcript_lines.append(f"{label}: {msg['content']}")
    transcript = "\n".join(transcript_lines)

    messages = [
        SystemMessage(content=persona.synthesizer_system_prompt),
        HumanMessage(content=transcript),
    ]

    llm = ChatOpenAI(model=get_text_model("gpt-4o"), temperature=0.3)
    response = await llm.ainvoke(messages)
    return response.content
