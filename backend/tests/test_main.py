"""FastAPI integration tests for the yes-and backend."""

from unittest.mock import AsyncMock, patch

from yesand.persona import load_personas


class TestGetPersonas:
    """Tests for GET /personas."""

    async def test_returns_persona_list(self, client):
        load_personas.cache_clear()
        response = await client.get("/personas")
        assert response.status_code == 200

        data = response.json()
        assert "personas" in data
        assert isinstance(data["personas"], list)
        assert len(data["personas"]) > 0

        first = data["personas"][0]
        assert "id" in first
        assert "name" in first
        assert "tagline" in first
        assert "aesthetic" in first
        assert "pulls_toward" in first["aesthetic"]
        assert "pulls_away_from" in first["aesthetic"]

    async def test_personas_have_correct_fields(self, client):
        load_personas.cache_clear()
        response = await client.get("/personas")
        data = response.json()

        ids = {p["id"] for p in data["personas"]}
        assert "magical_realist" in ids
        assert "romantic" in ids
        assert "brutalist" in ids


class TestPostChat:
    """Tests for POST /chat."""

    async def test_chat_returns_message(self, client):
        with patch("main.run_agent_turn", new_callable=AsyncMock, return_value="Yes, and the light shifts."):
            response = await client.post("/chat", json={
                "persona_id": "magical_realist",
                "messages": [{"role": "human", "content": "A quiet room."}],
            })

        assert response.status_code == 200
        assert response.json()["message"] == "Yes, and the light shifts."

    async def test_chat_unknown_persona_404(self, client):
        response = await client.post("/chat", json={
            "persona_id": "nonexistent",
            "messages": [{"role": "human", "content": "Hello."}],
        })
        assert response.status_code == 404

    async def test_chat_invalid_body_422(self, client):
        response = await client.post("/chat", json={"bad": "data"})
        assert response.status_code == 422

    async def test_chat_llm_error_502(self, client):
        with patch("main.run_agent_turn", new_callable=AsyncMock, side_effect=Exception("LLM down")):
            response = await client.post("/chat", json={
                "persona_id": "magical_realist",
                "messages": [{"role": "human", "content": "Hello."}],
            })

        assert response.status_code == 502


class TestPostGenerate:
    """Tests for POST /generate."""

    async def test_generate_returns_image_and_prompt(self, client):
        with (
            patch("main.synthesize_image_prompt", new_callable=AsyncMock, return_value="A dreamy kitchen scene"),
            patch("main.generate_image", new_callable=AsyncMock, return_value="https://example.com/img.png"),
        ):
            response = await client.post("/generate", json={
                "persona_id": "magical_realist",
                "messages": [
                    {"role": "human", "content": "A kitchen."},
                    {"role": "ai", "content": "Yes, and butterflies."},
                ],
            })

        assert response.status_code == 200
        data = response.json()
        assert data["image_url"] == "https://example.com/img.png"
        assert data["prompt_used"] == "A dreamy kitchen scene"

    async def test_generate_unknown_persona_404(self, client):
        response = await client.post("/generate", json={
            "persona_id": "nonexistent",
            "messages": [{"role": "human", "content": "Hello."}],
        })
        assert response.status_code == 404

    async def test_generate_calls_synthesizer_then_image(self, client):
        """Verify the synthesizer is called before image generation."""
        call_order = []

        async def mock_synthesize(*args, **kwargs):
            call_order.append("synthesize")
            return "prompt text"

        async def mock_generate(*args, **kwargs):
            call_order.append("generate")
            return "https://example.com/img.png"

        with (
            patch("main.synthesize_image_prompt", side_effect=mock_synthesize),
            patch("main.generate_image", side_effect=mock_generate),
        ):
            await client.post("/generate", json={
                "persona_id": "magical_realist",
                "messages": [{"role": "human", "content": "A scene."}],
            })

        assert call_order == ["synthesize", "generate"]


class TestGetSuggest:
    """Tests for GET /suggest."""

    async def test_suggest_returns_word(self, client):
        with patch("main.get_suggestion", return_value="LIGHTHOUSE"):
            response = await client.get("/suggest")

        assert response.status_code == 200
        data = response.json()
        assert data["word"] == "LIGHTHOUSE"


class TestPostChatStream:
    """Tests for POST /chat/stream."""

    async def test_chat_streams_chunks_and_done(self, client):
        async def fake_stream(*_args, **_kwargs):
            yield "Yes, "
            yield "and the light shifts."

        with patch("main.stream_agent_turn", new=fake_stream):
            async with client.stream(
                "POST",
                "/chat/stream",
                json={
                    "persona_id": "magical_realist",
                    "messages": [{"role": "human", "content": "A quiet room."}],
                },
            ) as response:
                assert response.status_code == 200
                text = ""
                async for chunk in response.aiter_text():
                    text += chunk

        events = []
        for block in text.split("\n\n"):
            if not block.strip():
                continue
            data_lines = [line for line in block.split("\n") if line.startswith("data:")]
            if not data_lines:
                continue
            payload_text = "".join(line.replace("data:", "").strip() for line in data_lines)
            events.append(payload_text)

        assert events[0] == '{"type": "chunk", "content": "Yes, "}'
        assert events[1] == '{"type": "chunk", "content": "and the light shifts."}'
        assert events[-1] == '{"type": "done"}'
