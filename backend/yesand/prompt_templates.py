"""Utilities for rendering prompt templates with runtime context."""

SUGGESTION_PLACEHOLDER = "{{suggestion_word}}"


def render_system_prompt(template: str, suggestion_word: str | None) -> str:
    """Render a persona system prompt with optional audience suggestion word."""
    suggestion = (suggestion_word or "").strip()
    if not suggestion:
        return template

    if SUGGESTION_PLACEHOLDER in template:
        return template.replace(SUGGESTION_PLACEHOLDER, suggestion)

    # Backward-compatible fallback for prompts that do not yet declare a placeholder.
    return f"{template}\n\nAUDIENCE_SUGGESTION_WORD: {suggestion}"
