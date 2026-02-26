# Yes, And — Collaborative Image Creation Chatbot

A FastAPI backend for a collaborative image creation chatbot where users co-create visual scenes through iterative "yes, and" improv with persona-driven AI agents. When satisfied with the scene, users trigger image generation (DALL-E 3) from the accumulated conversation.

## Architecture

**Stateless backend** — the frontend owns conversation history and sends it in full on every request. No database, no sessions.

### Core Flow

1. **Chat** (`POST /chat`) — User sends a message + full conversation history + chosen persona. The agent responds with a single "yes, and" turn, adding one visual detail to the scene.
2. **Generate** (`POST /generate`) — User sends the full conversation history. The synthesizer flattens it into a DALL-E prompt, then the image generator produces the image.
3. **Personas** (`GET /personas`) — Returns metadata for all available artistic personas.

### Module Responsibilities

| Module | Purpose |
|---|---|
| `main.py` | FastAPI app, routes, CORS, request/response models |
| `yesand/persona.py` | Pydantic models + YAML loader with `lru_cache` |
| `yesand/agent.py` | LangChain `ChatOpenAI` — runs one "yes, and" improv turn |
| `yesand/synthesizer.py` | Flattens conversation into a transcript, produces a DALL-E prompt |
| `yesand/image.py` | `AsyncOpenAI` wrapper for DALL-E 3 image generation |

## Project Structure

```
backend/
├── personas/                  # Persona YAML definitions
│   ├── romantic.yaml
│   ├── brutalist.yaml
│   ├── magical_realist.yaml
│   ├── documentarian.yaml
│   └── maximalist.yaml
├── yesand/                    # Core library
│   ├── __init__.py
│   ├── persona.py
│   ├── agent.py
│   ├── synthesizer.py
│   └── image.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # Shared fixtures
│   ├── personas/
│   │   └── test_persona.yaml  # Test fixture YAML
│   ├── test_persona.py
│   ├── test_agent.py
│   ├── test_synthesizer.py
│   ├── test_image.py
│   └── test_main.py           # FastAPI integration tests
├── main.py
├── pyproject.toml
├── .env.example
└── .gitignore
```

## Setup

Requires Python >= 3.11 and [uv](https://docs.astral.sh/uv/).

```bash
cd backend

# Install dependencies (including dev)
uv sync --all-extras

# Configure environment
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY
```

## Running

```bash
cd backend
uv run uvicorn main:app --reload --port 8000
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

## Testing

All tests use mocked LLM/image API calls — no OpenAI key needed.

```bash
cd backend

uv run pytest          # All tests
uv run pytest -v       # Verbose (shows each test name)
uv run pytest -x       # Stop on first failure
uv run pytest -s       # Show print output

# Single file or test
uv run pytest tests/test_agent.py
uv run pytest tests/test_agent.py::TestRunAgentTurn::test_returns_string
```

## API Reference

### `GET /personas`

Returns metadata for all available personas.

```json
{
  "personas": [
    { "id": "magical_realist", "name": "The Magical Realist", "tagline": "Finding the extraordinary hidden in the everyday" },
    { "id": "romantic", "name": "The Romantic", "tagline": "Golden hour light and emotional resonance" }
  ]
}
```

### `POST /chat`

Run a single "yes, and" conversation turn.

**Request:**
```json
{
  "persona_id": "magical_realist",
  "messages": [
    { "role": "human", "content": "A quiet kitchen in the morning." },
    { "role": "ai", "content": "Yes, and sunlight streams through the window..." }
  ]
}
```

**Response:**
```json
{
  "message": "Yes, and a cat sleeps on newspapers, its orange fur glowing..."
}
```

### `POST /generate`

Synthesize a DALL-E prompt from the conversation and generate an image.

**Request:** Same shape as `/chat`.

**Response:**
```json
{
  "image_url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
  "prompt_used": "A sun-drenched kitchen with an orange cat sleeping on newspapers..."
}
```

### Error Codes

| Code | Meaning |
|---|---|
| 404 | Unknown `persona_id` |
| 422 | Invalid request body |
| 502 | LLM or image API failure |

## Personas

Each persona is defined in a YAML file under `backend/personas/` with this schema:

```yaml
id: magical_realist          # Matches filename (without .yaml)
name: "The Magical Realist"
tagline: "Finding the extraordinary hidden in the everyday"
voice:
  tone: "Warm, wondering, matter-of-fact about the impossible"
  rhythm: "Flowing sentences that drift between the mundane and the miraculous"
aesthetic:
  pulls_toward: ["Lush, saturated color", "Dreamlike lighting"]
  pulls_away_from: ["Sterile digital perfection", "Cool minimalism"]
agent_system_prompt: |
  <multiline — yes-and improv instructions in this persona's voice>
synthesizer_system_prompt: |
  <multiline — instructions to produce a DALL-E prompt in this style>
```

**Available personas:** romantic, brutalist, magical_realist, documentarian, maximalist.

## Key Design Decisions

- **Roles:** `human` / `ai` (matches LangChain naming conventions)
- **Stateless:** Frontend sends full conversation history on every request. No server-side state.
- **CORS:** `allow_origins=["*"]` for development. Tighten for production.
- **dotenv:** `load_dotenv()` at the top of `main.py`, before other imports, so `OPENAI_API_KEY` is available when modules initialize.
- **Error handling:** 404 for unknown persona, 502 for LLM/image API failures.
- **LLM config:** Agent uses `temperature=0.9` (creative improv), synthesizer uses `temperature=0.3` (focused extraction). Both use `gpt-4o`.
- **Image generation:** DALL-E 3, 1024x1024, standard quality.
- **Caching:** `load_personas()` uses `@lru_cache(maxsize=1)`. Call `.cache_clear()` if persona files change at runtime.

## Testing Patterns

Key conventions used across tests:

- **Patch where it's looked up, not where it's defined.** If `main.py` does `from yesand.agent import run_agent_turn`, patch `"main.run_agent_turn"`.
- **`AsyncMock` for async functions.** Use `new_callable=AsyncMock` in `patch()`.
- **`lru_cache` isolation.** Call `load_personas.cache_clear()` at the start of tests that load personas to prevent cross-test contamination.
- **`asyncio_mode = "auto"`** in `pyproject.toml` — no `@pytest.mark.asyncio` decorators needed.
- **`pythonpath = ["."]`** — allows `from yesand.persona import ...` without an editable install.

## Development Notes for AI Agents

When working on this codebase:

- All commands should be run from `backend/` since `pyproject.toml`, `main.py`, and all paths are relative to that directory.
- The `yesand/__init__.py` is empty — no re-exports.
- `PERSONAS_DIR` in `persona.py` resolves to `backend/personas/` via `Path(__file__).resolve().parent.parent / "personas"`.
- To add a new persona: create a YAML file in `personas/`, matching the schema above. The loader picks up all `*.yaml` files in that directory automatically.
- To add a new endpoint: add request/response models and a route function in `main.py`, with corresponding module(s) in `yesand/` if needed.
- DALL-E image URLs are temporary (expire after ~1 hour). The frontend should download/cache them if persistence is needed.
