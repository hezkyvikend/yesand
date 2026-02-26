"""Shared test fixtures for the yes-and backend."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from yesand.persona import Persona, PersonaAesthetic, PersonaVoice


@pytest.fixture
def sample_persona() -> Persona:
    """A pre-built Persona object for tests that don't need YAML I/O."""
    return Persona(
        id="test_persona",
        name="Test Persona",
        tagline="A persona for testing",
        voice=PersonaVoice(tone="Neutral", rhythm="Even"),
        aesthetic=PersonaAesthetic(
            pulls_toward=["Simplicity"],
            pulls_away_from=["Complexity"],
        ),
        agent_system_prompt="You are a test persona. Respond briefly.",
        synthesizer_system_prompt="You are a test synthesizer. Create a simple image prompt.",
    )


@pytest.fixture
def sample_history() -> list[dict]:
    """A realistic conversation history with human/ai turns."""
    return [
        {"role": "human", "content": "Let's start with a quiet kitchen in the morning."},
        {"role": "ai", "content": "Yes, and sunlight streams through a window above the sink, catching the steam rising from a forgotten cup of tea."},
        {"role": "human", "content": "And there's a cat sleeping on a pile of newspapers on the table."},
        {"role": "ai", "content": "Yes, and the cat's orange fur glows in that warm light, one paw dangling off the edge of the table."},
    ]


@pytest.fixture
def personas_dir() -> Path:
    """Path to the test personas directory."""
    return Path(__file__).resolve().parent / "personas"


@pytest.fixture
async def client():
    """Async FastAPI test client."""
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
