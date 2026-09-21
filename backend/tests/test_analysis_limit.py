"""Time-budget enforcement in FreshTrackAnalyzer.analyze_fresh_track().

Contract (since the OpenRouter-first consensus, commit 1be3f48): the DSP layer can eat the whole time
budget on a busy VPS, so the LLM step is ALWAYS given a guaranteed window
(``LLM_MIN_WINDOW_SEC``, default 90 s, never less than 5 s) instead of being skipped - skipping it
produced template-only "0 LLMs" results. Consequently:

* a fast LLM answer is used even when the DSP layer left no budget, and
* a slow/unresponsive LLM is cut off at the window and the offline DSP fallback is used; total time
  then overruns ``time_budget`` and ``target_met`` honestly reports False.

The two tests below used to assert the pre-1be3f48 behaviour (LLM skipped when the budget is tight),
which is why they failed once CI could import the app at all.
"""
import pytest
from unittest.mock import patch

from app.services.fresh_track_analyzer import FreshTrackAnalyzer

MOCK_AUDIO_FEATURES = {
    'rhythm': {'tempo': 120},
    'harmonic': {'key': 'C', 'mode': 'Major'},
    'meta': {'duration': 180},
}


async def _slow_audio_analysis(*args, **kwargs):
    import asyncio
    await asyncio.sleep(2)  # stands in for the real ~12-15s DSP pass
    return dict(MOCK_AUDIO_FEATURES)


async def _fast_llm_consensus(*args, **kwargs):
    import asyncio
    await asyncio.sleep(0.3)
    return {'mainGenre': 'Test Genre', 'confidence': 0.9}


async def _slow_llm_consensus(*args, **kwargs):
    import asyncio
    await asyncio.sleep(10)  # stands in for a slow/unresponsive LLM
    return {'mainGenre': 'Test Genre', 'confidence': 0.9}


@pytest.mark.asyncio
async def test_tight_budget_still_gives_the_llm_its_guaranteed_window(monkeypatch):
    """DSP layer leaves ~2s of a 4s budget: the LLM is NOT skipped, its (fast) answer is used and the
    whole analysis still finishes inside the budget."""
    import time

    monkeypatch.setenv("LLM_MIN_WINDOW_SEC", "20")
    analyzer = FreshTrackAnalyzer()
    with patch('app.utils.hash_generator.generate_file_hash', return_value='0' * 64), \
         patch.object(analyzer.audio_analyzer, 'extract_all_features', side_effect=_slow_audio_analysis), \
         patch.object(analyzer.llm_ensemble, 'consensus_classification', side_effect=_fast_llm_consensus):

        start = time.time()
        result = await analyzer.analyze_fresh_track("test.mp3", time_budget=4)
        duration = time.time() - start

    assert duration < 4
    assert result['_tech_meta']['target_met'] is True
    assert result['mainGenre'] == 'Test Genre'  # the LLM answer was used, not the DSP fallback


@pytest.mark.asyncio
async def test_llm_slower_than_its_window_is_cut_off_and_falls_back_to_dsp(monkeypatch):
    """The LLM window is bounded (here: the 5s floor): a 10s LLM is cut off, the offline DSP fallback
    is used and, since that overruns the nominal budget, target_met correctly reports False."""
    import time

    # window >= 3s (below that the analyzer skips the LLM outright), so llm_timeout = max(5, 4 - 1) = the 5s floor
    monkeypatch.setenv("LLM_MIN_WINDOW_SEC", "4")
    analyzer = FreshTrackAnalyzer()
    with patch('app.utils.hash_generator.generate_file_hash', return_value='0' * 64), \
         patch.object(analyzer.audio_analyzer, 'extract_all_features', side_effect=_slow_audio_analysis), \
         patch.object(analyzer.llm_ensemble, 'consensus_classification', side_effect=_slow_llm_consensus):

        start = time.time()
        result = await analyzer.analyze_fresh_track("test.mp3", time_budget=3)
        duration = time.time() - start

    assert duration > 3   # overran the nominal budget, as designed
    assert duration < 10  # but bounded by the LLM window, not the full 10s mock sleep
    assert result['_tech_meta']['target_met'] is False
    assert result['mainGenre'] != 'Test Genre'
