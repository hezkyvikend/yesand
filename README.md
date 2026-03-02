# Yes-And

Yes-And is an improv-style AI agent that co-creates a scene with you, then generates the final image with DALL-E 3.

**Thesis**
Yes-And is built on a specific creative stance: treat the AI as a collaborator, not a servant.  
Instead of issuing one-off commands, you and the model build an idea together through the improv rule of "yes, and" - accepting what exists, then adding one concrete detail at a time.

This shifts AI use from pure task execution toward imagination work:
- You are not just asking for output; you are co-developing a scene.
- The model is constrained to contribute constructively, not dominate or derail.
- The process is designed to push visual thinking, surprise, and creative momentum.

**Features**
- Live yes-and conversation with persona-driven voices.
- Streaming responses over Server-Sent Events (SSE).
- One-click image generation based on the conversation.
- Downloadable image via a backend proxy.

**Quickstart**
1. Backend setup:
```bash
cd /Users/josephgibli/Documents/yesand/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```
2. Add your OpenAI key (required):
```bash
# /Users/josephgibli/Documents/yesand/backend/.env
OPENAI_API_KEY=sk-your-key-here
OPENAI_IMAGE_MODEL=dall-e-3
```
3. Start the backend:
```bash
cd /Users/josephgibli/Documents/yesand/backend
python main.py
```
4. Frontend setup and local API wiring:
```bash
cd /Users/josephgibli/Documents/yesand/frontend
npm install
cp .env.example .env
```

Set the frontend API base for localhost in `/Users/josephgibli/Documents/yesand/frontend/.env`:
```bash
VITE_API_BASE=http://localhost:8000
```

5. Start the frontend:
```bash
cd /Users/josephgibli/Documents/yesand/frontend
npm run dev
```
6. Open the app:
- Vite will print the local URL (usually `http://localhost:5173`).

**Configuration**
Backend env (`/Users/josephgibli/Documents/yesand/backend/.env`):
- `OPENAI_API_KEY` is required.
- `OPENAI_IMAGE_MODEL` should be set to `dall-e-3` to use DALL-E 3.
- `OPENAI_IMAGE_SIZE` defaults to `1024x1024`.
- `OPENAI_IMAGE_QUALITY` defaults to `standard` for DALL-E 3.
- `OPENAI_IMAGE_COST_USD` sets a per-image cost for LangSmith tracking.
- `OPENAI_TEXT_MODEL` overrides the default text model used for chat and prompt synthesis.
- `CORS_ORIGINS` sets allowed origins as a comma-separated list (example: `https://your-app.azurestaticapps.net,http://localhost:5173`).
- `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, and `LANGSMITH_ENDPOINT` enable LangSmith monitoring.

Frontend env (`/Users/josephgibli/Documents/yesand/frontend/.env`):
- `VITE_API_BASE` is the API base URL used by the React app.
- For local development, set `VITE_API_BASE=http://localhost:8000`.
- If frontend and API are served from the same origin behind a gateway (for example with `/api` routing), set `VITE_API_BASE=/api`.
- The app code defaults to `/api` when `VITE_API_BASE` is not set.

**LangSmith Monitoring**
LangChain will emit traces automatically when LangSmith environment variables are set. Add these to `/Users/josephgibli/Documents/yesand/backend/.env`:
```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2-your-langsmith-key-here
LANGSMITH_PROJECT=yesand
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```
If your LangSmith API key is linked to multiple workspaces, set `LANGSMITH_WORKSPACE_ID` as well.

**Architecture**
High-level design:
1. Frontend is stateful: it stores the selected persona, suggestion word, and full chat transcript.
2. Backend is stateless: every chat/generate request includes full message history, persona ID, and suggestion word.
3. Persona prompts are YAML templates in `backend/personas/*.yaml`, dynamically rendered with the suggestion word before each LangChain call.
4. Backend traces calls with request/session metadata and surfaces structured errors with request IDs for debugging.

Request flow:
1. `GET /personas` loads persona metadata for the selector UI.
2. `GET /suggest` returns one audience suggestion word.
3. `POST /chat/stream` (or `POST /chat`) sends full conversation history and streams/returns the next "yes, and" turn.
4. `POST /generate` sends full conversation history, synthesizes one image prompt, then requests an image from OpenAI.
5. Frontend displays the image URL and uses `GET /proxy-image` for downloadable image bytes.

**Deployment (Azure + GitHub Actions)**
This repo already has GitHub Actions configured for Azure deployment in `.github/workflows/`.

Frontend (`.github/workflows/azure-static-web-apps.yml`):
- Deploys the Vite app to Azure Static Web Apps.
- Triggers on `push` to `main` when `frontend/**` changes, and on PR events targeting `main`.
- Supports manual runs via `workflow_dispatch`.
- Uses `AZURE_STATIC_WEB_APPS_API_TOKEN` secret.

Backend (`.github/workflows/azure-container-apps.yml`):
- Builds backend container image and deploys to Azure Container Apps.
- Triggers on `push` to `main` when `backend/**` changes.
- Supports manual runs via `workflow_dispatch`.
- Logs into Azure using `AZURE_CREDENTIALS`, builds/pushes image via ACR, then updates the Container App.
- Workflow targets the `production` environment and sets runtime env vars from Azure secret references.

**Repo Layout**
- `backend/` FastAPI app, LLM orchestration, persona definitions, and image generation.
- `backend/personas/` YAML persona configs and prompts.
- `frontend/` Vite + React UI and client-side state.
