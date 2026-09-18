# Offline Intranet Translation Service

A fully offline Chinese-English translation service based on **CTranslate2 + M2M100-418M int8**. It is designed for local or company intranet deployment and never requires public internet access at runtime.

## Features

- One M2M100 model supports Chinese-English and 100 languages.
- CPU-friendly CTranslate2 int8 inference.
- Glossary, code-symbol protection and long-text chunking.
- Extension-compatible `POST /translate` endpoint.
- In-memory LRU translation cache.
- Optional Docker deployment and API-key protection.
- MIT-licensed model.

## Prepare the model

Run on a machine that can access the configured model mirror:

```bash
cd server/translation-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_model.py --output ./models/m2m100-418m-ct2-int8
```

Copy the complete model directory to the intranet server. The service will not access the network afterward.

## Run directly

```bash
source .venv/bin/activate
TRANSLATE_MODEL_DIR=./models/m2m100-418m-ct2-int8 \
TRANSLATE_DEVICE=cpu \
TRANSLATE_COMPUTE_TYPE=int8 \
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

## Docker

```bash
docker compose up -d --build
```

## API

Extension-compatible request:

```bash
curl -X POST 'http://127.0.0.1:8000/translate' \
  -H 'Content-Type: application/json' \
  -d '{"q":"用户支付订单后自动发送短信通知","source":"auto","target":"auto"}'
```

Response:

```json
{
  "data": "The user automatically sends an SMS notification after paying for the order.",
  "text": "The user automatically sends an SMS notification after paying for the order.",
  "source": "zh",
  "target": "en",
  "engine": "m2m100-418m-ct2-int8",
  "cached": false,
  "elapsed_ms": 186,
  "protected_count": 0
}
```

Recommended extension settings:

- URL: `http://translate.intranet.local:8000/translate`
- Method: `POST`
- Query parameter: `q`
- Response path: `data`

## Security

- Bind the service to the intranet interface or restrict it with a firewall.
- Set `TRANSLATE_API_KEY` in production.
- Do not expose the model directory as static content.
- Keep model files and translation data inside the intranet.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

## License

- Service code: MIT
- Model: `facebook/m2m100_418M`, MIT
- CTranslate2: MIT
