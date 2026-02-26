"""Persona loading and management from YAML configuration files."""

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel

PERSONAS_DIR = Path(__file__).resolve().parent.parent / "personas"


class PersonaVoice(BaseModel):
    tone: str
    rhythm: str


class PersonaAesthetic(BaseModel):
    pulls_toward: list[str]
    pulls_away_from: list[str]


class Persona(BaseModel):
    id: str
    name: str
    tagline: str
    voice: PersonaVoice
    aesthetic: PersonaAesthetic
    agent_system_prompt: str
    synthesizer_system_prompt: str


@lru_cache(maxsize=1)
def load_personas() -> dict[str, Persona]:
    """Load all persona YAML files from the personas directory.

    Returns a dict mapping persona ID to Persona object.
    Cached after first call — use load_personas.cache_clear() to reset.
    """
    personas: dict[str, Persona] = {}
    for yaml_path in sorted(PERSONAS_DIR.glob("*.yaml")):
        with open(yaml_path) as f:
            data = yaml.safe_load(f)
        persona = Persona(**data)
        personas[persona.id] = persona
    return personas


def get_persona(persona_id: str) -> Persona | None:
    """Look up a persona by ID. Returns None if not found."""
    return load_personas().get(persona_id)
