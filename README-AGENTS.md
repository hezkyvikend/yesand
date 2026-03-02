# Yes-And Agent Engineering Reference

This document is for coding agents working in this repository. It is intentionally implementation-heavy and reflects the current codebase.

## 1. Product Thesis and System Model

Yes-And treats AI as a collaborator, not a command executor. The UX is designed around improv constraints:
- Human and model co-build one visual scene.
- Model answers must begin with "yes, and".
- Each turn should add one concrete visual detail.
- A final image prompt is synthesized from the entire transcript.

Technical consequence:
- Frontend owns session/conversation state.
- Backend is stateless and expects full message history every call.

## 2. Monorepo Layout

```
yesand/
├── backend/
│   ├── main.py                     # FastAPI app, routes, error model
│   ├── personas/*.yaml             # Persona definitions + prompt templates
│   ├── yesand/
│   │   ├── agent.py                # Chat turn generation + streaming
│   │   ├── synthesizer.py          # Transcript -> image prompt
│   │   ├── image.py                # OpenAI image generation wrapper
│   │   ├── persona.py              # Persona schema + loader cache
│   │   ├── prompt_templates.py     # {{suggestion_word}} rendering
│   │   ├── config.py               # Runtime env readers
│   │   └── words.py                # Audience suggestion pool
│   └── tests/                      # Unit/integration tests
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Top-level orchestration
│   │   ├── api.js                  # Fetch layer + structured ApiError
│   │   ├── state/sessionReducer.js # UI state machine
│   │   └── components/             # Terminal UI + animation
│   └── staticwebapp.config.json    # SPA fallback rewrite
└── .github/workflows/
    ├── azure-static-web-apps.yml   # Frontend deploy pipeline
    └── azure-container-apps.yml    # Backend deploy pipeline
```

## 3. Runtime Architecture

### 3.1 End-to-End Flow

1. Frontend loads personas: `GET /personas`.
2. Frontend gets audience prompt: `GET /suggest`.
3. User chats with persona via `POST /chat/stream` (primary path in UI).
4. Frontend sends full transcript + suggestion word to `POST /generate`.
5. Backend synthesizes single image prompt, calls OpenAI Images API, returns URL.
6. Frontend reveals image and can download via `GET /proxy-image`.

### 3.2 Stateless Contract

Backend stores no conversation state. Requests must include:
- `persona_id`
- full `messages` array (`human` and `ai` roles)
- `suggestion_word` (optional field, but intended to be present in normal flow)

### 3.3 Route Prefixes

Router is mounted twice:
- root: `/chat`, `/generate`, etc.
- prefixed: `/api/chat`, `/api/generate`, etc.

Frontend defaults to `/api` unless `VITE_API_BASE` overrides it.

## 4. Backend Deep Dive

### 4.1 API Endpoints

- `GET /personas`
  - Returns metadata (`id`, `name`, `tagline`, `aesthetic`).
- `POST /chat`
  - Non-streaming chat turn.
- `POST /chat/stream`
  - SSE streaming chat turn.
- `POST /generate`
  - Transcript synthesis + image generation.
- `GET /suggest`
  - Returns random uppercase suggestion word.
- `GET /proxy-image?url=<blob-url>`
  - Validates Azure blob host suffix and proxies image bytes for download.

### 4.2 Request/Response Models

`ChatRequest` and `GenerateRequest`:
- `persona_id: str`
- `messages: list[{role, content}]`
- `suggestion_word: str | None`

`GenerateResponse`:
- `image_url: str`
- `prompt_used: str`

### 4.3 Structured Error Contract

Error responses use FastAPI `HTTPException` with:
- HTTP status (400/404/502)
- `detail` object:
  - `message`
  - `code`
  - `request_id`
  - `stage`
  - `retryable`
  - optional `upstream_error`
- `X-Request-Id` header (for non-SSE failures)

Common `code` values:
- `unknown_persona`
- `chat_model_error`
- `chat_stream_error` (inside SSE event payload)
- `synthesizer_error`
- `image_generation_error`
- `image_url_missing`
- `invalid_image_url`
- `image_proxy_fetch_failed`

### 4.4 Tracing and Metadata

`build_trace_context()` extracts request headers:
- `X-User-Id`
- `X-Session-Id`
- `X-Conversation-Id`
- optional incoming `X-Request-Id` or generated UUID

Metadata/tags are propagated to LangChain/OpenAI calls, and suggestion word is added into metadata when present.

### 4.5 Prompt Templating and Suggestion Injection

`yesand/prompt_templates.py`:
- placeholder token: `{{suggestion_word}}`
- `render_system_prompt(template, suggestion_word)` behavior:
  - if no suggestion: returns template unchanged
  - if placeholder exists: replaces placeholder
  - else: appends fallback line `AUDIENCE_SUGGESTION_WORD: <word>`

Both chat and synthesizer system prompts are rendered this way before model invocation.

### 4.6 LLM and Image Invocation Details

`yesand/agent.py`:
- `run_agent_turn()`:
  - model default: `gpt-4o` (overridable via `OPENAI_TEXT_MODEL`)
  - temperature `0.9`
  - `ensure_yes_and()` enforces prefix
- `stream_agent_turn()`:
  - model default: `gpt-5-mini` (same env override key)
  - temperature `0.9`, streaming enabled
  - buffers first chunks to enforce "yes, and" at stream start

`yesand/synthesizer.py`:
- model default: `gpt-4o` (same env override key)
- temperature `0.3`
- transcript format:
  - `human: ...`
  - `ai: ...`

`yesand/image.py`:
- uses `AsyncOpenAI` wrapped with LangSmith wrapper
- request:
  - model from `OPENAI_IMAGE_MODEL` (default `dall-e-2`)
  - `size` from `OPENAI_IMAGE_SIZE` (default `1024x1024`)
  - `n=1`
  - `quality` only when model is `dall-e-3`
- returns `response.data[0].url`
- if route sees falsy URL, backend returns explicit `502 image_url_missing`

### 4.7 Personas

Persona YAMLs live in `backend/personas/`.

Schema:
- identity fields: `id`, `name`, `tagline`
- style fields: `voice`, `aesthetic`
- prompts:
  - `agent_system_prompt`
  - `synthesizer_system_prompt`

Current personas:
- `romantic`
- `brutalist`
- `magical_realist`
- `documentarian`
- `maximalist`

`load_personas()` is cached (`@lru_cache(maxsize=1)`), so call `load_personas.cache_clear()` in tests when needed.

## 5. Frontend Deep Dive

### 5.1 API Layer

`frontend/src/api.js`:
- base URL:
  - `import.meta.env.VITE_API_BASE ?? '/api'`
- sends identity headers when available:
  - `X-User-Id`, `X-Session-Id`, `X-Conversation-Id`
- wraps failures in `ApiError` with normalized fields:
  - status/code/stage/retryable/requestId/upstreamError/endpoint/method
- `formatErrorForDisplay()` formats multi-line terminal-friendly errors

SSE protocol handling:
- expects blocks separated by `\n\n`
- parses `data:` lines only
- payload types:
  - `chunk`
  - `done`
  - `error`

### 5.2 Session State Machine

`frontend/src/state/sessionReducer.js` phases:
- `IDLE`
- `LOADING`
- `READY`
- `CHATTING`
- `GENERATING`
- `REVEALING`
- `FINISHED`

Important guards:
- `IMAGE_READY` only accepted in `GENERATING`
- `GENERATE_FAILED` only accepted in `GENERATING`

This prevents stale async completions from overriding current state.

### 5.3 Generate Race Protection

`App.jsx` uses `generateInFlightRef` lock:
- blocks concurrent generate requests
- avoids double-click race where one failing request could previously roll back a successful reveal

### 5.4 Identity and Trace Headers

`frontend/src/state/identity.js`:
- user ID persisted in `localStorage`
- session ID in `sessionStorage`
- conversation ID in `localStorage`
- new persona selection starts a new conversation ID

### 5.5 Loading Sequence

`LoadingSequence` drives startup animation script and typing speeds:
- scene partner load lines
- persona style lines
- audience suggestion wait + reveal

Recent tuning made sequence faster than original but slower than "ultra-fast" variant.

### 5.6 Current UI Request Usage

App currently uses:
- `streamChat(...)` for chat
- `generateImage(...)` for image generation

`sendMessage(...)` exists in API module but is not used by `App.jsx` at the moment.

## 6. Environment Configuration

### 6.1 Backend (`backend/.env`)

Required:
- `OPENAI_API_KEY`

Common optional:
- `OPENAI_TEXT_MODEL`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_IMAGE_SIZE`
- `OPENAI_IMAGE_QUALITY`
- `OPENAI_IMAGE_COST_USD`
- `CORS_ORIGINS`
- `LANGSMITH_TRACING`
- `LANGSMITH_API_KEY`
- `LANGSMITH_PROJECT`
- `LANGSMITH_ENDPOINT`
- `LANGSMITH_WORKSPACE_ID`

Notes:
- `config.py` re-reads `.env` dynamically on each access.
- default CORS behavior is permissive (`*`) when `CORS_ORIGINS` is unset.

### 6.2 Frontend (`frontend/.env`)

- `VITE_API_BASE=http://localhost:8000` for local split-origin dev.
- If gateway/same-origin routing is present, use `VITE_API_BASE=/api`.
- If unset, frontend defaults to `/api`.

## 7. Local Development Commands

Backend:
```bash
cd backend
uv sync --all-extras
uv run uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## 8. Testing and Verification

### 8.1 Backend Tests

```bash
cd backend
uv run pytest -q
```

Current suite covers:
- persona loading
- agent and synthesizer contracts
- image wrapper behavior
- main route integration (including structured error paths and suggestion forwarding)

### 8.2 Frontend Checks

Build:
```bash
cd frontend
npm run build
```

Lint:
```bash
cd frontend
npm run lint
```

Current repo status:
- build passes
- lint has existing React hook plugin errors in multiple files (pre-existing; not all are tied to current feature work)

### 8.3 Testing Conventions

- Patch where symbols are imported/used, not where originally defined.
  - Example: patch `"main.run_agent_turn"` in route tests.
- Use `AsyncMock` for async functions.
- Clear persona cache in tests touching persona loader behavior:
  - `load_personas.cache_clear()`

## 9. Deployment and CI/CD

Two production workflows exist:

### 9.1 Frontend: Azure Static Web Apps

File:
- `.github/workflows/azure-static-web-apps.yml`

Triggers:
- push to `main` with `frontend/**` changes
- pull requests targeting `main` with `frontend/**` changes
- manual dispatch

Secret dependency:
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

### 9.2 Backend: Azure Container Apps

File:
- `.github/workflows/azure-container-apps.yml`

Triggers:
- push to `main` with `backend/**` changes
- manual dispatch

Pipeline summary:
- Azure login via `AZURE_CREDENTIALS`
- ACR build (`az acr build`)
- Container App update to image `${GITHUB_SHA}`
- env vars set via Azure secret refs

## 10. Common Agent Playbooks

### 10.1 Add/Change an API Endpoint

1. Update request/response models in `backend/main.py`.
2. Implement route + structured errors (`_build_error_detail`, `_error_response`).
3. Add tests in `backend/tests/test_main.py`.
4. Update frontend `api.js` if endpoint is client-facing.
5. Wire app state updates in `App.jsx`/`sessionReducer.js` if needed.

### 10.2 Add a New Persona

1. Add YAML under `backend/personas/<id>.yaml`.
2. Include both prompt fields and keep `{{suggestion_word}}` in templates.
3. Ensure style metadata is present (`aesthetic` lists).
4. (Optional) add tests for persona-specific behavior.

### 10.3 Debug "Image Generated in LangSmith but UI Failed"

Check in order:
1. Frontend race/stale actions (`generateInFlightRef`, reducer phase guards).
2. Backend `/generate` error code and `request_id`.
3. `image_url_missing` or upstream `image_generation_error`.
4. Correlate `request_id` with LangSmith traces.

### 10.4 Debug Frontend API Errors

1. Inspect terminal-rendered error block (status, code, stage, request id).
2. Re-run request with curl including same payload.
3. Confirm `VITE_API_BASE` target and CORS origin.

## 11. Known Gotchas

- Backend routes exist under both `/` and `/api`; avoid duplicating assumptions.
- DALL-E blob URLs are temporary; `proxy-image` is for download path.
- `OPENAI_TEXT_MODEL` env overrides both chat and synthesizer model defaults.
- `chat/stream` has explicit SSE error event payload shape; keep client parser aligned.
- `.claude/settings.local.json` may be tracked locally in some clones; do not assume it is safe to modify/commit.

## 12. File Index for Fast Navigation

Backend core:
- `backend/main.py`
- `backend/yesand/agent.py`
- `backend/yesand/synthesizer.py`
- `backend/yesand/image.py`
- `backend/yesand/prompt_templates.py`
- `backend/yesand/persona.py`

Frontend core:
- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/state/sessionReducer.js`
- `frontend/src/components/Terminal/Terminal.jsx`
- `frontend/src/components/LoadingSequence/LoadingSequence.jsx`

Infra:
- `.github/workflows/azure-static-web-apps.yml`
- `.github/workflows/azure-container-apps.yml`
- `backend/Dockerfile`
