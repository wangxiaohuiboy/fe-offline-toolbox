/* 离线翻译引擎：词典构建 + 分词 + 双向查词/翻译。
 * 被 popup 与内容脚本共用，零外部依赖。 */
(function () {
  'use strict';

  const DICT = new Map();     // zh -> [en...]
  const REDGE = new Map();    // en(word/phrase) -> zh
  const REDGE_PRI = new Map();// en -> 命中的英文在词条里的位次（越小越权威）
  const REDGE_LOCK = new Set(); // 精编词典已注册的英文词：扩充词典不得覆盖（防止机翻噪声抢注，如 加下标次序=is）
  let PHRASES = [];           // 多词英文短语（用于 en->zh 贪婪匹配）
  let MAX_ZH_LEN = 1;

  function addEntry(zh, ens, hard) {
    zh = zh.trim();
    if (!zh) return;
    const list = ens.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) return;
    if (!DICT.has(zh)) DICT.set(zh, list);
    list.forEach((en, i) => {
      if (en === '~') return;                 // ~ 表示结构词，翻译时省略
      const k = en.toLowerCase();
      if (hard) {                             // 精编词典：绝对优先（锁定，扩充词典不得覆盖），内部按位次先到先得
        const pri0 = REDGE_PRI.has(k) ? REDGE_PRI.get(k) : 99;
        if (!REDGE_LOCK.has(k) || i < pri0) { REDGE.set(k, zh); REDGE_PRI.set(k, i); REDGE_LOCK.add(k); }
      } else if (!REDGE_LOCK.has(k)) {        // 扩充词典：位次更靠前才覆盖（同一批内）
        const pri = REDGE_PRI.has(k) ? REDGE_PRI.get(k) : 99;
        if (!REDGE.has(k) || i < pri) { REDGE.set(k, zh); REDGE_PRI.set(k, i); }
      }
      if (/\s/.test(k) && !PHRASES.includes(k)) PHRASES.push(k);
    });
    if (zh.length > MAX_ZH_LEN) MAX_ZH_LEN = zh.length;
  }

  function parseRaw(raw, hard) {
    if (!raw) return 0;
    let n = 0;
    raw.split(/\n+/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const i = line.indexOf('=');
      if (i < 1) return;
      addEntry(line.slice(0, i), line.slice(i + 1), hard);
      n++;
    });
    return n;
  }

  // ---- 加载词典：团队精编词典优先（并锁定反查），扩充词典兜底 ----
  let bigLoaded = false;
  function loadBuiltin() { parseRaw((typeof window !== 'undefined' && window.DK_DICT_RAW) || '', true); }
  function loadBig() {
    if (bigLoaded) return 0;
    const raw = (typeof window !== 'undefined' && window.DK_DICT_BIG) || '';
    if (!raw) return 0;
    bigLoaded = true;
    return parseRaw(raw, false);
  }
  const builtinCount = (function () { loadBuiltin(); return DICT.size; })();
  loadBig();


  // ---- 拼音（数据可能延迟加载，缺失时返回空表，加载后自动重建）----
  let PY = null;
  function buildPinyin() {
    const chars = window.DK_PINYIN_CHARS || '';
    if (!chars) { PY = PY || new Map(); return PY; }
    if (PY && PY.size) return PY;
    PY = new Map();
    const data = (window.DK_PINYIN_DATA || '').split(',');
    for (let i = 0; i < chars.length; i++) {
      if (data[i]) PY.set(chars[i], data[i]);
    }
    return PY;
  }
  function toPinyin(text) {
    const py = buildPinyin();
    return text.split('').map(c => py.get(c) || '').filter(Boolean);
  }

  // ---- 自定义词库 ----
  const custom = { zh: new Map(), en: new Map() };
  function setCustomDict(lines) {
    custom.zh.clear(); custom.en.clear();
    (lines || '').split(/\n+/).forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const i = line.indexOf('=');
      if (i < 1) return;
      const zh = line.slice(0, i).trim();
      const ens = line.slice(i + 1).split(',').map(s => s.trim()).filter(Boolean);
      if (!ens.length) return;
      custom.zh.set(zh, ens);
      ens.forEach(en => custom.en.set(en.toLowerCase(), zh));
    });
  }

  function getCustomEntries() {
    return [...custom.zh.entries()].map(([zh, englishList]) => ({ zh, en: englishList[0] || '' })).filter(entry => entry.zh && entry.en);
  }

  function lookupZh(word) {
    return custom.zh.get(word) || DICT.get(word) || null;
  }
  function lookupEn(word) {
    const k = word.toLowerCase();
    return custom.en.get(k) || REDGE.get(k) || null;
  }

  const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

  // 在 text 的 pos 处找最长词典匹配，返回长度（0=无匹配）
  function longestMatch(text, pos) {
    const maxLen = Math.min(8, text.length - pos);
    for (let len = maxLen; len >= 1; len--) {
      const seg = text.slice(pos, pos + len);
      if (custom.zh.has(seg) || DICT.has(seg)) return len;
    }
    return 0;
  }

  // ---- 中->英：贪婪最长匹配分词 ----
  function segmentZh(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/[a-zA-Z0-9]/.test(ch)) {
        let j = i;
        while (j < text.length && /[a-zA-Z0-9._-]/.test(text[j])) j++;
        tokens.push({ type: 'ascii', text: text.slice(i, j) });
        i = j;
        continue;
      }
      if (/[\s]/.test(ch)) { tokens.push({ type: 'space', text: ch }); i++; continue; }
      if (!CJK_RE.test(ch)) { tokens.push({ type: 'punct', text: ch }); i++; continue; }

      let len = longestMatch(text, i);
      // 轻量前瞻：若当前只匹配到 2 字，但后一字起能匹配 ≥3 字，说明当前切法吞掉了更长的词
      // （如「转变量名」不应切成「转变」+「量名」，而应「转」+「变量名」）
      if (len === 2) {
        const alt = longestMatch(text, i + 1);
        if (alt >= 3) len = 1;
      }
      if (len > 0) {
        const seg = text.slice(i, i + len);
        // 前瞻强制切成单字时，该字可能并无词条 → 退回拼音/未收录
        if (len === 1 && !(custom.zh.has(seg) || DICT.has(seg))) {
          const py1 = buildPinyin().get(seg);
          tokens.push(py1 ? { type: 'py', text: seg, py: py1 } : { type: 'unk', text: seg });
        } else {
          tokens.push({ type: 'zh', text: seg });
        }
        i += len;
        continue;
      }
      // 单字未命中 -> 拼音（可用时）
      const py = buildPinyin().get(ch);
      tokens.push(py ? { type: 'py', text: ch, py } : { type: 'unk', text: ch });
      i += 1;
    }
    return tokens;
  }

  function tokensToEnglish(tokens, opts) {
    opts = opts || {};
    const words = [];
    const terms = [];
    const missing = [];
    let started = false;
    let zhTotal = 0, zhHit = 0;
    for (const t of tokens) {
      if (t.type === 'space') { if (words.length && started) words.push(' '); continue; }
      started = true;
      if (t.type === 'ascii') { words.push(t.text); continue; }
      if (t.type === 'punct') { words.push(t.text); continue; }
      if (t.type === 'zh') {
        zhTotal += t.text.length;
        const ens = lookupZh(t.text) || [];
        const en = ens[0] || '';
        if (!en) {                       // 兜底：词条意外缺失时按未收录处理，避免输出空串
          words.push(t.text);
          missing.push(t.text);
          terms.push({ zh: t.text, en: '未收录' });
          continue;
        }
        zhHit += t.text.length;
        if (en === '~') { terms.push({ zh: t.text, en: '（结构词，省略）' }); continue; }
        terms.push({ zh: t.text, en: ens.join(' / ') });
        words.push(en);
        continue;
      }
      if (t.type === 'py') {
        zhTotal += t.text.length;
        if (opts.pinyinFallback) { words.push(t.py); terms.push({ zh: t.text, en: t.py + '（拼音）' }); }
        else { words.push(t.text); missing.push(t.text); terms.push({ zh: t.text, en: '未收录' }); }
        continue;
      }
      if (t.type === 'unk') {
        zhTotal += t.text.length;
        words.push(t.text);
        missing.push(t.text);
        terms.push({ zh: t.text, en: '未收录' });
      }
    }
    let out = words.join(' ').replace(/\s+([,.!?;:)])/g, '$1')
      .replace(/([(.])\s+/g, '$1').replace(/\s{2,}/g, ' ').trim();
    return {
      text: out, terms, missing,
      coverage: zhTotal ? zhHit / zhTotal : 1,
      zhTotal, zhHit
    };
  }

  function singularHit(word) {
    const k = word.toLowerCase();
    if (lookupEn(k)) return k;
    if (k.endsWith('ies') && k.length > 4 && lookupEn(k.slice(0, -3) + 'y')) return k.slice(0, -3) + 'y';
    if (k.endsWith('es') && lookupEn(k.slice(0, -2))) return k.slice(0, -2);
    if (k.endsWith('s') && lookupEn(k.slice(0, -1))) return k.slice(0, -1);
    if (k.endsWith('ing') && lookupEn(k.slice(0, -3))) return k.slice(0, -3);
    if (k.endsWith('ing') && k.length > 5 && lookupEn(k.slice(0, -3) + 'e')) return k.slice(0, -3) + 'e';
    if (k.endsWith('ed') && lookupEn(k.slice(0, -2))) return k.slice(0, -2);
    if (k.endsWith('ed') && k.length > 4 && lookupEn(k.slice(0, -1))) return k.slice(0, -1);
    return null;
  }

  // ---- 英->中：先切成词序列，再贪婪匹配多词短语 ----
  const MAX_EN_PHRASE = 5;   // 最多 5 词短语，如 "thanks for your hard work"
  const EN_STOP = new Set(['the', 'a', 'an', 'to', 'of']);  // 冠词/不定式 to/所属 of：单词直译时省略（短语匹配不受影响）
  function translateEnToZh(text) {
    const terms = [];
    const parts = [];
    // 词元化：word | other（空格等）
    const toks = [];
    let i = 0;
    while (i < text.length) {
      if (/[a-zA-Z]/.test(text[i])) {
        let j = i;
        while (j < text.length && /[a-zA-Z0-9'-]/.test(text[j])) j++;
        toks.push({ w: text.slice(i, j) });
        i = j;
      } else { toks.push({ o: text[i] }); i++; }
    }
    const isBlank = t => t.o !== undefined && /\s/.test(t.o);
    let p = 0;
    while (p < toks.length) {
      const t = toks[p];
      if (!t.w) { parts.push(t.o); p++; continue; }
      // 收集从 p 开始连续的词 token（中间只允许空白，标点会截断短语）
      const run = [];
      let q = p;
      while (run.length < MAX_EN_PHRASE && q < toks.length) {
        if (toks[q].w) { run.push(q); q++; }
        else if (isBlank(toks[q])) { q++; }
        else break;
      }
      // 贪婪：从最长短语到单词
      let hit = null, matchedSrc = null, advanceTo = p + 1;
      for (let n = run.length; n >= 2; n--) {
        const key = run.slice(0, n).map(ix => toks[ix].w).join(' ').toLowerCase();
        const lu = lookupEn(key);
        if (lu) {
          hit = lu;
          matchedSrc = run.slice(0, n).map(ix => toks[ix].w).join(' ');
          advanceTo = run[n - 1] + 1;   // 跳过短语及其间的空白
          break;
        }
      }
      if (!hit) {
        const wl = t.w.toLowerCase();
        if (EN_STOP.has(wl)) { p++; continue; }   // 冠词/不定式 to：省略不译
        const stem = singularHit(t.w);
        if (stem) { hit = lookupEn(stem); matchedSrc = t.w; }
      }
      if (hit) {
        terms.push({ zh: hit, en: matchedSrc });
        parts.push(hit);
      } else {
        terms.push({ zh: t.w, en: t.w + '（无匹配）' });
        parts.push(t.w);
      }
      p = advanceTo;
    }
    // 中文词之间的空格去掉，英文与中文间保留；句首句尾去空白
    const outText = parts.join('')
      .replace(/(?<=[\u3400-\u4dbf\u4e00-\u9fff])\s+(?=[\u3400-\u4dbf\u4e00-\u9fff])/g, '')
      .replace(/\s{2,}/g, ' ').trim();
    return { text: outText, terms };
  }

  // ---- 对外主入口 ----
  function translate(text, opts) {
    opts = opts || {};
    loadBig();   // 数据若延迟加载，这里补一次
    text = (text || '').trim();
    if (!text) return { dir: 'none', text: '', terms: [], missing: [], coverage: 1 };
    const hasCJK = CJK_RE.test(text);
    if (hasCJK) {
      const tokens = segmentZh(text);
      const r = tokensToEnglish(tokens, opts);
      return { dir: 'zh2en', text: r.text, terms: r.terms, missing: r.missing, coverage: r.coverage, zhTotal: r.zhTotal, zhHit: r.zhHit };
    }
    const r = translateEnToZh(text);
    return { dir: 'en2zh', text: r.text, terms: r.terms, missing: [], coverage: 1 };
  }

  // 供命名转换使用：中文 -> 英文单词数组（含拼音兜底）
  function zhToWords(text) {
    const tokens = segmentZh(text);
    const words = [];
    for (const t of tokens) {
      if (t.type === 'zh') {
        const en = (lookupZh(t.text) || [])[0];
        if (en === '~') continue;                       // 结构词不参与命名
        if (en) { en.split(/[\s/-]+/).forEach(w => w && words.push(w)); continue; }
      }
      if (t.type === 'ascii') { t.text.split(/[\s._/-]+/).forEach(w => w && words.push(w)); continue; }
      if (t.type === 'py') { words.push(t.py); continue; }
    }
    return words;
  }

  function dictSize() { return DICT.size; }
  function dictStats() {
    return { total: DICT.size, curated: builtinCount, bigLoaded, pinyin: buildPinyin().size };
  }
  // 首字分桶索引：把 7.6 万词条的线性扫描降到首字桶内，避免每次按键全量扫描（见 CODE_REVIEW M1）
  const PREFIX_INDEX = new Map();   // 首字 -> [zh 键]
  let indexSize = -1;
  function buildIndex() {
    if (indexSize === DICT.size) return;   // 词典扩容后自动重建
    PREFIX_INDEX.clear();
    for (const k of DICT.keys()) {
      const c = k.charAt(0);
      let arr = PREFIX_INDEX.get(c);
      if (!arr) { arr = []; PREFIX_INDEX.set(c, arr); }
      arr.push(k);
    }
    indexSize = DICT.size;
  }
  function suggestZh(prefix) {
    const out = [];
    prefix = prefix.trim();
    if (!prefix) return out;
    buildIndex();
    const bucket = PREFIX_INDEX.get(prefix.charAt(0));
    const pool = bucket || DICT.keys();
    for (const k of pool) {
      if (k.startsWith(prefix) || k.includes(prefix)) { out.push({ zh: k, en: DICT.get(k).join(', ') }); if (out.length >= 30) break; }
    }
    return out;
  }

  window.DKTranslate = {
    translate, zhToWords, toPinyin, lookupZh, lookupEn, setCustomDict, getCustomEntries,
    dictSize, dictStats, suggestZh, CJK_RE,
    loadBig, loadBigDict: loadBig
  };
})();
