/* 神经翻译引擎（共享）：可在面板页或 Offscreen Document 中运行。
 * 封装 Transformers.js + opus-mt 系列 ONNX 模型的加载与推理；提供模型文件存在性检测，
 * 避免「首次使用因未下载模型而静默失败」（见 CODE_REVIEW.md H1）。
 * 双向支持：中→英用 opus-mt-zh-en，英→中用 opus-mt-en-zh（均为 Helsinki-NLP/Xenova 量化 ONNX）。
 * 模型/库默认被 .gitignore 排除，需先运行 tools/download_models.sh。 */
(function () {
  'use strict';

  const DKNeural = {};

  // 方向 -> 模型目录名（与 tools/download_models.sh 下载的目录一致）
  // zh2en 负责中文→英文；en2zh 负责英文→中文
  const MODELS = {
    zh2en: 'opus-mt-zh-en',
    en2zh: 'opus-mt-en-zh'
  };

  function isExt() { return location.protocol === 'chrome-extension:'; }

  function modelOf(dir) { return MODELS[dir] || MODELS.zh2en; }

  /* 检测关键文件是否已随扩展分发（HEAD 探测，避免下载大体积 wasm）。
   * 按方向检查对应的模型目录；共享运行库（transformers/ort）只查一次。
   * 返回缺失文件列表；空数组表示就绪。 */
  async function checkAssets(dir) {
    const model = modelOf(dir);
    const files = [
      'js/lib/transformers/transformers.min.js',
      'js/lib/ort/ort-wasm-simd-threaded.wasm',
      'models/' + model + '/config.json'
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

  const pipes = {};        // 方向 -> 已加载 pipeline
  const loadingP = {};     // 方向 -> 进行中的加载 Promise（防并发重复加载）

  async function getPipeline(dir, onStatus) {
    dir = MODELS[dir] ? dir : 'zh2en';
    const model = MODELS[dir];
    if (pipes[dir]) return pipes[dir];
    if (loadingP[dir]) return loadingP[dir];
    loadingP[dir] = (async () => {
      const missing = await checkAssets(dir);
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
      onStatus && onStatus('模型「' + model + '」加载中…（首次约 10-30 秒）');
      // 抑制两条无害警告（不影响功能与翻译结果）：
      // ① chrome-extension:// 本地文件响应不带 Content-Length，Transformers.js 会提示，属正常；
      // ② opus-mt 系列使用 Marian 分词器，Transformers.js 的 fast 分词器暂不支持，会自动回退到正确的 slow 分词器
      const _origWarn = console.warn;
      console.warn = function () {
        const s = Array.prototype.map.call(arguments, x => (x && x.message) || String(x)).join(' ');
        if (/Unable to determine content-length/i.test(s) || /MarianTokenizer/i.test(s)) return;
        return _origWarn.apply(console, arguments);
      };
      try {
        return await mod.pipeline('translation', model, {
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
    try { pipes[dir] = await loadingP[dir]; return pipes[dir]; }
    finally { loadingP[dir] = null; }
  }
  DKNeural.getPipeline = getPipeline;

  async function run(text, opts) {
    opts = opts || {};
    const dir = MODELS[opts.dir] ? opts.dir : 'zh2en';
    const p = await getPipeline(dir, opts.onStatus);
    const result = await p(text, { max_new_tokens: 256 });
    return (result && result[0] && result[0].translation_text) || '';
  }
  DKNeural.run = run;

  window.DKNeural = DKNeural;
})();
