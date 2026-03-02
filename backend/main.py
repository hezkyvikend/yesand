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
    suggestion_word: str | None = None


class ChatResponse(BaseModel):
    message: str


class GenerateRequest(BaseModel):
    persona_id: str
    messages: list[Message]
    suggestion_word: str | None = None


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


def _build_error_detail(
    *,
    message: str,
    code: str,
    request_id: str | None = None,
    stage: str | None = None,
    retryable: bool | None = None,
    upstream_error: str | None = None,
) -> dict:
    detail = {"message": message, "code": code}
    if request_id:
        detail["request_id"] = request_id
    if stage:
        detail["stage"] = stage
    if retryable is not None:
        detail["retryable"] = retryable
    if upstream_error:
        detail["upstream_error"] = str(upstream_error)[:500]
    return detail


def _error_response(status_code: int, detail: dict, request_id: str | None = None) -> HTTPException:
    headers = {"X-Request-Id": request_id} if request_id else None
    return HTTPException(status_code=status_code, detail=detail, headers=headers)


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
    _, _, request_id = build_trace_context(request, payload.persona_id, "chat")
    response.headers["X-Request-Id"] = request_id

    persona = get_persona(payload.persona_id)
    if persona is None:
        detail = _build_error_detail(
            message=f"Unknown persona: {payload.persona_id}",
            code="unknown_persona",
            request_id=request_id,
            stage="validation",
            retryable=False,
        )
        raise _error_response(404, detail, request_id=request_id)

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, _ = build_trace_context(
        request,
        payload.persona_id,
        "chat",
        request_id=request_id,
    )
    if payload.suggestion_word:
        metadata["suggestion_word"] = payload.suggestion_word

    try:
        reply = await run_agent_turn(
            persona,
            history,
            suggestion_word=payload.suggestion_word,
            metadata=metadata,
            tags=tags,
        )
    except Exception as e:
        detail = _build_error_detail(
            message="Chat model request failed",
            code="chat_model_error",
            request_id=request_id,
            stage="chat",
            retryable=True,
            upstream_error=str(e),
        )
        raise _error_response(502, detail, request_id=request_id)

    return ChatResponse(message=reply)


@router.post("/chat/stream")
async def chat_stream(payload: ChatRequest, request: Request):
    """Stream a yes-and conversation turn as server-sent events."""
    _, _, request_id = build_trace_context(request, payload.persona_id, "chat_stream")

    persona = get_persona(payload.persona_id)
    if persona is None:
        detail = _build_error_detail(
            message=f"Unknown persona: {payload.persona_id}",
            code="unknown_persona",
            request_id=request_id,
            stage="validation",
            retryable=False,
        )
        raise _error_response(404, detail, request_id=request_id)

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, _ = build_trace_context(
        request,
        payload.persona_id,
        "chat_stream",
        request_id=request_id,
    )
    if payload.suggestion_word:
        metadata["suggestion_word"] = payload.suggestion_word

    async def event_generator():
        try:
            async for chunk in stream_agent_turn(
                persona,
                history,
                suggestion_word=payload.suggestion_word,
                metadata=metadata,
                tags=tags,
            ):
                event_payload = {"type": "chunk", "content": chunk}
                yield f"data: {json.dumps(event_payload)}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            event_payload = {
                "type": "error",
                "message": "Chat stream failed",
                "code": "chat_stream_error",
                "stage": "chat_stream",
                "request_id": request_id,
                "retryable": True,
                "upstream_error": str(e)[:500],
            }
            yield f"data: {json.dumps(event_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Request-Id": request_id},
    )


@router.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest, request: Request, response: Response):
    """Synthesize an image prompt from conversation and generate the image."""
    _, _, request_id = build_trace_context(request, payload.persona_id, "generate")
    response.headers["X-Request-Id"] = request_id

    persona = get_persona(payload.persona_id)
    if persona is None:
        detail = _build_error_detail(
            message=f"Unknown persona: {payload.persona_id}",
            code="unknown_persona",
            request_id=request_id,
            stage="validation",
            retryable=False,
        )
        raise _error_response(404, detail, request_id=request_id)

    history = [msg.model_dump() for msg in payload.messages]
    metadata, tags, _ = build_trace_context(
        request,
        payload.persona_id,
        "synthesize",
        request_id=request_id,
    )
    if payload.suggestion_word:
        metadata["suggestion_word"] = payload.suggestion_word

    try:
        prompt = await synthesize_image_prompt(
            persona,
            history,
            suggestion_word=payload.suggestion_word,
            metadata=metadata,
            tags=tags,
        )
    except Exception as e:
        detail = _build_error_detail(
            message="Failed to synthesize image prompt",
            code="synthesizer_error",
            request_id=request_id,
            stage="synthesize",
            retryable=True,
            upstream_error=str(e),
        )
        raise _error_response(502, detail, request_id=request_id)

    try:
        image_metadata, image_tags, _ = build_trace_context(
            request,
            payload.persona_id,
            "image",
            request_id=request_id,
        )
        image_url = await generate_image(prompt, metadata=image_metadata, tags=image_tags)
    except Exception as e:
        detail = _build_error_detail(
            message="Image generation request failed",
            code="image_generation_error",
            request_id=request_id,
            stage="image",
            retryable=True,
            upstream_error=str(e),
        )
        raise _error_response(502, detail, request_id=request_id)

    if not image_url:
        detail = _build_error_detail(
            message="Image provider returned no URL",
            code="image_url_missing",
            request_id=request_id,
            stage="image",
            retryable=True,
        )
        raise _error_response(502, detail, request_id=request_id)

    return GenerateResponse(image_url=image_url, prompt_used=prompt)


@router.get("/suggest", response_model=SuggestResponse)
async def suggest():
    """Return a single random audience suggestion word."""
    return SuggestResponse(word=get_suggestion())


@router.get("/proxy-image")
async def proxy_image(url: str, request: Request, response: Response):
    """Proxy an image URL and return it with download headers."""
    _, _, request_id = build_trace_context(request, None, "proxy_image")
    response.headers["X-Request-Id"] = request_id

    parsed = urlparse(url)
    if not parsed.hostname or not parsed.hostname.endswith(".blob.core.windows.net"):
        detail = _build_error_detail(
            message="Invalid image URL",
            code="invalid_image_url",
            request_id=request_id,
            stage="proxy_image",
            retryable=False,
        )
        raise _error_response(400, detail, request_id=request_id)

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=30.0)
        if resp.status_code != 200:
            detail = _build_error_detail(
                message="Failed to fetch image",
                code="image_proxy_fetch_failed",
                request_id=request_id,
                stage="proxy_image",
                retryable=True,
                upstream_error=f"upstream status {resp.status_code}",
            )
            raise _error_response(502, detail, request_id=request_id)

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
