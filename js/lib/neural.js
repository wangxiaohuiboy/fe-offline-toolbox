/* 神经翻译引擎（共享）：可在面板页或 Offscreen Document 中运行。
 * 封装 Transformers.js + opus-mt 系列 ONNX 模型的加载与推理。
 *
 * v1.7.0 起增加三层准确性增强：
 * 1. 长文本按句/长度分片，避免超过模型上限后静默截断；
 * 2. 术语优先直出，自定义词库和常见前端术语不交给模型猜测；
 * 3. 代码标签、变量名、URL、文件路径等符号拆分保护，翻译后原样还原。
 *
 * 模型/库默认被 .gitignore 排除，需先运行 tools/download_models.sh。 */
(function () {
  'use strict';

  const DKNeural = {};

  const MODELS = {
    zh2en: 'opus-mt-zh-en',
    en2zh: 'opus-mt-en-zh'
  };

  const MAX_CHUNK_CHARS = 320;

  // 高频、易错的前端术语。精确直出比让 77M 翻译模型猜更稳定。
  const TECH_TERMS = [
    ['代码仓库', 'code repository'],
    ['代码评审', 'code review'],
    ['空状态', 'empty state'],
    ['错误状态', 'error state'],
    ['加载状态', 'loading state'],
    ['表单校验', 'form validation'],
    ['重复提交', 'duplicate submission'],
    ['登录页', 'login page'],
    ['变量名', 'variable name'],
    ['接口', 'API'],
    ['前端', 'frontend'],
    ['后端', 'backend'],
    ['仓库', 'repository'],
    ['页面', 'page'],
    ['组件', 'component'],
    ['字段', 'field'],
    ['按钮', 'button'],
    ['权限', 'permission'],
    ['路由', 'route'],
    ['请求', 'request'],
    ['响应', 'response'],
    ['重试', 'retry']
  ];

  function isExt() { return location.protocol === 'chrome-extension:'; }

  function modelOf(dir) { return MODELS[dir] || MODELS.zh2en; }

  async function checkAssets(dir) {
    const model = modelOf(dir);
    const files = [
      'js/lib/transformers/transformers.min.js',
      'js/lib/ort/ort-wasm-simd-threaded.wasm',
      'models/' + model + '/config.json'
    ];
    const missing = [];
    for (const file of files) {
      const url = isExt() ? chrome.runtime.getURL(file) : file;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) missing.push(file);
      } catch (error) {
        missing.push(file);
      }
    }
    return missing;
  }
  DKNeural.checkAssets = checkAssets;

  const pipes = {};
  const loadingPromises = {};

  async function getPipeline(dir, onStatus) {
    dir = MODELS[dir] ? dir : 'zh2en';
    const model = MODELS[dir];
    if (pipes[dir]) return pipes[dir];
    if (loadingPromises[dir]) return loadingPromises[dir];

    loadingPromises[dir] = (async () => {
      const missing = await checkAssets(dir);
      if (missing.length) {
        const error = new Error('MISSING_ASSETS:' + missing.join(','));
        error.code = 'MISSING_ASSETS';
        error.missing = missing;
        throw error;
      }

      const modelBase = isExt() ? chrome.runtime.getURL('models/') : 'models/';
      const ortBase = isExt() ? chrome.runtime.getURL('js/lib/ort/') : new URL('js/lib/ort/', location.href).href;
      const transformersUrl = isExt() ? chrome.runtime.getURL('js/lib/transformers/transformers.min.js')
                                     : new URL('js/lib/transformers/transformers.min.js', location.href).href;
      const module = await import(transformersUrl);

      module.env.allowLocalModels = true;
      module.env.allowRemoteModels = false;
      module.env.localModelPath = modelBase;
      if (module.env.backends && module.env.backends.onnx && module.env.backends.onnx.wasm) {
        module.env.backends.onnx.wasm.wasmPaths = ortBase;
        module.env.backends.onnx.wasm.numThreads = 1;
      }

      onStatus && onStatus('模型「' + model + '」加载中…（首次约 10-30 秒）');

      const originalWarn = console.warn;
      console.warn = function () {
        const message = Array.prototype.map.call(arguments, value => (value && value.message) || String(value)).join(' ');
        if (/Unable to determine content-length/i.test(message) || /MarianTokenizer/i.test(message)) return;
        return originalWarn.apply(console, arguments);
      };

      let lastProgressPercent = -1;
      try {
        return await module.pipeline('translation', model, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: progress => {
            if (!onStatus) return;
            if (progress && progress.status === 'progress' && progress.total) {
              const percent = Math.round(progress.loaded / progress.total * 100);
              if (percent === lastProgressPercent) return;
              lastProgressPercent = percent;
              onStatus('加载模型… ' + percent + '%（' + progress.file.split('/').pop() + '）');
            } else if (progress && progress.status === 'ready') {
              onStatus('模型加载完成');
            }
          }
        });
      } finally {
        console.warn = originalWarn;
      }
    })();

    try {
      pipes[dir] = await loadingPromises[dir];
      return pipes[dir];
    } finally {
      loadingPromises[dir] = null;
    }
  }
  DKNeural.getPipeline = getPipeline;

  function customTermPairs() {
    try {
      if (window.DKTranslate && typeof window.DKTranslate.getCustomEntries === 'function') {
        return window.DKTranslate.getCustomEntries();
      }
    } catch (error) {}
    return [];
  }

  function termPairs(direction) {
    const pairs = new Map();
    for (const [zh, en] of TECH_TERMS) pairs.set(zh, en);
    for (const entry of customTermPairs()) {
      if (entry && entry.zh && entry.en) pairs.set(entry.zh, entry.en);
    }

    const output = [];
    for (const [zh, en] of pairs.entries()) {
      if (direction === 'en2zh') output.push({ source: en, target: zh, ascii: true });
      else output.push({ source: zh, target: en, ascii: false });
    }
    return output.sort((a, b) => b.source.length - a.source.length);
  }

  function codeRegexes() {
    return [
      /`[^`\n]+`/g,
      /<\/?[A-Za-z][^>\n]*>/g,
      /https?:\/\/[^\s<>"')\]]+/g,
      /\b[\w.-]+\.(?:js|jsx|ts|tsx|vue|css|scss|less|json|md|ya?ml)\b/g,
      /\b[A-Za-z_$][\w$]*\b/g
    ];
  }

  function isCodeIdentifier(value) {
    if (!value || value.length < 2) return false;
    if (/[_$]/.test(value)) return true;
    if (/[a-z][A-Z]/.test(value)) return true;
    if (/^[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+$/.test(value)) return true;
    return false;
  }

  function collectCodeMatches(text) {
    const matches = [];
    for (const regex of codeRegexes()) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const value = match[0];
        if (regex.source.includes('A-Za-z_$') && !isCodeIdentifier(value)) continue;
        matches.push({ start: match.index, end: match.index + value.length, target: value, kind: 'code' });
      }
    }
    return matches;
  }

  function collectTermMatches(text, direction) {
    const matches = [];
    for (const pair of termPairs(direction)) {
      if (!pair.source) continue;
      let start = 0;
      while (start < text.length) {
        const index = text.indexOf(pair.source, start);
        if (index < 0) break;
        if (pair.ascii) {
          const before = index > 0 ? text[index - 1] : '';
          const after = text[index + pair.source.length] || '';
          if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
            start = index + pair.source.length;
            continue;
          }
        }
        matches.push({ start: index, end: index + pair.source.length, target: pair.target, kind: 'term' });
        start = index + pair.source.length;
      }
    }
    return matches;
  }

  function selectNonOverlapping(matches) {
    const sorted = matches.slice().sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });
    const selected = [];
    let lastEnd = -1;
    for (const match of sorted) {
      if (match.start < lastEnd) continue;
      selected.push(match);
      lastEnd = match.end;
    }
    return selected;
  }

  function splitLongSegment(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const parts = [];
    let remaining = text;
    while (remaining.length > maxChars) {
      let cut = -1;
      for (let index = maxChars; index >= Math.floor(maxChars * 0.55); index--) {
        if (/[，。；！？,.;!?\s]/.test(remaining[index])) { cut = index + 1; break; }
      }
      if (cut < 0) cut = maxChars;
      parts.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }
    if (remaining) parts.push(remaining);
    return parts;
  }

  function buildChunks(text, maxChars) {
    const normalized = String(text || '').replace(/\r\n?/g, '\n');
    const rawSegments = normalized.split(/(?<=[。！？!?；;])|\n/).filter(Boolean);
    const chunks = [];
    let current = '';

    for (const raw of rawSegments) {
      const segment = raw;
      const candidates = splitLongSegment(segment, maxChars);
      for (const candidate of candidates) {
        if (!current) {
          current = candidate;
        } else if ((current + candidate).length <= maxChars) {
          current += candidate;
        } else {
          chunks.push(current);
          current = candidate;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.length ? chunks : [''];
  }

  function cleanupJoinedText(text, direction) {
    let output = String(text || '');
    output = output.replace(/\s+([,.;:!?，。；：！？])/g, '$1');
    output = output.replace(/([(\[{（【])\s+/g, '$1');
    output = output.replace(/\s{2,}/g, ' ');
    if (direction === 'en2zh') output = output.replace(/\s+([\u4e00-\u9fff])/g, '$1');
    return output.trim();
  }

  async function translateRawChunk(pipe, chunk, direction) {
    const result = await pipe(chunk, { max_new_tokens: 256 });
    return (result && result[0] && result[0].translation_text) || '';
  }

  async function translateChunked(pipe, text, direction, onStatus) {
    const chunks = buildChunks(text, MAX_CHUNK_CHARS);
    const translated = [];
    for (let index = 0; index < chunks.length; index++) {
      if (chunks.length > 1 && onStatus) onStatus('翻译中… ' + (index + 1) + '/' + chunks.length);
      translated.push(await translateRawChunk(pipe, chunks[index], direction));
    }
    return cleanupJoinedText(translated.join(direction === 'zh2en' ? ' ' : ''), direction);
  }

  function needsSpace(left, right, direction) {
    if (!left || !right || direction !== 'zh2en') return false;
    const leftChar = left[left.length - 1];
    const rightChar = right[0];
    if (/[A-Za-z0-9)>}\]]/.test(leftChar) && /[A-Za-z0-9(<\[{]/.test(rightChar)) return true;
    if (/[,.;:!?]/.test(leftChar) && /[A-Za-z0-9(<\[{]/.test(rightChar)) return true;
    return false;
  }

  function joinTranslatedParts(parts, direction) {
    let output = '';
    for (const raw of parts) {
      if (raw == null) continue;
      const value = String(raw).trim();
      if (!value) continue;
      if (!output) {
        output = value;
        continue;
      }
      output += needsSpace(output, value, direction) ? ' ' + value : value;
    }
    return cleanupJoinedText(output, direction);
  }

  function placeholderLabel(index) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = alphabet[index % alphabet.length];
    const cycle = Math.floor(index / alphabet.length);
    return letter + (cycle ? String(cycle + 1) : '');
  }

  function restorePlaceholders(text, direction, replacements) {
    let output = text;
    let missing = 0;
    for (const replacement of replacements) {
      const label = replacement.label;
      const patterns = direction === 'zh2en'
        ? [new RegExp('占位符\\s*' + label, 'gi'), new RegExp('place\\s*holder\\s*' + label, 'gi')]
        : [new RegExp('placeholder\\s*' + label, 'gi'), new RegExp('占位符\\s*' + label, 'gi')];
      let restored = false;
      for (const pattern of patterns) {
        const next = output.replace(pattern, replacement.target);
        if (next !== output) {
          output = next;
          restored = true;
          break;
        }
      }
      if (!restored) missing++;
    }
    return { text: output, missing };
  }

  async function translateSegmented(pipe, source, direction, matches, options) {
    const parts = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor) {
        parts.push(await translateChunked(pipe, source.slice(cursor, match.start), direction, options.onStatus));
      }
      parts.push(match.target);
      cursor = match.end;
    }
    if (cursor < source.length) {
      parts.push(await translateChunked(pipe, source.slice(cursor), direction, options.onStatus));
    }
    return joinTranslatedParts(parts, direction);
  }

  async function translateEnhanced(pipe, text, direction, options) {
    options = options || {};
    const source = String(text || '').trim();
    if (!source) return '';

    const matches = selectNonOverlapping([
      ...collectTermMatches(source, direction),
      ...collectCodeMatches(source)
    ]);
    if (!matches.length) return translateChunked(pipe, source, direction, options.onStatus);

    let protectedText = '';
    let cursor = 0;
    const replacements = [];
    matches.forEach((match, index) => {
      protectedText += source.slice(cursor, match.start);
      const label = placeholderLabel(index);
      const placeholder = direction === 'zh2en' ? '占位符' + label : 'placeholder ' + label;
      protectedText += placeholder;
      replacements.push({ label, target: match.target, placeholder });
      cursor = match.end;
    });
    protectedText += source.slice(cursor);

    const translated = await translateChunked(pipe, protectedText, direction, options.onStatus);
    const restored = restorePlaceholders(translated, direction, replacements);
    if (restored.missing) {
      // 少数模型会改写占位符；退回分段保护，优先保证代码和术语不丢失。
      return translateSegmented(pipe, source, direction, matches, options);
    }
    return restored.text;
  }

  async function run(text, options) {
    options = options || {};
    const direction = MODELS[options.dir] ? options.dir : 'zh2en';
    const pipeline = await getPipeline(direction, options.onStatus);
    if (options.enhanced === false) return translateChunked(pipeline, text, direction, options.onStatus);
    return translateEnhanced(pipeline, text, direction, options);
  }
  DKNeural.run = run;

  DKNeural._test = {
    buildChunks,
    collectCodeMatches,
    collectTermMatches,
    selectNonOverlapping,
    translateChunked,
    joinTranslatedParts,
    termPairs,
    cleanupJoinedText
  };

  window.DKNeural = DKNeural;
})();
