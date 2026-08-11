"""Time-budget enforcement in FreshTrackAnalyzer.analyze_fresh_track().

Was previously broken in two ways: (1) it called the real file hasher on a
literal "test.mp3" path that doesn't exist, crashing before the mocked
components were ever exercised; (2) its only assertion (target_met == True)
assumed the analyzer always stays under budget, which contradicts the
analyzer's own deliberately-relaxed behavior (see the "RELAXED LIMIT"
comment in fresh_track_analyzer.py) of still giving the LLM a real ~5s
window even when the remaining budget is tighter than that — so for some
budgets it is *supposed* to overrun, and is supposed to report that
honestly via target_met == False. This file now tests both cases.
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


async def _slow_llm_consensus(*args, **kwargs):
    import asyncio
    await asyncio.sleep(10)  # stands in for a slow/unresponsive LLM
    return {'mainGenre': 'Test Genre', 'confidence': 0.9}


@pytest.mark.asyncio
async def test_tight_budget_skips_llm_and_stays_under_target():
    """remaining < 3s after the DSP layer: Layer 2 is skipped outright, so
    the analyzer finishes well under budget and target_met is True."""
    import time

    analyzer = FreshTrackAnalyzer()
    with patch('app.utils.hash_generator.generate_file_hash', return_value='0' * 64), \
         patch.object(analyzer.audio_analyzer, 'extract_all_features', side_effect=_slow_audio_analysis), \
         patch.object(analyzer.llm_ensemble, 'consensus_classification', side_effect=_slow_llm_consensus):

        start = time.time()
        result = await analyzer.analyze_fresh_track("test.mp3", time_budget=4)
        duration = time.time() - start

    assert duration < 4
    assert result['_tech_meta']['target_met'] is True
    # The slow LLM must never have been awaited to completion — genre came
    # from the offline DSP fallback, not the mocked 10s call.
    assert result['mainGenre'] != 'Test Genre'


@pytest.mark.asyncio
async def test_moderate_budget_still_gives_llm_a_real_window_even_if_it_overruns():
    """remaining >= 3s: the analyzer deliberately gives the LLM a ~5s
    window rather than an unrealistically short one, even if that pushes
    total time past time_budget. This is intentional (see the "RELAXED
    LIMIT" comment) — the regression to guard is that target_met correctly
    reports False when this happens, not that it never happens."""
    import time

    analyzer = FreshTrackAnalyzer()
    with patch('app.utils.hash_generator.generate_file_hash', return_value='0' * 64), \
         patch.object(analyzer.audio_analyzer, 'extract_all_features', side_effect=_slow_audio_analysis), \
         patch.object(analyzer.llm_ensemble, 'consensus_classification', side_effect=_slow_llm_consensus):

        start = time.time()
        result = await analyzer.analyze_fresh_track("test.mp3", time_budget=6)
        duration = time.time() - start

    assert duration > 6  # overran the nominal budget, as designed
    assert duration < 10  # but bounded by the ~5s LLM timeout, not the full 10s mock sleep
    assert result['_tech_meta']['target_met'] is False
    assert result['mainGenre'] != 'Test Genre'
