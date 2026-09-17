#!/bin/bash
# 下载神经翻译运行库与模型文件（约 150MB）
# 国内网络：模型走 hf-mirror.com（默认），库走 jsdelivr（国内可达）；海外可加参数 huggingface
# 用法: bash _tools/download_models.sh [mirror|huggingface]
# 供应链安全：下载后做内容校验（镜像若返回 HTML 错误页则失败），并打印 sha256 供团队固定基线。
set -e
cd "$(dirname "$0")/.."

HOST="${1:-mirror}"
case "$HOST" in
  mirror)    MBASE="https://hf-mirror.com/Xenova/opus-mt-zh-en/resolve/main" ;;
  huggingface) MBASE="https://huggingface.co/Xenova/opus-mt-zh-en/resolve/main" ;;
  *) echo "未知镜像: $1（可选 mirror / huggingface）"; exit 1 ;;
esac

TF_VER="4.3.0"
ORT_VER="1.31.0-dev.20260914-8d85527a0"
JSD="https://cdn.jsdelivr.net/npm"

SHA_CMD="sha256sum"
command -v sha256sum >/dev/null 2>&1 || SHA_CMD="shasum -a 256"

# 校验：镜像偶尔会返回 HTML 错误页而非真实文件，必须拦下，否则扩展加载会报语法错误
check_not_html() {
  local f="$1"
  if [ -s "$f" ] && head -c 200 "$f" | tr -d '\0' | grep -qiE '<!DOCTYPE|<html|404 Not Found|Error '; then
    echo "!! 下载失败或内容异常（疑似镜像返回错误页）：$f" >&2
    echo "   前 200 字节：" >&2
    head -c 200 "$f" | sed 's/^/   /' >&2
    return 1
  fi
  return 0
}

# ---- 1. 运行库（transformers.js + onnxruntime-web wasm）----
mkdir -p js/lib/transformers js/lib/ort
[ -s js/lib/transformers/transformers.min.js ] || curl -L --fail -o js/lib/transformers/transformers.min.js "$JSD/@huggingface/transformers@$TF_VER/dist/transformers.min.js"
check_not_html js/lib/transformers/transformers.min.js
echo "OK js/lib/transformers/transformers.min.js ($(du -h js/lib/transformers/transformers.min.js | cut -f1))"
for f in ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.asyncify.mjs ort-wasm-simd-threaded.asyncify.wasm; do
  [ -s "js/lib/ort/$f" ] || curl -L --fail -o "js/lib/ort/$f" "$JSD/onnxruntime-web@$ORT_VER/dist/$f"
  check_not_html "js/lib/ort/$f"
  echo "OK js/lib/ort/$f ($(du -h "js/lib/ort/$f" | cut -f1))"
done

# ---- 2. 模型（opus-mt-zh-en，约 110MB）----
mkdir -p models/opus-mt-zh-en/onnx
echo "从 $MBASE 下载模型…"
for f in config.json generation_config.json tokenizer.json tokenizer_config.json special_tokens_map.json vocab.json source.spm target.spm; do
  [ -s "models/opus-mt-zh-en/$f" ] || curl -L --fail -o "models/opus-mt-zh-en/$f" "$MBASE/$f"
  check_not_html "models/opus-mt-zh-en/$f"
  echo "OK $f"
done
for f in encoder_model_quantized.onnx decoder_model_merged_quantized.onnx; do
  [ -s "models/opus-mt-zh-en/onnx/$f" ] || curl -L --fail -o "models/opus-mt-zh-en/onnx/$f" "$MBASE/onnx/$f"
  check_not_html "models/opus-mt-zh-en/onnx/$f"
  echo "OK onnx/$f ($(du -h "models/opus-mt-zh-en/onnx/$f" | cut -f1))"
done

echo
echo "==== 下载产物 sha256（建议团队固定基线，后续可加 EXPECTED_SHA256 校验）===="
for f in js/lib/transformers/transformers.min.js \
         js/lib/ort/ort-wasm-simd-threaded.wasm \
         js/lib/ort/ort-wasm-simd-threaded.asyncify.wasm \
         models/opus-mt-zh-en/onnx/encoder_model_quantized.onnx \
         models/opus-mt-zh-en/onnx/decoder_model_merged_quantized.onnx; do
  [ -s "$f" ] && echo "$($SHA_CMD "$f" | awk '{print $1}')  $f"
done
echo "完成。重新加载扩展即可使用「神经翻译」。"
