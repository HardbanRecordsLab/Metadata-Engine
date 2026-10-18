"""The OpenRouter vote must not hold an analysis hostage to its slowest model."""
import asyncio
import time

from app.services.llm_ensemble import LLMEnsemble


async def _after(delay, value):
    await asyncio.sleep(delay)
    return value


def _run(coros, hard, grace):
    async def go():
        tasks = [asyncio.ensure_future(c) for c in coros]
        t0 = time.monotonic()
        done, pending = await LLMEnsemble._wait_vote(tasks, hard, grace)
        for t in pending:
            t.cancel()
        return len(done), len(pending), time.monotonic() - t0
    return asyncio.run(go())


def test_slow_model_is_dropped_after_the_grace_period():
    done, pending, took = _run([_after(0.05, {"g": 1}), _after(5, {"g": 2})], hard=4, grace=0.3)
    assert (done, pending) == (1, 1)
    assert took < 1.0


def test_two_fast_models_both_count_and_return_at_once():
    done, pending, took = _run([_after(0.05, {"g": 1}), _after(0.15, {"g": 2})], hard=4, grace=1)
    assert (done, pending) == (2, 0)
    assert took < 0.6


def test_hard_timeout_still_applies_when_nobody_answers():
    done, pending, took = _run([_after(5, {"g": 1}), _after(5, {"g": 2})], hard=0.3, grace=10)
    assert (done, pending) == (0, 2)
    assert took < 1.0


def test_an_empty_or_failed_answer_does_not_start_the_grace_clock():
    async def boom():
        raise RuntimeError("provider down")
    done, pending, took = _run([boom(), _after(0.4, {"g": 2})], hard=4, grace=0.1)
    assert pending == 0 and done == 2
