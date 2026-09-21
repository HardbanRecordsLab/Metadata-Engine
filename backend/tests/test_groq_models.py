"""Groq model selection (llama-3.x were retired -> 404) and the OpenRouter vote timeout override."""
from app.services.groq_models import groq_model, groq_extra, groq_budget, DEFAULT_PRO, DEFAULT_FLASH
from app.services.llm_ensemble import LLMEnsemble


def test_defaults_are_not_the_retired_llama_models(monkeypatch):
    monkeypatch.delenv("GROQ_MODEL_PRO", raising=False)
    monkeypatch.delenv("GROQ_MODEL_FLASH", raising=False)
    assert groq_model("pro") == DEFAULT_PRO == "openai/gpt-oss-120b"
    assert groq_model("flash") == DEFAULT_FLASH == "openai/gpt-oss-20b"
    assert "llama" not in groq_model("pro") and "llama" not in groq_model("flash")


def test_env_override_and_empty_env_falls_back(monkeypatch):
    monkeypatch.setenv("GROQ_MODEL_PRO", "qwen/qwen3.8-27b")
    monkeypatch.setenv("GROQ_MODEL_FLASH", "  ")            # blank (e.g. unset GitHub variable) -> default
    assert groq_model("pro") == "qwen/qwen3.8-27b"
    assert groq_model("flash") == DEFAULT_FLASH


def test_reasoning_models_get_low_effort_and_token_headroom():
    assert groq_extra("openai/gpt-oss-120b") == {"extra_body": {"reasoning_effort": "low"}}
    assert groq_budget("openai/gpt-oss-120b", 300) > 300
    assert groq_extra("qwen/qwen3.8-27b") == {}
    assert groq_budget("qwen/qwen3.8-27b", 300) == 300


def test_vote_timeout_default_env_override_and_bad_value(monkeypatch):
    ens = LLMEnsemble(openrouter_key="k")
    monkeypatch.delenv("OPENROUTER_VOTE_TIMEOUT_SEC", raising=False)
    assert ens._openrouter_vote_timeout() == LLMEnsemble.OPENROUTER_VOTE_TIMEOUT_SEC == 75.0
    monkeypatch.setenv("OPENROUTER_VOTE_TIMEOUT_SEC", "120")
    assert ens._openrouter_vote_timeout() == 120.0
    monkeypatch.setenv("OPENROUTER_VOTE_TIMEOUT_SEC", "oops")
    assert ens._openrouter_vote_timeout() == 75.0
    monkeypatch.setenv("OPENROUTER_VOTE_TIMEOUT_SEC", "")
    ens.OPENROUTER_VOTE_TIMEOUT_SEC = 0.3                   # instance override (used by test_openrouter_vote)
    assert ens._openrouter_vote_timeout() == 0.3


def test_default_vote_lineup_has_no_slow_deepseek(monkeypatch):
    monkeypatch.delenv("OPENROUTER_VOTE_MODELS", raising=False)
    ens = LLMEnsemble(openrouter_key="k")
    models = ens._openrouter_vote_models("pro")
    assert len(models) == 3 and len(set(models)) == 3
    assert not any("deepseek" in m for m in models)
