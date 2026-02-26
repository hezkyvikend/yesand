"""Tests for the DALL-E image generation wrapper."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from openai import APIError

from yesand.image import generate_image


class TestGenerateImage:
    """Tests for generate_image."""

    async def test_returns_url_string(self):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(url="https://example.com/image.png")]

        mock_client = MagicMock()
        mock_client.images.generate = AsyncMock(return_value=mock_response)

        with patch("yesand.image.AsyncOpenAI", return_value=mock_client):
            result = await generate_image("a beautiful sunset")

        assert isinstance(result, str)
        assert result == "https://example.com/image.png"

    async def test_prompt_passed_to_api(self):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(url="https://example.com/image.png")]

        mock_client = MagicMock()
        mock_client.images.generate = AsyncMock(return_value=mock_response)

        with patch("yesand.image.AsyncOpenAI", return_value=mock_client):
            await generate_image("a cat in a kitchen")

        call_kwargs = mock_client.images.generate.call_args[1]
        assert call_kwargs["prompt"] == "a cat in a kitchen"

    async def test_api_error_propagates(self):
        mock_client = MagicMock()
        mock_client.images.generate = AsyncMock(
            side_effect=APIError(
                message="Rate limit exceeded",
                request=MagicMock(),
                body=None,
            )
        )

        with patch("yesand.image.AsyncOpenAI", return_value=mock_client):
            with pytest.raises(APIError):
                await generate_image("test prompt")
