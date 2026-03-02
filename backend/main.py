"""FastAPI application for the Yes-And collaborative image chatbot."""

import json
import uuid

from dotenv import load_dotenv

load_dotenv()

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from yesand.agent import run_agent_turn, stream_agent_turn
from yesand.config import get_cors_origins
from yesand.image import generate_image
from yesand.persona import get_persona, load_personas
from yesand.synthesizer import synthesize_image_prompt
from yesand.words import get_suggestion

app = FastAPI(
    title="Yes-And Chatbot",
    description="Collaborative image creation through improv-style conversation",
    version="0.1.0",
)

cors_origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response Models ---


class Message(BaseModel):
    role: str  # "human" or "ai"
    content: str


class ChatRequest(BaseModel):
    persona_id: str
    messages: list[Message]


class ChatResponse(BaseModel):
    message: str


class GenerateRequest(BaseModel):
    persona_id: str
    messages: list[Message]


class GenerateResponse(BaseModel):
    image_url: str
    prompt_used: str


class PersonaAestheticMeta(BaseModel):
    pulls_toward: list[str]
    pulls_away_from: list[str]


class PersonaMeta(BaseModel):
    id: str
    name: str
    tagline: str
    aesthetic: PersonaAestheticMeta


class PersonasResponse(BaseModel):
    personas: list[PersonaMeta]


class SuggestResponse(BaseModel):
    word: str


# --- Routes ---

router = APIRouter()


def build_trace_context(
    request: Request,
    persona_id: str | None,
    route: str,
    request_id: str | None = None,
) -> tuple[dict, list[str], str]:
    user_id = request.headers.get("x-user-id")
    session_id = request.headers.get("x-session-id")
    conversation_id = request.headers.get("x-conversation-id")
    request_id = request_id or request.headers.get("x-request-id") or str(uuid.uuid4())

    metadata = {
        "user_id": user_id,
        "session_id": session_id,
        "conversation_id": conversation_id,
        "request_id": request_id,
        "persona_id": persona_id,
        "route": route,
    }
    metadata = {key: value for key, value in metadata.items() if value}

    tags = ["yesand", route]
    if persona_id:
        tags.append(f"persona:{persona_id}")

    return metadata, tags, request_id


@router.get("/personas", response_model=PersonasResponse)
async def list_personas():
    """Return metadata for all available personas."""
    all_personas = load_personas()
    meta = [
        PersonaMeta(
            id=p.id,
            name=p.name,
            tagline=p.tagline,
            aesthetic=PersonaAestheticMeta(
                pulls_toward=p.aesthetic.pulls_toward,
                pulls_away_from=p.aesthetic.pulls_away_from,
            ),
        )
        for p in all_personas.values()
    ]
    return PersonasResponse(personas=meta)


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, response: Response):
    """Run a single yes-and conversation turn."""
    persona = get_persona(payload.persona_id)
    if persona is None:
        raise HTTPException(status_code=404, detail=f"Unknown persona: {payload.persona_id}")

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, request_id = build_trace_context(request, payload.persona_id, "chat")
    response.headers["X-Request-Id"] = request_id

    try:
        reply = await run_agent_turn(persona, history, metadata=metadata, tags=tags)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return ChatResponse(message=reply)


@router.post("/chat/stream")
async def chat_stream(payload: ChatRequest, request: Request):
    """Stream a yes-and conversation turn as server-sent events."""
    persona = get_persona(payload.persona_id)
    if persona is None:
        raise HTTPException(status_code=404, detail=f"Unknown persona: {payload.persona_id}")

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, request_id = build_trace_context(request, payload.persona_id, "chat_stream")

    async def event_generator():
        try:
            async for chunk in stream_agent_turn(persona, history, metadata=metadata, tags=tags):
                payload = {"type": "chunk", "content": chunk}
                yield f"data: {json.dumps(payload)}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            payload = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Request-Id": request_id},
    )


@router.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest, request: Request, response: Response):
    """Synthesize an image prompt from conversation and generate the image."""
    persona = get_persona(payload.persona_id)
    if persona is None:
        raise HTTPException(status_code=404, detail=f"Unknown persona: {payload.persona_id}")

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, request_id = build_trace_context(request, payload.persona_id, "synthesize")
    response.headers["X-Request-Id"] = request_id

    try:
        prompt = await synthesize_image_prompt(persona, history, metadata=metadata, tags=tags)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Synthesizer error: {e}")

    try:
        image_metadata, image_tags, _ = build_trace_context(
            request,
            payload.persona_id,
            "image",
            request_id=request_id,
        )
        image_url = await generate_image(prompt, metadata=image_metadata, tags=image_tags)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image generation error: {e}")

    return GenerateResponse(image_url=image_url, prompt_used=prompt)


@router.get("/suggest", response_model=SuggestResponse)
async def suggest():
    """Return a single random audience suggestion word."""
    return SuggestResponse(word=get_suggestion())


@router.get("/proxy-image")
async def proxy_image(url: str):
    """Proxy an image URL and return it with download headers."""
    parsed = urlparse(url)
    if not parsed.hostname or not parsed.hostname.endswith(".blob.core.windows.net"):
        raise HTTPException(status_code=400, detail="Invalid image URL")

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=30.0)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch image")

    content_type = resp.headers.get("content-type", "image/png")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Content-Disposition": 'attachment; filename="yesand.png"'},
    )


app.include_router(router)
app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["."],
        reload_excludes=[".venv"],
    )
