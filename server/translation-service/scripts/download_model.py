#!/usr/bin/env python3
"""Download M2M100 CTranslate2 and tokenizer files for offline deployment."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from huggingface_hub import snapshot_download

CT2_REPO = "gn64/M2M100_418M_CTranslate2"
TOKENIZER_REPO = "facebook/m2m100_418M"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="./models/m2m100-418m-ct2-int8")
    args = parser.parse_args()

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

    print(f"downloading {CT2_REPO}")
    snapshot_download(
        repo_id=CT2_REPO,
        local_dir=output,
        allow_patterns=[
            "model.bin",
            "config.json",
            "shared_vocabulary.json",
            "sentencepiece.bpe.model",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
        ],
    )
    print(f"downloading tokenizer metadata from {TOKENIZER_REPO}")
    snapshot_download(
        repo_id=TOKENIZER_REPO,
        local_dir=output,
        allow_patterns=[
            "vocab.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "sentencepiece.bpe.model",
        ],
    )
    print(f"model ready: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
