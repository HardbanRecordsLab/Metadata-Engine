"""Tests the audio-parsing layer against real (synthetic but valid) and
corrupted/malformed files. Uses AdvancedAudioAnalyzer.read_metadata
directly (mutagen/tinytag-backed) rather than going through the full
upload endpoint, so this doesn't need a database or the DSP stack
(essentia/librosa) installed.

The synthetic WAV files act as a small "golden dataset": since we generate
them ourselves, the expected duration/sample rate/channels are known
exactly, so this catches the parser silently returning wrong technical
facts, not just crashing.
"""
import os
import wave
from tempfile import NamedTemporaryFile

import pytest

from app.services.audio_analyzer import AdvancedAudioAnalyzer


def _make_wav(path: str, duration_sec: float, sample_rate: int, channels: int = 1):
    frames = int(duration_sec * sample_rate)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * frames * channels)


@pytest.fixture
def tmp_path_str(tmp_path):
    return str(tmp_path)


# ── Real (synthetic) files — golden values are known because we generated them ──

def test_read_metadata_reports_correct_duration_and_sample_rate(tmp_path_str):
    path = os.path.join(tmp_path_str, "real_1s_44100.wav")
    _make_wav(path, duration_sec=1.0, sample_rate=44100, channels=1)

    result = AdvancedAudioAnalyzer.read_metadata(path)

    assert "error" not in result
    assert result["samplerate"] == 44100
    assert result["channels"] == 1
    assert abs(result["duration"] - 1.0) < 0.05


def test_read_metadata_reports_correct_stereo_channels(tmp_path_str):
    path = os.path.join(tmp_path_str, "real_stereo.wav")
    _make_wav(path, duration_sec=0.5, sample_rate=48000, channels=2)

    result = AdvancedAudioAnalyzer.read_metadata(path)

    assert "error" not in result
    assert result["channels"] == 2
    assert result["samplerate"] == 48000


def test_read_metadata_short_file_does_not_crash(tmp_path_str):
    """A near-instant file is a real edge case (accidental empty recording)."""
    path = os.path.join(tmp_path_str, "tiny.wav")
    _make_wav(path, duration_sec=0.01, sample_rate=44100, channels=1)

    result = AdvancedAudioAnalyzer.read_metadata(path)
    assert "error" not in result


# ── Corrupted / malformed files — must degrade gracefully, never crash ──────

def test_read_metadata_empty_file_returns_error_not_exception(tmp_path_str):
    path = os.path.join(tmp_path_str, "empty.mp3")
    open(path, "wb").close()

    result = AdvancedAudioAnalyzer.read_metadata(path)
    assert "error" in result


def test_read_metadata_garbage_bytes_with_valid_extension(tmp_path_str):
    """A non-audio file wearing a .flac extension — the classic
    extension-spoofing case the app must not crash on."""
    path = os.path.join(tmp_path_str, "not_audio.flac")
    with open(path, "wb") as f:
        f.write(os.urandom(2048))

    result = AdvancedAudioAnalyzer.read_metadata(path)
    assert "error" in result


def test_read_metadata_truncated_valid_wav_header(tmp_path_str):
    """A WAV file whose header claims more data than actually follows —
    simulates an upload that got cut off mid-transfer."""
    path = os.path.join(tmp_path_str, "truncated.wav")
    full_path = os.path.join(tmp_path_str, "full.wav")
    _make_wav(full_path, duration_sec=2.0, sample_rate=44100, channels=1)

    with open(full_path, "rb") as f:
        data = f.read()
    # Keep the RIFF/fmt header intact but chop off most of the audio data,
    # without fixing up the RIFF/data chunk sizes.
    with open(path, "wb") as f:
        f.write(data[:100])

    result = AdvancedAudioAnalyzer.read_metadata(path)
    # Must not raise — either parses what it can or reports an error.
    assert isinstance(result, dict)


def test_read_metadata_nonexistent_file_returns_error_not_exception():
    result = AdvancedAudioAnalyzer.read_metadata("/no/such/file/exists.mp3")
    assert "error" in result
