from app.services.fresh_track_analyzer import vocal_style_is_blank


def test_all_none_means_no_singer():
    assert vocal_style_is_blank({"gender": "none", "timbre": "none", "delivery": "none", "emotionalTone": "none"})
    assert vocal_style_is_blank({"gender": "None", "timbre": "", "delivery": "N/A", "emotionalTone": None})


def test_a_described_singer_is_not_blank():
    assert not vocal_style_is_blank({"gender": "female", "timbre": "airy", "delivery": "sung", "emotionalTone": "wistful"})
    assert not vocal_style_is_blank({"gender": "none", "timbre": "airy", "delivery": "none", "emotionalTone": "none"})


def test_missing_description_is_not_evidence():
    assert not vocal_style_is_blank(None)
    assert not vocal_style_is_blank({})
