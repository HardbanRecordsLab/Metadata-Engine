import io
import json
import wave
from tempfile import NamedTemporaryFile

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mutagen.wave import WAVE

from app.routes.tagging import router as tagging_router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(tagging_router)
    return TestClient(app)


def _create_silence_wav(path: str, duration_sec: float = 0.1, sample_rate: int = 44100):
    frames = int(duration_sec * sample_rate)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * frames)


def test_tag_file_wav_writes_basic_id3_tags(client):
    meta = {
        "title": "Test Title",
        "artist": "Test Artist",
        "album": "Test Album",
        "year": "2026",
        "track": 1,
        "bpm": 120,
        "key": "C",
        "mode": "Major",
        "mainGenre": "House",
        "isrc": "USABC2300001",
        "language": "English",
        "vocalStyle": {"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"},
    }

    with NamedTemporaryFile(suffix=".wav") as tmp:
        _create_silence_wav(tmp.name)
        with open(tmp.name, "rb") as f:
            response = client.post(
                "/tag/file",
                files={"file": ("test.wav", f, "audio/wav")},
                data={"metadata": json.dumps(meta)},
            )

    assert response.status_code == 200
    assert response.content

    with NamedTemporaryFile(suffix=".wav") as tagged:
        tagged.write(response.content)
        tagged.flush()
        audio = WAVE(tagged.name)
        assert audio.tags is not None
        assert str(audio.tags.get("TIT2")) == "Test Title"
        assert str(audio.tags.get("TPE1")) == "Test Artist"


def test_tag_file_rejects_invalid_metadata_json(client):
    with NamedTemporaryFile(suffix=".wav") as tmp:
        _create_silence_wav(tmp.name)
        with open(tmp.name, "rb") as f:
            response = client.post(
                "/tag/file",
                files={"file": ("test.wav", f, "audio/wav")},
                data={"metadata": "{not-json"},
            )

    assert response.status_code == 400
    result = response.json()["results"][0]
    assert result["tagged"] is True
    assert "isrc" not in result["tags"]
    assert "tipl" not in result["tags"]
    assert result["user"] == "test_user"
