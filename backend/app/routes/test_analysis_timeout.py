import os
import importlib
import time
import asyncio
from datetime import datetime

import pytest


@pytest.mark.asyncio
async def test_process_analysis_timeout_sets_job_error(tmp_path, monkeypatch):
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'test_timeout.db'}"

    import app.db as db

    importlib.reload(db)

    import app.routes.analysis as analysis

    importlib.reload(analysis)

    async def noop_send_progress(*_args, **_kwargs):
        return None

    monkeypatch.setattr(analysis.ws_manager, "send_progress", noop_send_progress)

    import app.services.fresh_track_analyzer as fresh_analyzer

    async def slow_analyze_fresh_track(*args, **kwargs):
        # Simulate a timeout by either sleeping or raising TimeoutError
        # Here we sleep more than the budget to trigger the outer timeout if possible,
        # or we just raise it to simulate reaching the limit.
        await asyncio.sleep(2)
        raise asyncio.TimeoutError()

    monkeypatch.setattr(
        fresh_analyzer.FreshTrackAnalyzer,
        "analyze_fresh_track",
        slow_analyze_fresh_track,
    )

    file_path = tmp_path / "a.wav"
    file_path.write_bytes(b"abc")

    session = db.SessionLocal()
    try:
        session.add(
            db.Job(
                id="job-timeout",
                user_id=None,
                status="pending",
                file_name="a.wav",
                timestamp=datetime.utcnow(),
            )
        )
        session.commit()
    finally:
        session.close()

    await analysis.process_analysis(
        job_id="job-timeout",
        file_path=str(file_path),
        is_pro_mode=False,
        transcribe=False,
        time_budget_sec=1,
    )

    session = db.SessionLocal()
    try:
        job = session.query(db.Job).filter(db.Job.id == "job-timeout").first()
        assert job is not None
        assert job.status == "error"
        assert job.error == "TIMEOUT_1s"
    finally:
        session.close()

