/* 神经翻译引擎（共享）：可在面板页或 Offscreen Document 中运行。
 * 封装 Transformers.js + opus-mt-zh-en 的加载与推理；提供模型文件存在性检测，
 * 避免「首次使用因未下载模型而静默失败」（见 CODE_REVIEW.md H1）。
 * 模型/库默认被 .gitignore 排除，需先运行 tools/download_models.sh。 */
(function () {
  'use strict';

  const DKNeural = {};

  function isExt() { return location.protocol === 'chrome-extension:'; }

  /* 检测关键文件是否已随扩展分发（HEAD 探测，避免下载大体积 wasm）。
   * 返回缺失文件列表；空数组表示就绪。 */
  async function checkAssets() {
    const files = [
      'js/lib/transformers/transformers.min.js',
      'js/lib/ort/ort-wasm-simd-threaded.wasm',
      'models/opus-mt-zh-en/config.json'
    ];
    const missing = [];
    for (const f of files) {
      const url = isExt() ? chrome.runtime.getURL(f) : f;
      try {
        const r = await fetch(url, { method: 'HEAD' });
        if (!r.ok) missing.push(f);
      } catch (e) { missing.push(f); }
    }
    return missing;
  }
  DKNeural.checkAssets = checkAssets;

  let pipe = null, loading = false, loadingP = null;

  async function getPipeline(onStatus) {
    if (pipe) return pipe;
    if (loading) return loadingP;
    loading = true;
    loadingP = (async () => {
      const missing = await checkAssets();
      if (missing.length) {
        const err = new Error('MISSING_ASSETS:' + missing.join(','));
        err.code = 'MISSING_ASSETS';
        err.missing = missing;
        throw err;
      }
      const modelBase = isExt() ? chrome.runtime.getURL('models/') : 'models/';
      const ortBase = isExt() ? chrome.runtime.getURL('js/lib/ort/') : new URL('js/lib/ort/', location.href).href;
      const tfUrl = isExt() ? chrome.runtime.getURL('js/lib/transformers/transformers.min.js')
                            : new URL('js/lib/transformers/transformers.min.js', location.href).href;
      const mod = await import(tfUrl);
      mod.env.allowLocalModels = true;
      mod.env.allowRemoteModels = false;
      mod.env.localModelPath = modelBase;
      // 防御：部分 transformers 版本 backends 结构未就绪，判空后再赋值
      if (mod.env.backends && mod.env.backends.onnx && mod.env.backends.onnx.wasm) {
        mod.env.backends.onnx.wasm.wasmPaths = ortBase;
        mod.env.backends.onnx.wasm.numThreads = 1;   // 扩展页无 SharedArrayBuffer，单线程
      }
      onStatus && onStatus('模型加载中…（首次约 10-30 秒）');
      // 抑制两条无害警告（不影响功能与翻译结果）：
      // ① chrome-extension:// 本地文件响应不带 Content-Length，Transformers.js 会提示，属正常；
      // ② opus-mt-zh-en 使用 Marian 分词器，Transformers.js 的 fast 分词器暂不支持，会自动回退到正确的 slow 分词器
      const _origWarn = console.warn;
      console.warn = function () {
        const s = Array.prototype.map.call(arguments, x => (x && x.message) || String(x)).join(' ');
        if (/Unable to determine content-length/i.test(s) || /MarianTokenizer/i.test(s)) return;
        return _origWarn.apply(console, arguments);
      };
      try {
        return await mod.pipeline('translation', 'opus-mt-zh-en', {
          dtype: 'q8', device: 'wasm',
          progress_callback: p => {
            if (!onStatus) return;
            if (p && p.status === 'progress' && p.total) {
              onStatus('加载模型… ' + Math.round(p.loaded / p.total * 100) + '%（' + p.file.split('/').pop() + '）');
            } else if (p && p.status) {
              onStatus('模型加载：' + p.status);
            }
          }
        });
      } finally {
        console.warn = _origWarn;
      }
    })();
    try { pipe = await loadingP; return pipe; }
    finally { loading = false; }
  }
  DKNeural.getPipeline = getPipeline;

  async function run(text, opts) {
    opts = opts || {};
    const p = await getPipeline(opts.onStatus);
    const result = await p(text, { max_new_tokens: 256 });
    return (result && result[0] && result[0].translation_text) || '';
  }
  DKNeural.run = run;

  window.DKNeural = DKNeural;
})();
