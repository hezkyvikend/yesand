"""Tests for persona loading and Pydantic models."""

from unittest.mock import patch

import pytest
from pydantic import ValidationError

from yesand.persona import Persona, PersonaAesthetic, PersonaVoice, get_persona, load_personas


class TestPersonaModel:
    """Tests for the Persona Pydantic model."""

    def test_valid_persona(self, sample_persona):
        assert sample_persona.id == "test_persona"
        assert sample_persona.name == "Test Persona"
        assert isinstance(sample_persona.voice, PersonaVoice)
        assert isinstance(sample_persona.aesthetic, PersonaAesthetic)

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            Persona(
                id="incomplete",
                name="Incomplete",
                # missing tagline, voice, aesthetic, prompts
            )

    def test_missing_voice_field(self):
        with pytest.raises(ValidationError):
            PersonaVoice(tone="Warm")  # missing rhythm


class TestLoadPersonas:
    """Tests for YAML loading functions."""

    def test_load_personas_from_yaml(self, personas_dir):
        load_personas.cache_clear()
        with patch("yesand.persona.PERSONAS_DIR", personas_dir):
            result = load_personas()

        assert isinstance(result, dict)
        assert "test_persona" in result
        assert result["test_persona"].name == "Test Persona"

    def test_get_persona_found(self, personas_dir):
        load_personas.cache_clear()
        with patch("yesand.persona.PERSONAS_DIR", personas_dir):
            persona = get_persona("test_persona")

        assert persona is not None
        assert persona.id == "test_persona"

    def test_get_persona_not_found(self, personas_dir):
        load_personas.cache_clear()
        with patch("yesand.persona.PERSONAS_DIR", personas_dir):
            persona = get_persona("nonexistent")

        assert persona is None

    def test_lru_cache_returns_same_object(self, personas_dir):
        load_personas.cache_clear()
        with patch("yesand.persona.PERSONAS_DIR", personas_dir):
            first = load_personas()
            second = load_personas()

        assert first is second
