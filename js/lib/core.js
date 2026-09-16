/* 公共工具库：DOM/存储/剪贴板/下载/提示。零外部依赖。 */
(function () {
  'use strict';
  const DK = {};
  const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  DK.$ = (sel, root) => (root || document).querySelector(sel);
  DK.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  DK.esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  DK.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  DK.store = {
    async get(key, dft) {
      try {
        if (isExt) {
          const o = await chrome.storage.local.get(key);
          return o[key] !== undefined ? o[key] : dft;
        }
        const v = localStorage.getItem('dk_' + key);
        return v === null ? dft : JSON.parse(v);
      } catch (e) { return dft; }
    },
    async set(key, val) {
      try {
        if (isExt) return void (await chrome.storage.local.set({ [key]: val }));
        localStorage.setItem('dk_' + key, JSON.stringify(val));
      } catch (e) { /* ignore */ }
    }
  };

  DK.copy = async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e2) { return false; }
    }
  };

  DK.download = function (name, content, mime) {
    const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  DK.toast = function (msg, type) {
    let box = document.getElementById('dk-toast-box');
    if (!box) { box = document.createElement('div'); box.id = 'dk-toast-box'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'dk-toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  };

  // 带复制按钮的结果输出块
  DK.resultBlock = function (title, getContent) {
    const wrap = document.createElement('div');
    wrap.className = 'result-block';
    const head = document.createElement('div');
    head.className = 'result-head';
    const span = document.createElement('span');
    span.textContent = title;
    const btns = document.createElement('div');
    btns.className = 'result-btns';
    const cp = document.createElement('button');
    cp.className = 'mini-btn'; cp.textContent = '复制';
    cp.onclick = async () => {
      const v = typeof getContent === 'function' ? getContent() : getContent();
      if (v == null) return;
      (await DK.copy(v)) ? DK.toast('已复制') : DK.toast('复制失败', 'err');
    };
    btns.appendChild(cp);
    head.appendChild(span); head.appendChild(btns);
    const pre = document.createElement('pre');
    pre.className = 'result-pre';
    const sync = v => { pre.textContent = typeof getContent === 'function' ? getContent() : getContent(); };
    wrap.appendChild(head); wrap.appendChild(pre);
    return { el: wrap, pre, refresh: sync };
  };

  // 极简 DOM 构建: h('div', {class:'x', onclick:fn, text:'hi', html:'<b>'}, [children])
  DK.h = function (tag, props, children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
        else el.setAttribute(k, v);
      }
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };

  // 工具面板通用: 输入区 + 按钮行 + 输出区
  DK.registerTool = function (tool) { (DK.tools = DK.tools || []).push(tool); };

  window.DK = DK;
})();
