"""Per-field provenance classification for analysis results.

The pipeline in routes/analysis.py merges values from several sources (file
tags, DSP analysis, an LLM ensemble) into one flat metadata dict with a
single overall confidence score. That makes it impossible for a caller to
tell a fact (duration read from the container) from a guess (AI-inferred
mood). This module classifies each field so a `_provenance` map can be
attached to the result: {source, confidence, method} per field, using the
vocabulary VERIFIED / EXTRACTED / INFERRED / AI_GENERATED / UNKNOWN.
"""

# Baseline classification per field, mirroring the grouping already implied
# by the comments in routes/analysis.py's ALLOWED_METADATA_KEYS.
DEFAULT_FIELD_SOURCE = {
    # Technical facts read straight from the container/signal
    "duration": "EXTRACTED",
    "sha256": "EXTRACTED",
    "coverArt": "EXTRACTED",

    # DSP-derived — computed from the audio signal via an algorithm
    "bpm": "INFERRED",
    "key": "INFERRED",
    "mode": "INFERRED",
    "dynamicRange": "INFERRED",
    "spectralCentroid": "INFERRED",
    "spectralRolloff": "INFERRED",
    "acousticScore": "INFERRED",
    "hasVocals": "INFERRED",

    # Identity fields — AI-suggested unless the file's own tags win (see
    # FILE_TAG_WINNER_FIELDS / build_provenance)
    "title": "AI_GENERATED",
    "artist": "AI_GENERATED",
    "album": "AI_GENERATED",
    "albumArtist": "AI_GENERATED",
    "year": "AI_GENERATED",
    "track": "AI_GENERATED",
    "isrc": "AI_GENERATED",
    "upc": "AI_GENERATED",
    "catalogNumber": "AI_GENERATED",
    "copyright": "AI_GENERATED",
    "publisher": "AI_GENERATED",

    # Descriptive / classification fields — LLM ensemble output
    "mainInstrument": "AI_GENERATED",
    "mainGenre": "AI_GENERATED",
    "additionalGenres": "AI_GENERATED",
    "moods": "AI_GENERATED",
    "instrumentation": "AI_GENERATED",
    "keywords": "AI_GENERATED",
    "trackDescription": "AI_GENERATED",
    "language": "AI_GENERATED",
    "vocalStyle": "AI_GENERATED",
    "energy_level": "AI_GENERATED",
    "energyLevel": "AI_GENERATED",
    "mood_vibe": "AI_GENERATED",
    "musicalEra": "AI_GENERATED",
    "productionQuality": "AI_GENERATED",
    "dynamics": "AI_GENERATED",
    "targetAudience": "AI_GENERATED",
    "tempoCharacter": "AI_GENERATED",
    "useCases": "AI_GENERATED",
    "structure": "AI_GENERATED",
    "analysisReasoning": "AI_GENERATED",
    "similar_artists": "AI_GENERATED",

    # No single reliable source in the current pipeline
    "iswc": "UNKNOWN",
    "composer": "UNKNOWN",
    "lyricist": "UNKNOWN",
    "producer": "UNKNOWN",
    "pLine": "UNKNOWN",
    "license": "UNKNOWN",
    "validation_report": "UNKNOWN",
}

# Fields where routes/analysis.py lets the file's own embedded tags win over
# the AI-suggested value when present (see process_analysis's file-tag
# merge step). When that happens the field is reclassified to EXTRACTED.
FILE_TAG_WINNER_FIELDS = {
    "title", "artist", "album", "year", "isrc", "upc", "catalogNumber",
    "copyright", "publisher",
}

_METHOD_BY_SOURCE = {
    "EXTRACTED": "technical-parser",
    "INFERRED": "dsp-analysis",
    "AI_GENERATED": "llm-ensemble",
    "VERIFIED": "cross-checked",
    "UNKNOWN": "none",
}

_DEFAULT_CONFIDENCE_BY_SOURCE = {
    "EXTRACTED": 1.0,
    "VERIFIED": 1.0,
    "INFERRED": 0.7,
    "AI_GENERATED": 0.6,
    "UNKNOWN": 0.0,
}


def build_provenance(raw_metadata: dict, file_tag_fields: set, overall_confidence: float | None) -> dict:
    """Build a {field: {source, confidence, method}} map.

    `raw_metadata` should be the metadata dict *before* sanitize_metadata
    fills in display defaults, so a field the pipeline never actually
    produced is honestly reported as UNKNOWN rather than AI_GENERATED.
    `file_tag_fields` is the set of field names actually overwritten by the
    file's own embedded tags during the merge step.
    """
    provenance = {}
    for field, source in DEFAULT_FIELD_SOURCE.items():
        value = raw_metadata.get(field)
        has_value = value not in (None, "", [], {})

        if field in FILE_TAG_WINNER_FIELDS and field in file_tag_fields:
            source = "EXTRACTED"
        elif not has_value:
            source = "UNKNOWN"

        confidence = _DEFAULT_CONFIDENCE_BY_SOURCE[source]
        if source == "AI_GENERATED" and overall_confidence is not None:
            confidence = overall_confidence

        provenance[field] = {
            "source": source,
            "confidence": round(float(confidence), 2),
            "method": _METHOD_BY_SOURCE[source],
        }
    return provenance
