"""CTranslate2 M2M100 translation engine."""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import ctranslate2
from transformers import AutoTokenizer

from .text_processing import (
    detect_language,
    join_translated,
    protect_text,
    restore_placeholders,
    split_text,
)

LOGGER = logging.getLogger(__name__)


@dataclass
class TranslationOutput:
    text: str
    source: str
    target: str
    cached: bool
    elapsed_ms: int
    protected_count: int


class TranslationEngine:
    """Thread-safe wrapper around a local CTranslate2 M2M100 model."""

    def __init__(
        self,
        model_dir: str | Path,
        device: str = "cpu",
        compute_type: str = "int8",
        inter_threads: int = 1,
        intra_threads: int = 0,
        cache_size: int = 2048,
        max_chunk_chars: int = 320,
    ) -> None:
        self.model_dir = str(Path(model_dir).resolve())
        if not Path(self.model_dir, "model.bin").is_file():
            raise FileNotFoundError(f"M2M100 model.bin not found in {self.model_dir}")
        self.device = device
        self.compute_type = compute_type
        self.max_chunk_chars = max_chunk_chars
        self.cache_size = max(0, cache_size)
        self.cache: OrderedDict[str, str] = OrderedDict()
        self.cache_lock = threading.RLock()

        self.translator = ctranslate2.Translator(
            self.model_dir,
            device=device,
            compute_type=compute_type,
            inter_threads=inter_threads,
            intra_threads=intra_threads,
        )
        self.tokenizers = {
            language: AutoTokenizer.from_pretrained(self.model_dir, src_lang=language)
            for language in ("zh", "en")
        }
        LOGGER.info(
            "loaded M2M100 model dir=%s device=%s compute_type=%s",
            self.model_dir,
            device,
            compute_type,
        )

    def _cache_key(
        self,
        text: str,
        source: str,
        target: str,
        glossary: dict[str, str] | None,
        preserve: Iterable[str] | None,
    ) -> str:
        payload = {
            "text": text,
            "source": source,
            "target": target,
            "glossary": glossary or {},
            "preserve": list(preserve or []),
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)

    def _cache_get(self, key: str) -> str | None:
        with self.cache_lock:
            value = self.cache.get(key)
            if value is None:
                return None
            self.cache.move_to_end(key)
            return value

    def _cache_set(self, key: str, value: str) -> None:
        if self.cache_size <= 0:
            return
        with self.cache_lock:
            self.cache[key] = value
            self.cache.move_to_end(key)
            while len(self.cache) > self.cache_size:
                self.cache.popitem(last=False)

    def _target_token(self, target: str) -> str:
        tokenizer = self.tokenizers["zh"]
        token_id = tokenizer.convert_tokens_to_ids(target)
        return tokenizer.convert_ids_to_tokens(token_id)

    def _translate_raw(self, text: str, source: str, target: str) -> str:
        tokenizer = self.tokenizers[source]
        source_tokens = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
        target_token = self._target_token(target)
        results = self.translator.translate_batch(
            [source_tokens],
            target_prefix=[[target_token]],
            beam_size=4,
            num_hypotheses=1,
            length_penalty=0.2,
            max_decoding_length=512,
            replace_unknowns=True,
        )
        output_tokens = list(results[0].hypotheses[0])
        if output_tokens and output_tokens[0] == target_token:
            output_tokens = output_tokens[1:]
        output_ids = tokenizer.convert_tokens_to_ids(output_tokens)
        return tokenizer.decode(output_ids, skip_special_tokens=True).strip()

    def _translate_chunked(self, text: str, source: str, target: str) -> str:
        chunks = split_text(text, self.max_chunk_chars)
        return join_translated([self._translate_raw(chunk, source, target) for chunk in chunks], target)

    def _translate_segmented(
        self,
        original: str,
        protection_matches,
        source: str,
        target: str,
    ) -> str:
        parts: list[str] = []
        cursor = 0
        for match in protection_matches:
            if match.start > cursor:
                parts.append(self._translate_chunked(original[cursor : match.start], source, target))
            parts.append(match.target)
            cursor = match.end
        if cursor < len(original):
            parts.append(self._translate_chunked(original[cursor:], source, target))
        return join_translated(parts, target)

    def translate(
        self,
        text: str,
        source: str = "auto",
        target: str = "auto",
        glossary: dict[str, str] | None = None,
        preserve: Iterable[str] | None = None,
    ) -> TranslationOutput:
        text = (text or "").strip()
        if not text:
            return TranslationOutput("", "auto", "auto", False, 0, 0)
        source, target = detect_language(text, source, target)
        cache_key = self._cache_key(text, source, target, glossary, preserve)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return TranslationOutput(cached, source, target, True, 0, 0)

        started = time.perf_counter()
        protection = protect_text(text, source, glossary, preserve)
        translated = self._translate_chunked(protection.text, source, target)
        restored, missing = restore_placeholders(translated, source, protection.replacements)
        if missing:
            LOGGER.warning("placeholder restoration failed, using segmented fallback: %s", missing)
            restored = self._translate_segmented(text, protection.matches, source, target)
        restored = restored.strip()
        self._cache_set(cache_key, restored)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        return TranslationOutput(
            text=restored,
            source=source,
            target=target,
            cached=False,
            elapsed_ms=elapsed_ms,
            protected_count=len(protection.matches),
        )

    def health(self) -> dict:
        return {
            "model_dir": self.model_dir,
            "device": self.device,
            "compute_type": self.compute_type,
            "cache_size": len(self.cache),
        }
