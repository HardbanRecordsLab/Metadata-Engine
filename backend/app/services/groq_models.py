"""Single place that decides which Groq chat model each call site uses.

Groq retired ``llama-3.3-70b-versatile`` and ``llama-3.1-8b-instant`` for our key (HTTP 404
``model_not_found``, verified 2026-09-21 with GET /openai/v1/models), so every Groq call silently
failed. Model names now live here and can be overridden without a code change:

    GROQ_MODEL_PRO        (default openai/gpt-oss-120b)  - 'pro' mode, metadata merge, lyrics
    GROQ_MODEL_FLASH      (default openai/gpt-oss-20b)   - 'flash' mode
    GROQ_MODEL_FALLBACKS  (default qwen/qwen3.8-27b,openai/gpt-oss-20b) - tried in order when the
                          primary model answers 429 (rate/daily-token limit) or 404 (retired)

Groq's free tier has a per-MODEL daily token quota (200k tokens/day on gpt-oss-120b, hit within hours
by the library batch on 2026-09-21), so every call goes through ``groq_create`` which walks the chain.

gpt-oss models are reasoning models: reasoning tokens are counted against ``max_tokens`` and the
answer comes back empty when the budget is too small, so ``groq_extra`` pins a low reasoning effort
and ``groq_budget`` adds headroom on top of the visible-answer budget the call site asks for.
"""
import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_PRO = "openai/gpt-oss-120b"
DEFAULT_FLASH = "openai/gpt-oss-20b"
DEFAULT_FALLBACKS = "qwen/qwen3.8-27b,openai/gpt-oss-20b"
RETRYABLE_STATUS = (404, 429)
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


def groq_chain(model_preference: str = "pro", model: str = None) -> list:
    """Primary model first (or the explicitly requested ``model``), then the fallbacks, de-duplicated."""
    raw = os.getenv("GROQ_MODEL_FALLBACKS")
    fallbacks = [m.strip() for m in (DEFAULT_FALLBACKS if raw is None else raw).split(",") if m.strip()]
    chain = []
    for m in [model or groq_model(model_preference)] + fallbacks:
        if m not in chain:
            chain.append(m)
    return chain


def groq_create(client, model_preference: str = "pro", *, max_tokens: int, model: str = None, **kwargs):
    """``client.chat.completions.create`` with model fallback.

    ``max_tokens`` is the visible-answer budget (reasoning headroom is added per model). Only a
    rate/quota limit (429) or a retired model (404) moves on to the next model; anything else is raised
    unchanged. With streaming the error surfaces from ``create`` itself, before the first token.
    """
    last = None
    for name in groq_chain(model_preference, model):
        try:
            return client.chat.completions.create(model=name, max_tokens=groq_budget(name, max_tokens), **groq_extra(name), **kwargs)
        except Exception as e:  # groq.RateLimitError / NotFoundError expose .status_code
            if getattr(e, "status_code", None) not in RETRYABLE_STATUS:
                raise
            logger.warning("Groq model %s unavailable (HTTP %s) - trying the next model", name, getattr(e, "status_code", "?"))
            last = e
    raise last
