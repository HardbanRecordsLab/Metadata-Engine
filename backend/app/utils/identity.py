"""Track identity: what the file itself says wins over what a language model makes up.

Two defects this removes:
  * the file-tag merge only filled a field when the model had left it EMPTY, so a model's guess overrode the artist's own tag (the
    provenance docstring always said the tags win);
  * for a file with no title tag the model invented one, and a different one on every run ("Midnight Reverie", "Midnight Whisper" for
    the same file). A title that changes between runs is not metadata. The file's own name is deterministic; the model's idea is kept as
    `suggestedTitle`, labelled as a suggestion, for the user to accept.
"""
import os
import re
from typing import Any, Dict, Optional, Set, Tuple

IDENTITY_FIELDS = ("title", "artist", "album", "year", "isrc", "upc", "catalogNumber", "copyright", "publisher")
_AUDIO_EXT = re.compile(r"\.(wav|wave|mp3|flac|aiff?|m4a|aac|ogg|opus|wma)$", re.I)
_EMPTY = (None, "", [], {})


def title_from_filename(name: Optional[str]) -> str:
    """'03 - dark_driving-techno (final mix).wav' -> 'dark driving-techno (final mix)'. Empty when nothing usable is left."""
    base = os.path.basename(str(name or "")).strip()
    base = _AUDIO_EXT.sub("", base)
    base = re.sub(r"^\s*\d{1,3}\s*[-._)]*\s+", "", base)             # a leading track number ("03 - ", "07. ")
    base = re.sub(r"[_]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip(" -.")
    return base if re.search(r"[^\W\d_]", base, re.U) else ""           # needs at least one letter ("12345" is not a title)


def merge_identity(metadata: Dict[str, Any], tags: Dict[str, Any], file_name: Optional[str]) -> Tuple[Set[str], Set[str]]:
    """Apply the file's embedded tags and, for an untitled file, its name. Mutates `metadata`; returns (fields from tags, fields from the file name)."""
    from_tags: Set[str] = set()
    from_name: Set[str] = set()
    for field in IDENTITY_FIELDS:
        value = (tags or {}).get(field)
        if value not in _EMPTY:
            metadata[field] = value
            from_tags.add(field)
    if "title" not in from_tags:
        guess = metadata.get("title")
        name_title = title_from_filename(file_name)
        if name_title:
            if guess not in _EMPTY and guess != name_title:
                metadata["suggestedTitle"] = guess                      # the model's idea, kept apart and never used as the title
            metadata["title"] = name_title
            from_name.add("title")
    elif metadata.get("suggestedTitle") == metadata.get("title"):
        metadata.pop("suggestedTitle", None)
    return from_tags, from_name


def refresh_cached_identity(result: Dict[str, Any], tags: Dict[str, Any], file_name: Optional[str]) -> Tuple[Set[str], Set[str]]:
    """A cached analysis describes the AUDIO; the title belongs to this upload's own tags and file name. Put the model's own title back if
    an earlier upload had set it aside, then apply this upload's identity."""
    if result.get("suggestedTitle") not in _EMPTY:
        result["title"] = result.pop("suggestedTitle")
    return merge_identity(result, tags, file_name)
