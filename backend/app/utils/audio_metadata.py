import re


def is_valid_isrc(isrc_code: str) -> bool:
    """
    Validates the format of an ISRC code.
    Format: CC-XXX-YY-NNNNN (12 characters total)
    CC: Country Code (2 alphanumeric characters)
    XXX: Registrant Code (3 alphanumeric characters)
    YY: Year of Reference (last two digits of the year)
    NNNNN: Designation Code (5 digits)
    """
    if not isinstance(isrc_code, str):
        return False
    # Regex for ISRC: two alphanumeric, hyphen, three alphanumeric, hyphen, two digits, hyphen, five digits
    # Allow for optional hyphens during initial input, but canonical form uses them.
    # The standard ISRC format is 12 characters, no hyphens when stored, but often displayed with hyphens.
    # For validation, we'll check the structure.
    # A common regex for validation that allows for or ignores hyphens in input:
    # ^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$ (without hyphens)
    # Or for input that might contain hyphens:
    isrc_pattern = re.compile(r"^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$", re.IGNORECASE)

    # Remove hyphens for strict validation if present in input
    cleaned_isrc = isrc_code.replace("-", "")

    return bool(isrc_pattern.match(cleaned_isrc))
