"""Tests for the image prompt synthesizer."""

from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import HumanMessage, SystemMessage

from yesand.synthesizer import synthesize_image_prompt


class TestSynthesizeImagePrompt:
    """Tests for synthesize_image_prompt."""

    async def test_returns_string(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(
            return_value=MagicMock(content="A sun-drenched kitchen with an orange cat sleeping on newspapers...")
        )

        with patch("yesand.synthesizer.ChatOpenAI", return_value=mock_llm):
            result = await synthesize_image_prompt(sample_persona, sample_history)

        assert isinstance(result, str)
        assert "kitchen" in result

    async def test_conversation_flattened_in_call(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="prompt"))

        with patch("yesand.synthesizer.ChatOpenAI", return_value=mock_llm):
            await synthesize_image_prompt(sample_persona, sample_history)

        call_args = mock_llm.ainvoke.call_args[0][0]
        # Should be [SystemMessage, HumanMessage with transcript]
        assert len(call_args) == 2
        assert isinstance(call_args[1], HumanMessage)
        assert "human:" in call_args[1].content
        assert "ai:" in call_args[1].content

    async def test_synthesizer_system_prompt_used(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="prompt"))

        with patch("yesand.synthesizer.ChatOpenAI", return_value=mock_llm):
            await synthesize_image_prompt(sample_persona, sample_history)

        call_args = mock_llm.ainvoke.call_args[0][0]
        assert isinstance(call_args[0], SystemMessage)
        assert call_args[0].content == sample_persona.synthesizer_system_prompt
