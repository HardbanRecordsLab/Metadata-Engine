"""OpenRouter-first consensus: paid-allowed default, vote model selection, slow/failing models must not discard the fast ones."""
import asyncio

import pytest

from app.services.llm_ensemble import LLMEnsemble


def _result(genre, model):
    return {"mainGenre": genre, "additionalGenres": ["Electronic"], "moods": ["Dark", "Intense"], "confidence": 0.8,
            "llm_source": "openrouter", "_openrouter_model": model, "trackDescription": "x" * 120}


def test_paid_allowed_defaults_to_on(monkeypatch):
    monkeypatch.delenv("OPENROUTER_ALLOW_PAID", raising=False)
    assert LLMEnsemble._openrouter_paid_allowed() is True
    monkeypatch.setenv("OPENROUTER_ALLOW_PAID", "")          # an unset GitHub variable renders as an empty string
    assert LLMEnsemble._openrouter_paid_allowed() is True
    for off in ("0", "false", "No", "off"):
        monkeypatch.setenv("OPENROUTER_ALLOW_PAID", off)
        assert LLMEnsemble._openrouter_paid_allowed() is False


def test_vote_model_count_and_override(monkeypatch):
    ens = LLMEnsemble(openrouter_key="k")
    monkeypatch.delenv("OPENROUTER_VOTE_MODELS", raising=False)
    assert len(ens._openrouter_vote_models("flash")) == 2
    assert len(ens._openrouter_vote_models("pro")) == 3
    monkeypatch.setenv("OPENROUTER_VOTE_MODELS", "a/b, c/d")
    assert ens._openrouter_vote_models("pro") == ["a/b", "c/d"]


@pytest.mark.asyncio
async def test_slow_model_does_not_discard_fast_ones(monkeypatch):
    ens = LLMEnsemble(openrouter_key="k")
    ens.OPENROUTER_VOTE_TIMEOUT_SEC = 0.3

    async def fake(context, system_prompt=None, retries=1, models=None):
        m = models[0]
        if m == "slow/model":
            await asyncio.sleep(5)
        if m == "bad/model":
            return {"error": "429", "llm_source": "openrouter"}
        return _result("Techno", m)

    monkeypatch.setenv("OPENROUTER_VOTE_MODELS", "fast/model,slow/model,bad/model")
    monkeypatch.setattr(ens, "_openrouter_classify", fake)
    out = await ens._openrouter_vote("prompt", "pro")
    good = [r for r in out if not r.get("error")]
    assert [r["_openrouter_model"] for r in good] == ["fast/model"]
    assert len(out) == 2            # slow model dropped, bad model returned an error dict
