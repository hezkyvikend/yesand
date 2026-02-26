# Yes-And

Yes-And is an improv-style AI agent that co-creates a scene with you, then generates the final image with DALL-E 3.

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
4. Frontend setup and start:
```bash
cd /Users/josephgibli/Documents/yesand/frontend
npm install
npm run dev
```
5. Open the app:
- Vite will print the local URL (usually `http://localhost:5173`).

**Configuration**
- `OPENAI_API_KEY` is required.
- `OPENAI_IMAGE_MODEL` should be set to `dall-e-3` to use DALL-E 3.
- `OPENAI_IMAGE_SIZE` defaults to `1024x1024`.
- `OPENAI_IMAGE_QUALITY` defaults to `standard` for DALL-E 3.
- `OPENAI_TEXT_MODEL` overrides the default text model used for chat and prompt synthesis.
- `VITE_API_BASE` can be set in `frontend/.env` to point the UI at a different backend (defaults to `http://localhost:8000`).

**Architecture**
1. The frontend (Vite + React) loads personas and suggestions from the backend and manages the terminal-style UI.
2. Chat turns are sent to `POST /chat` or streamed from `POST /chat/stream` using SSE.
3. The backend builds a persona system prompt and calls the OpenAI Chat model via LangChain, enforcing the "yes, and" prefix.
4. On image generation, the backend summarizes the conversation into a single prompt and calls the OpenAI Images API with DALL-E 3.
5. The resulting image URL is returned to the UI, and downloads are served through `GET /proxy-image`.

**Repo Layout**
- `backend/` FastAPI app, LLM orchestration, persona definitions, and image generation.
- `backend/personas/` YAML persona configs and prompts.
- `frontend/` Vite + React UI and client-side state.
