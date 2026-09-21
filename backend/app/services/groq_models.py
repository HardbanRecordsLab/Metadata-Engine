"""Single place that decides which Groq chat model each call site uses.

Groq retired ``llama-3.3-70b-versatile`` and ``llama-3.1-8b-instant`` for our key (HTTP 404
``model_not_found``, verified 2026-09-21 with GET /openai/v1/models), so every Groq call silently
failed. Model names now live here and can be overridden without a code change:

    GROQ_MODEL_PRO    (default openai/gpt-oss-120b)  - 'pro' mode, metadata merge, lyrics
    GROQ_MODEL_FLASH  (default openai/gpt-oss-20b)   - 'flash' mode

gpt-oss models are reasoning models: reasoning tokens are counted against ``max_tokens`` and the
answer comes back empty when the budget is too small, so ``groq_extra`` pins a low reasoning effort
and ``groq_budget`` adds headroom on top of the visible-answer budget the call site asks for.
"""
import os

DEFAULT_PRO = "openai/gpt-oss-120b"
DEFAULT_FLASH = "openai/gpt-oss-20b"
REASONING_HEADROOM = 1500


def groq_model(model_preference: str = "pro") -> str:
    """Model id for a mode ('flash' -> fast/cheap model, anything else -> pro model)."""
    if model_preference == "flash":
        return os.getenv("GROQ_MODEL_FLASH", "").strip() or DEFAULT_FLASH
    return os.getenv("GROQ_MODEL_PRO", "").strip() or DEFAULT_PRO


def _is_reasoning(model: str) -> bool:
    return model.startswith("openai/gpt-oss")


def groq_extra(model: str) -> dict:
    """Extra create() kwargs for a model (low reasoning effort for gpt-oss, nothing otherwise)."""
    return {"extra_body": {"reasoning_effort": "low"}} if _is_reasoning(model) else {}


def groq_budget(model: str, visible_tokens: int) -> int:
    """max_tokens to request so a reasoning model still has room for its visible answer."""
    return visible_tokens + REASONING_HEADROOM if _is_reasoning(model) else visible_tokens
