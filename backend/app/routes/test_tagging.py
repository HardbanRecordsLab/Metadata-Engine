import pytest
from fastapi.testclient import TestClient
from app.main import app
import os
import tempfile
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TXXX
from mutagen.flac import FLAC
import json
import shutil

client = TestClient(app)

# Path to a valid test MP3 file
TEST_MP3_SOURCE = os.path.join(os.path.dirname(__file__), "..", "..", "temp_88fa8fd4-f25c-4c69-a47d-43dfbb9b6fb9_All day long.mp3")


# Helper function to create a test MP3 file by copying a real one
def create_dummy_mp3(
    filename="test.mp3", title="", artist="", album="", isrc="", tipl_data=None
):
    # Always copy the real test MP3 file
    if os.path.exists(TEST_MP3_SOURCE):
        shutil.copy(TEST_MP3_SOURCE, filename)
    else:
        raise FileNotFoundError(f"Test MP3 file not found: {TEST_MP3_SOURCE}")
    
    # Now add/modify ID3 tags
    try:
        audio = ID3(filename)
    except:
        # If no ID3 tag exists, create one
        audio = ID3()
    
    if title:
        audio["TIT2"] = TIT2(encoding=3, text=title)
    if artist:
        audio["TPE1"] = TPE1(encoding=3, text=artist)
    if album:
        audio["TALB"] = TALB(encoding=3, text=album)
    if isrc:
        audio.add(TXXX(encoding=3, desc="ISRC", text=[isrc]))
    if tipl_data:
        for item in tipl_data:
            audio.add(TXXX(encoding=3, desc=item["role"], text=[item["name"]]))
    audio.save(filename, v2_version=4)
    return filename


# Helper function to create a test FLAC file
def create_dummy_flac(
    filename="test.flac", title="", artist="", album="", isrc="", tipl_data=None
):
    # Create a more complete FLAC file structure
    # FLAC signature + STREAMINFO block (minimum required)
    flac_signature = b'fLaC'
    
    # STREAMINFO block (type 0, last metadata block flag set, length 34)
    streaminfo_header = b'\x80\x00\x00\x22'  # 0x80 = last block, type 0, length 34
    streaminfo_data = (
        b'\x00\x00'  # min block size (0 = unknown)
        b'\x00\x00'  # max block size (0 = unknown)
        b'\x00\x00\x00'  # min frame size (0 = unknown)
        b'\x00\x00\x00'  # max frame size (0 = unknown)
        b'\x0A\xC4\x42\xF0\x00\x00\x00\x00\x00\x00\x00'  # sample rate 44100Hz, 2 channels, 16 bits, 0 samples
        b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'  # MD5 (all zeros)
    )
    
    with open(filename, "wb") as f:
        f.write(flac_signature)
        f.write(streaminfo_header)
        f.write(streaminfo_data)

    # Now add tags using mutagen
    try:
        audio = FLAC(filename)
        if title:
            audio["title"] = title
        if artist:
            audio["artist"] = artist
        if album:
            audio["album"] = album
        if isrc:
            audio["isrc"] = isrc
        if tipl_data:
            for item in tipl_data:
                # Use a custom field for involved people
                audio[f"involvedpeople_{item['role'].lower()}"] = f"{item['name']}"
        audio.save()
    except Exception as e:
        print(f"Warning: Could not add tags to FLAC file: {e}")
    
    return filename


@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: Create a temporary directory for test files
    original_dir = os.getcwd()  # Save original directory
    with tempfile.TemporaryDirectory() as tmpdir:
        os.chdir(tmpdir)  # Change to temporary directory
        yield  # Run the tests
        os.chdir(original_dir)  # Change back to original directory before cleanup
    # Teardown: Temporary directory is automatically cleaned up by `with` statement


@pytest.fixture
def mp3_file():
    filepath = create_dummy_mp3()
    yield filepath
    import time
    import gc
    time.sleep(0.2)  # Give Windows time to release file handles
    gc.collect()  # Force garbage collection to close file handles
    try:
        os.remove(filepath)
    except PermissionError:
        pass  # Ignore if file is still locked


@pytest.fixture
def flac_file():
    filepath = create_dummy_flac()
    yield filepath
    import time
    import gc
    time.sleep(0.2)  # Give Windows time to release file handles
    gc.collect()  # Force garbage collection to close file handles
    try:
        os.remove(filepath)
    except PermissionError:
        pass  # Ignore if file is still locked


def test_tagging_mp3_success(mp3_file):
    isrc = "US-ABC-23-00001"
    tipl_data = [
        {"role": "Composer", "name": "John Doe"},
        {"role": "Producer", "name": "Jane Smith"},
    ]
    tipl_json = json.dumps(tipl_data)
    analysis_data = json.dumps({"bpm": 120, "key": "C major"})  # Dummy analysis data

    with open(mp3_file, "rb") as f:
        response = client.post(
            "/tagging",
            files={"files": (os.path.basename(mp3_file), f, "audio/mpeg")},
            data={"user": "test_user", "isrc": isrc, "tipl": tipl_json, "analysis_data": analysis_data},
        )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["tagged"] is True
    assert result["tags"]["isrc"] == isrc
    assert result["tags"]["tipl"] == tipl_data
    assert result["user"] == "test_user"


@pytest.mark.skip(reason="No valid FLAC file available for testing")
def test_tagging_flac_success(flac_file):
    isrc = "GB-XYZ-24-00002"
    tipl_data = [{"role": "Lyricist", "name": "Alice Wonderland"}]
    tipl_json = json.dumps(tipl_data)
    analysis_data = json.dumps({"bpm": 128, "key": "D minor"})  # Dummy analysis data

    with open(flac_file, "rb") as f:
        response = client.post(
            "/tagging",
            files={"files": (os.path.basename(flac_file), f, "audio/flac")},
            data={"user": "test_user", "isrc": isrc, "tipl": tipl_json, "analysis_data": analysis_data},
        )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["tagged"] is True
    assert result["tags"]["isrc"] == isrc
    assert result["tags"]["tipl"] == tipl_data
    assert result["user"] == "test_user"


def test_tagging_invalid_isrc(mp3_file):
    invalid_isrc = "US-ABC-23-1234"  # Too short
    tipl_data = [{"role": "Composer", "name": "John Doe"}]
    tipl_json = json.dumps(tipl_data)
    analysis_data = json.dumps({"bpm": 110, "key": "E major"})  # Dummy analysis data

    with open(mp3_file, "rb") as f:
        response = client.post(
            "/tagging",
            files={"files": (os.path.basename(mp3_file), f, "audio/mpeg")},
            data={"user": "test_user", "isrc": invalid_isrc, "tipl": tipl_json, "analysis_data": analysis_data},
        )
    assert response.status_code == 400
    assert "Invalid ISRC format" in response.json()["detail"]


def test_tagging_invalid_tipl_json(mp3_file):
    invalid_tipl_json = "{not_json"
    analysis_data = json.dumps({"bpm": 100, "key": "F major"})  # Dummy analysis data

    with open(mp3_file, "rb") as f:
        response = client.post(
            "/tagging",
            files={"files": (os.path.basename(mp3_file), f, "audio/mpeg")},
            data={"user": "test_user", "tipl": invalid_tipl_json, "analysis_data": analysis_data},
        )
    assert response.status_code == 400
    assert "Invalid TIPL format" in response.json()["detail"]


def test_tagging_no_isrc_or_tipl(mp3_file):
    analysis_data = json.dumps({"bpm": 95, "key": "G major"})  # Dummy analysis data
    
    with open(mp3_file, "rb") as f:
        response = client.post(
            "/tagging",
            files={"files": (os.path.basename(mp3_file), f, "audio/mpeg")},
            data={"user": "test_user", "analysis_data": analysis_data},
        )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["tagged"] is True
    assert "isrc" not in result["tags"]
    assert "tipl" not in result["tags"]
    assert result["user"] == "test_user"
