"""Text splitting, glossary handling and code-symbol protection."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")

CODE_PATTERNS = [
    re.compile(r"`[^`\n]+`"),
    re.compile(r"</?[A-Za-z][^>\n]*>"),
    re.compile(r"https?://[^\s<>\"')\]]+"),
    re.compile(r"\b[\w.-]+\.(?:js|jsx|ts|tsx|vue|css|scss|less|json|md|ya?ml)\b"),
]

IDENTIFIER_RE = re.compile(r"\b[A-Za-z_$][\w$]*\b")


@dataclass(frozen=True)
class ProtectedMatch:
    start: int
    end: int
    target: str
    kind: str


@dataclass(frozen=True)
class PlaceholderReplacement:
    label: str
    placeholder: str
    target: str


@dataclass(frozen=True)
class ProtectionResult:
    text: str
    replacements: list[PlaceholderReplacement]
    matches: list[ProtectedMatch]


def detect_language(text: str, source: str = "auto", target: str = "auto") -> tuple[str, str]:
    source = (source or "auto").lower()
    target = (target or "auto").lower()
    if source == "auto":
        source = "zh" if CJK_RE.search(text) else "en"
    if target == "auto":
        target = "en" if source == "zh" else "zh"
    if source == target:
        raise ValueError("source and target languages must differ")
    if source not in {"zh", "en"} or target not in {"zh", "en"}:
        raise ValueError("only zh and en are supported by this service")
    return source, target


def split_text(text: str, max_chars: int = 320) -> list[str]:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text:
        return []
    segments = re.split(r"(?<=[。！？!?；;])|\n", text)
    chunks: list[str] = []
    current = ""
    for segment in segments:
        if not segment:
            continue
        if len(segment) > max_chars:
            remaining = segment
            while len(remaining) > max_chars:
                cut = max(
                    (index + 1 for index, char in enumerate(remaining[:max_chars]) if char in "，。；！？,.;!? "),
                    default=max_chars,
                )
                if cut < int(max_chars * 0.55):
                    cut = max_chars
                piece, remaining = remaining[:cut], remaining[cut:]
                if current:
                    chunks.append(current)
                    current = ""
                chunks.append(piece)
            segment = remaining
        if not current:
            current = segment
        elif len(current) + len(segment) <= max_chars:
            current += segment
        else:
            chunks.append(current)
            current = segment
    if current:
        chunks.append(current)
    return chunks


def is_code_identifier(value: str) -> bool:
    if len(value) < 2:
        return False
    if "_" in value or "$" in value:
        return True
    if re.search(r"[a-z][A-Z]", value):
        return True
    return bool(re.fullmatch(r"[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+", value))


def collect_code_matches(text: str) -> list[ProtectedMatch]:
    matches: list[ProtectedMatch] = []
    for pattern in CODE_PATTERNS:
        for match in pattern.finditer(text):
            matches.append(ProtectedMatch(match.start(), match.end(), match.group(0), "code"))
    for match in IDENTIFIER_RE.finditer(text):
        value = match.group(0)
        if is_code_identifier(value):
            matches.append(ProtectedMatch(match.start(), match.end(), value, "code"))
    return matches


def collect_glossary_matches(
    text: str,
    source: str,
    glossary: dict[str, str] | None,
) -> list[ProtectedMatch]:
    matches: list[ProtectedMatch] = []
    for term, translation in (glossary or {}).items():
        if not term or not translation:
            continue
        ascii_term = term.isascii()
        start = 0
        while start < len(text):
            index = text.find(term, start)
            if index < 0:
                break
            before = text[index - 1] if index > 0 else ""
            after = text[index + len(term)] if index + len(term) < len(text) else ""
            if ascii_term and (re.match(r"[A-Za-z0-9_]", before) or re.match(r"[A-Za-z0-9_]", after)):
                start = index + len(term)
                continue
            matches.append(ProtectedMatch(index, index + len(term), translation, "term"))
            start = index + len(term)
    return matches


def collect_preserve_matches(text: str, preserve: Iterable[str] | None) -> list[ProtectedMatch]:
    matches: list[ProtectedMatch] = []
    for term in preserve or []:
        if not term:
            continue
        start = 0
        while start < len(text):
            index = text.find(term, start)
            if index < 0:
                break
            matches.append(ProtectedMatch(index, index + len(term), term, "preserve"))
            start = index + len(term)
    return matches


def select_non_overlapping(matches: Iterable[ProtectedMatch]) -> list[ProtectedMatch]:
    selected: list[ProtectedMatch] = []
    last_end = -1
    for match in sorted(matches, key=lambda item: (item.start, -(item.end - item.start))):
        if match.start < last_end:
            continue
        selected.append(match)
        last_end = match.end
    return selected


def placeholder_label(index: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    letter = alphabet[index % len(alphabet)]
    cycle = index // len(alphabet)
    return letter + (str(cycle + 1) if cycle else "")


def protect_text(
    text: str,
    source: str,
    glossary: dict[str, str] | None = None,
    preserve: Iterable[str] | None = None,
) -> ProtectionResult:
    matches = select_non_overlapping(
        [
            *collect_glossary_matches(text, source, glossary),
            *collect_preserve_matches(text, preserve),
            *collect_code_matches(text),
        ]
    )
    if not matches:
        return ProtectionResult(text=text, replacements=[], matches=[])

    output: list[str] = []
    replacements: list[PlaceholderReplacement] = []
    cursor = 0
    for index, match in enumerate(matches):
        output.append(text[cursor : match.start])
        label = placeholder_label(index)
        placeholder = f"占位符{label}" if source == "zh" else f"placeholder {label}"
        output.append(placeholder)
        replacements.append(PlaceholderReplacement(label, placeholder, match.target))
        cursor = match.end
    output.append(text[cursor:])
    return ProtectionResult(text="".join(output), replacements=replacements, matches=matches)


def restore_placeholders(
    translated: str,
    source: str,
    replacements: Iterable[PlaceholderReplacement],
) -> tuple[str, list[str]]:
    output = translated
    missing: list[str] = []
    for replacement in replacements:
        label = re.escape(replacement.label)
        patterns = (
            [re.compile(rf"占位符\s*{label}", re.IGNORECASE), re.compile(rf"place\s*holder\s*{label}", re.IGNORECASE)]
            if source == "zh"
            else [re.compile(rf"placeholder\s*{label}", re.IGNORECASE), re.compile(rf"占位符\s*{label}", re.IGNORECASE)]
        )
        for pattern in patterns:
            updated = pattern.sub(replacement.target, output)
            if updated != output:
                output = updated
                break
        else:
            missing.append(replacement.placeholder)
    return output, missing


def join_translated(parts: Iterable[str], target: str) -> str:
    cleaned = [part.strip() for part in parts if part and part.strip()]
    if target == "zh":
        output = "".join(cleaned)
    else:
        output = " ".join(cleaned)
    output = re.sub(r"\s+([,.;:!?，。；：！？])", r"\1", output)
    output = re.sub(r"([(\[{（【])\s+", r"\1", output)
    return re.sub(r"\s{2,}", " ", output).strip()
