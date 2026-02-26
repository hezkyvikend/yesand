"""DALL-E image generation wrapper."""

from openai import AsyncOpenAI

from yesand.config import get_image_model, get_image_quality, get_image_size


async def generate_image(prompt: str) -> str:
    """Generate an image using DALL-E.

    Args:
        prompt: The image generation prompt.

    Returns:
        URL of the generated image.
    """
    client = AsyncOpenAI()
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

    response = await client.images.generate(**request)
    return response.data[0].url
