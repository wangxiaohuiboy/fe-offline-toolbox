# 内网离线翻译服务

基于 **CTranslate2 + M2M100-418M int8** 的离线中英翻译服务，适合部署在公司内网或本机，不访问公网。

## 特点

- M2M100 单模型支持中英双向和 100 种语言。
- CTranslate2 int8 推理，CPU 可用。
- 支持术语表、代码符号保护和长文本分片。
- 提供插件兼容的 `POST /translate` 接口。
- 内存 LRU 翻译缓存。
- 可选 Docker 部署和 API Key 保护。
- MIT 许可模型，企业内部使用风险较低。

## 架构

```text
Chrome 插件
   ↓ 公司内网 HTTP
FastAPI /translate
   ↓
CTranslate2 + M2M100-418M int8
```

## 1. 准备模型

在能够访问模型镜像的机器上执行：

```bash
cd server/translation-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_model.py --output ./models/m2m100-418m-ct2-int8
```

默认使用 `https://hf-mirror.com`。模型目录需要包含：

```text
models/m2m100-418m-ct2-int8/
├── model.bin
├── config.json
├── shared_vocabulary.json
├── sentencepiece.bpe.model
├── tokenizer.json
├── tokenizer_config.json
├── special_tokens_map.json
└── vocab.json
```

将整个目录复制到内网服务器。服务运行期间不再访问网络。

## 2. 直接运行

```bash
source .venv/bin/activate
TRANSLATE_MODEL_DIR=./models/m2m100-418m-ct2-int8 \
TRANSLATE_DEVICE=cpu \
TRANSLATE_COMPUTE_TYPE=int8 \
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

## 3. Docker 部署

```bash
docker compose up -d --build
```

服务默认监听 `8000` 端口。

## 4. API

### 插件兼容接口

插件“内网翻译接口”推荐配置：

- 地址：`http://translate.intranet.local:8000/translate`
- 方法：`POST`
- 参数名：`q`
- 响应路径：`data`

请求：

```json
{
  "q": "当接口返回 401 时跳转登录页",
  "source": "auto",
  "target": "auto",
  "glossary": {
    "接口": "API",
    "登录页": "login page"
  },
  "preserve": ["orderStatus", "EmptyState"]
}
```

响应：

```json
{
  "data": "When the API returns 401, redirect to the login page.",
  "text": "When the API returns 401, redirect to the login page.",
  "source": "zh",
  "target": "en",
  "engine": "m2m100-418m-ct2-int8",
  "cached": false,
  "elapsed_ms": 186,
  "protected_count": 3
}
```

### GET

```bash
curl --get 'http://127.0.0.1:8000/translate' \
  --data-urlencode 'q=用户支付订单后自动发送短信通知' \
  --data 'source=auto' \
  --data 'target=auto'
```

### API Key

设置环境变量：

```bash
export TRANSLATE_API_KEY='your-intranet-secret'
```

请求时添加：

```text
X-API-Key: your-intranet-secret
```

## 5. 配置项

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `TRANSLATE_MODEL_DIR` | `./models/m2m100-418m-ct2-int8` | 本地模型目录 |
| `TRANSLATE_DEVICE` | `cpu` | `cpu` 或 `cuda` |
| `TRANSLATE_COMPUTE_TYPE` | `int8` | CTranslate2 精度 |
| `TRANSLATE_INTER_THREADS` | `1` | 并行请求线程 |
| `TRANSLATE_INTRA_THREADS` | `0` | 单请求算力线程，0 表示自动 |
| `TRANSLATE_CACHE_SIZE` | `2048` | 内存缓存条数 |
| `TRANSLATE_MAX_CHUNK_CHARS` | `320` | 单段最大字符数 |
| `TRANSLATE_API_KEY` | 空 | 可选 API Key |
| `TRANSLATE_ALLOWED_ORIGINS` | `*` | CORS 白名单 |

## 6. 生产建议

- 仅绑定内网网卡或通过防火墙限制端口。
- 建议配置 `TRANSLATE_API_KEY`。
- GPU 服务可将 `TRANSLATE_DEVICE=cuda`，使用 float16 或 int8。
- 模型文件和缓存目录不要暴露为静态文件。
- 先用真实前端语料建立 100–200 条回归集。
- 常见术语应通过 `glossary` 传递，不要完全依赖模型猜测。
- 代码只保留在本地扩展或内网服务中，不发送到公网。

## 7. 测试

```bash
pip install -r requirements-dev.txt
pytest -q
```

## 8. 许可

- 服务代码：MIT
- 模型：`facebook/m2m100_418M`，MIT
- CTranslate2：MIT
