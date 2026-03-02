"""DALL-E image generation wrapper."""

from langsmith import traceable
from langsmith.run_helpers import get_current_run_tree
from langsmith.wrappers import wrap_openai
from openai import AsyncOpenAI

from yesand.config import (
    get_image_cost_usd,
    get_image_model,
    get_image_quality,
    get_image_size,
)


def _create_client() -> AsyncOpenAI:
    return wrap_openai(AsyncOpenAI())


@traceable(run_type="tool", name="dalle_generate")
async def generate_image(
    prompt: str,
    metadata: dict | None = None,
    tags: list[str] | None = None,
) -> str:
    """Generate an image using DALL-E.

    Args:
        prompt: The image generation prompt.

    Returns:
        URL of the generated image.
    """
    client = _create_client()
    model = get_image_model()
    size = get_image_size()

    request = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "n": 1,
    }

    if model == "dall-e-3":
        request["quality"] = get_image_quality()

    run = get_current_run_tree()
    if run:
        if metadata:
            run.metadata.update(metadata)
        if tags:
            run.tags.extend(tags)
        run.metadata.setdefault("ls_provider", "openai")
        run.metadata.setdefault("ls_model_name", model)
        run.metadata.setdefault("image_model", model)
        run.metadata.setdefault("image_quality", get_image_quality())
        run.metadata.setdefault("image_size", size)
        cost = get_image_cost_usd()
        if cost is not None:
            run.set(usage_metadata={"total_cost": cost})

    response = await client.images.generate(**request)
    return response.data[0].url
