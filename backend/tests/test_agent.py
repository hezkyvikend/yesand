"""Tests for the yes-and agent turn."""

from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import SystemMessage

from yesand.agent import run_agent_turn


class TestRunAgentTurn:
    """Tests for run_agent_turn."""

    async def test_returns_string(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Yes, and a bird lands on the windowsill."))

        with patch("yesand.agent.ChatOpenAI", return_value=mock_llm):
            result = await run_agent_turn(sample_persona, sample_history)

        assert isinstance(result, str)
        assert "bird" in result

    async def test_system_prompt_included(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="response"))

        with patch("yesand.agent.ChatOpenAI", return_value=mock_llm):
            await run_agent_turn(sample_persona, sample_history)

        call_args = mock_llm.ainvoke.call_args[0][0]
        assert isinstance(call_args[0], SystemMessage)
        assert call_args[0].content == sample_persona.agent_system_prompt

    async def test_full_history_forwarded(self, sample_persona, sample_history):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="response"))

        with patch("yesand.agent.ChatOpenAI", return_value=mock_llm):
            await run_agent_turn(sample_persona, sample_history)

        call_args = mock_llm.ainvoke.call_args[0][0]
        # 1 system + 4 history messages
        assert len(call_args) == 5

    async def test_empty_history(self, sample_persona):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="Let's begin!"))

        with patch("yesand.agent.ChatOpenAI", return_value=mock_llm):
            result = await run_agent_turn(sample_persona, [])

        assert isinstance(result, str)
        call_args = mock_llm.ainvoke.call_args[0][0]
        # Only the system message
        assert len(call_args) == 1
