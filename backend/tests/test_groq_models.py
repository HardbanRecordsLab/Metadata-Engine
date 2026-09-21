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


# ---- fallback chain (Groq has per-model daily token quotas: 429 must move on to the next model) ----
import pytest
from app.services.groq_models import groq_chain, groq_create


class _Err(Exception):
    def __init__(self, status):
        super().__init__("HTTP %s" % status)
        self.status_code = status


class _FakeClient:
    """client.chat.completions.create(...) that fails with the given status for the listed models."""
    def __init__(self, fail):
        self.fail, self.calls = fail, []
        outer = self

        class _C:
            @staticmethod
            def create(**kw):
                outer.calls.append(kw)
                if kw["model"] in outer.fail:
                    raise _Err(outer.fail[kw["model"]])
                return {"model": kw["model"], "kw": kw}

        class _Chat:
            completions = _C

        self.chat = _Chat


def test_chain_order_dedup_and_env(monkeypatch):
    monkeypatch.delenv("GROQ_MODEL_PRO", raising=False)
    monkeypatch.delenv("GROQ_MODEL_FALLBACKS", raising=False)
    assert groq_chain("pro") == ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    assert groq_chain("flash") == ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]          # duplicate dropped
    assert groq_chain("pro", model="x/y")[0] == "x/y"
    monkeypatch.setenv("GROQ_MODEL_FALLBACKS", "")
    assert groq_chain("pro") == ["openai/gpt-oss-120b"]                                  # empty = no fallbacks


def test_429_moves_to_the_next_model_and_budget_is_per_model(monkeypatch):
    monkeypatch.delenv("GROQ_MODEL_FALLBACKS", raising=False)
    c = _FakeClient({"openai/gpt-oss-120b": 429})
    out = groq_create(c, "pro", max_tokens=300, messages=[])
    assert out["model"] == "qwen/qwen3.8-27b"
    assert [k["model"] for k in c.calls] == ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
    assert c.calls[0]["max_tokens"] > 300 and c.calls[0]["extra_body"] == {"reasoning_effort": "low"}   # gpt-oss: headroom + low effort
    assert c.calls[1]["max_tokens"] == 300 and "extra_body" not in c.calls[1]                            # qwen: as asked


def test_404_also_falls_through_and_other_errors_are_raised(monkeypatch):
    monkeypatch.delenv("GROQ_MODEL_FALLBACKS", raising=False)
    c = _FakeClient({"openai/gpt-oss-120b": 404, "qwen/qwen3.8-27b": 429})
    assert groq_create(c, "pro", max_tokens=10, messages=[])["model"] == "openai/gpt-oss-20b"
    with pytest.raises(_Err) as ei:
        groq_create(_FakeClient({"openai/gpt-oss-120b": 500}), "pro", max_tokens=10, messages=[])
    assert ei.value.status_code == 500                                                                   # 500 is not swallowed


def test_all_models_exhausted_raises_the_last_error(monkeypatch):
    monkeypatch.delenv("GROQ_MODEL_FALLBACKS", raising=False)
    c = _FakeClient({m: 429 for m in ("openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b")})
    with pytest.raises(_Err) as ei:
        groq_create(c, "pro", max_tokens=10, messages=[])
    assert ei.value.status_code == 429 and len(c.calls) == 3
