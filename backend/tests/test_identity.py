"""Track identity: file tags win, an untitled file is titled by its own name (not by a model's fresh invention), provenance says so."""
import pytest

from app.utils.identity import merge_identity, refresh_cached_identity, title_from_filename
from app.utils.provenance import build_provenance


@pytest.mark.parametrize("name,expected", [
    ("test_mix.wav", "test mix"),
    ("03 - dark_driving-techno (final mix).wav", "dark driving-techno (final mix)"),
    ("07. Midnight Drive.mp3", "Midnight Drive"),
    ("12 Midnight.flac", "Midnight"),
    ("/uploads/tmp/Song Name.WAV", "Song Name"),
    ("Song.v2.final.mp3", "Song.v2.final"),
    ("  spaced   out  .wav", "spaced out"),
    ("2026.wav", ""),                       # no letters: not a title
    ("12345", ""),
    ("", ""),
    (None, ""),
    (".wav", ""),
    ("Zażółć gęślą.wav", "Zażółć gęślą"),
])
def test_title_from_filename(name, expected):
    assert title_from_filename(name) == expected


def test_file_tags_win_over_the_model_even_when_the_model_answered():
    meta = {"title": "Model Title", "artist": "Model Artist", "album": "Model Album", "bpm": 124}
    by_tag, by_name = merge_identity(meta, {"title": "Real Title", "artist": "Real Artist", "isrc": "PLABC2600001"}, "whatever.wav")
    assert meta["title"] == "Real Title" and meta["artist"] == "Real Artist" and meta["isrc"] == "PLABC2600001"
    assert meta["album"] == "Model Album" and meta["bpm"] == 124                      # untagged fields keep the model's answer
    assert by_tag == {"title", "artist", "isrc"} and by_name == set()
    assert "suggestedTitle" not in meta                                               # the tag is the title, there is nothing to suggest


def test_an_untitled_file_gets_its_name_and_the_models_idea_is_kept_apart():
    meta = {"title": "Midnight Reverie", "artist": "Unknown Artist"}
    by_tag, by_name = merge_identity(meta, {}, "test_mix.wav")
    assert meta["title"] == "test mix" and meta["suggestedTitle"] == "Midnight Reverie"
    assert by_tag == set() and by_name == {"title"}


def test_the_result_does_not_change_between_runs_whatever_the_model_says():
    titles = set()
    for guess in ("Midnight Reverie", "Midnight Whisper", "Neon Nights", ""):
        meta = {"title": guess}
        merge_identity(meta, {}, "test_mix.wav")
        titles.add(meta["title"])
    assert titles == {"test mix"}


def test_no_tag_and_no_usable_file_name_leaves_the_models_title_alone():
    meta = {"title": "Midnight Reverie"}
    by_tag, by_name = merge_identity(meta, {}, "2026.wav")
    assert meta["title"] == "Midnight Reverie" and by_name == set() and "suggestedTitle" not in meta


def test_a_cached_result_is_re_titled_for_the_new_upload():
    cached = {"title": "old name", "suggestedTitle": "Midnight Reverie", "bpm": 124}          # analysed earlier as old_name.wav
    refresh_cached_identity(cached, {}, "new_name.wav")
    assert cached["title"] == "new name" and cached["suggestedTitle"] == "Midnight Reverie"     # the earlier FILE NAME is not kept as a suggestion
    tagged = {"title": "old name", "suggestedTitle": "Midnight Reverie"}
    by_tag, _ = refresh_cached_identity(tagged, {"title": "Real Title"}, "new_name.wav")
    assert tagged["title"] == "Real Title" and "suggestedTitle" not in tagged and by_tag == {"title"}
    plain = {"title": "Some Title"}                                                              # a result that never had a suggestion
    refresh_cached_identity(plain, {}, "x_y.wav")
    assert plain["title"] == "x y" and plain["suggestedTitle"] == "Some Title"
    again = {"title": "Real Title", "suggestedTitle": "Real Title"}
    merge_identity(again, {"title": "Real Title"}, "x.wav")
    assert "suggestedTitle" not in again


def test_blank_tags_do_not_count_as_tags():
    meta = {"title": "Model Title"}
    by_tag, _ = merge_identity(meta, {"title": "", "artist": None, "album": []}, "Some Song.wav")
    assert by_tag == set() and meta["title"] == "Some Song"


def test_provenance_says_where_the_title_came_from():
    meta = {"title": "test mix", "artist": "Real Artist", "bpm": 124}
    p = build_provenance(meta, {"artist"}, 0.9, {"title"})
    assert p["title"] == {"source": "EXTRACTED", "confidence": 0.7, "method": "filename"}        # from the file name: a guess, not a fact
    assert p["artist"]["source"] == "EXTRACTED" and p["artist"]["confidence"] == 1.0              # from the file's own tags: a fact
    assert p["bpm"]["source"] == "INFERRED"
    ai = build_provenance({"title": "Model Title"}, set(), 0.9)
    assert ai["title"]["source"] == "AI_GENERATED"                                                  # unchanged for the old call shape
    empty = build_provenance({"title": ""}, set(), 0.9, {"title"})
    assert empty["title"]["source"] == "UNKNOWN"                                                    # a filename-field flag cannot invent a value
