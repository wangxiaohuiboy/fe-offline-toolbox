/* 划词翻译：选中文字后出现浮动按钮，点击展示离线词典翻译卡片。 */
(function () {
  'use strict';
  if (window.__dkContentReady) return;
  window.__dkContentReady = true;

  let enabled = true;
  let floatBtn = null, card = null;
  let lastRect = null, lastText = '';

  /* 词典数据按需加载：默认只注入精编词典（体积小），
   * 首次真正翻译时才动态载入扩充词典与拼音表，避免拖慢每个网页。 */
  let dataReady = null;
  function ensureData() {
    if (dataReady) return dataReady;
    dataReady = (async () => {
      const load = async f => { try { await import(chrome.runtime.getURL(f)); } catch (e) { /* 忽略，退化为精编词典 */ } };
      await load('js/lib/pinyin.data.js');
      await load('js/lib/dict.big.js');
      try { if (window.DKTranslate && window.DKTranslate.loadBig) window.DKTranslate.loadBig(); } catch (e) {}
    })();
    return dataReady;
  }
  // 注：不在此处 eager 加载大词典——改为用户首次划词/右键翻译时才按需加载（见 CODE_REVIEW M2），
  // 避免每个网页都常驻 1.7MB 词典占用内存。

  function loadCfg() {
    try {
      chrome.storage.local.get(['dkFloatEnabled'], o => {
        enabled = o.dkFloatEnabled !== false;
      });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'local' && 'dkFloatEnabled' in ch) enabled = ch.dkFloatEnabled.newValue !== false;
      });
    } catch (e) { /* ignore */ }
  }
  loadCfg();

  function mk(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function showFloatBtn(x, y, text) {
    hideFloatBtn();
    lastText = text;
    floatBtn = mk('div', 'dk-float-btn', '译');
    floatBtn.style.left = Math.min(x, window.innerWidth - 40) + 'px';
    floatBtn.style.top = Math.min(y + 10, window.innerHeight - 40) + 'px';
    floatBtn.title = '离线翻译';
    floatBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    floatBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ensureData().then(() => showCard(text, lastRect)); });
    document.documentElement.appendChild(floatBtn);
  }

  function hideFloatBtn() { if (floatBtn) { floatBtn.remove(); floatBtn = null; } }

  function closeCard() { if (card) { card.remove(); card = null; } }

  function showCard(text, rect) {
    closeCard();
    const r = window.DKTranslate.translate(text);
    card = mk('div', 'dk-card');
    const head = mk('div', 'dk-card-head');
    head.appendChild(mk('span', 'dk-card-title', r.dir === 'zh2en' ? '中 → 英（离线词典）' : '英 → 中（离线词典）'));
    const close = mk('button', 'dk-card-close', '×');
    close.onclick = closeCard;
    head.appendChild(close);
    card.appendChild(head);

    const main = mk('div', 'dk-card-main', r.text || '（无结果）');
    card.appendChild(main);

    if (r.coverage != null && r.coverage < 1 && r.zhTotal) {
      const miss = (r.missing || []).slice(0, 10).join('、');
      card.appendChild(mk('div', 'dk-card-note', '词典命中 ' + r.zhHit + '/' + r.zhTotal + ' 字' + (miss ? '，未收录：' + miss : '') + '（可在「设置 → 自定义词库」补充）'));
    }

    if (r.terms && r.terms.length) {
      const list = mk('div', 'dk-card-terms');
      const title = mk('div', 'dk-terms-title', '命中词条 ' + r.terms.length);
      list.appendChild(title);
      r.terms.slice(0, 12).forEach(t => {
        const row = mk('div', 'dk-term-row');
        row.appendChild(mk('span', 'dk-term-zh', t.zh));
        row.appendChild(mk('span', 'dk-term-en', t.en));
        list.appendChild(row);
      });
      card.appendChild(list);
    }

    const foot = mk('div', 'dk-card-foot');
    const copyBtn = mk('button', 'dk-card-btn', '复制译文');
    copyBtn.onclick = () => {
      try { navigator.clipboard.writeText(r.text); copyBtn.textContent = '已复制'; setTimeout(() => copyBtn.textContent = '复制译文', 1200); } catch (e) {}
    };
    foot.appendChild(copyBtn);
    const toolboxBtn = mk('button', 'dk-card-btn dk-card-btn-primary', '打开工具箱');
    toolboxBtn.onclick = () => { try { chrome.runtime.sendMessage({ type: 'DK_OPEN_TAB' }); } catch (e) {} };
    foot.appendChild(toolboxBtn);
    card.appendChild(foot);

    document.documentElement.appendChild(card);
    // 定位：优先选区下方
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = 0, top = 0;
    if (rect) {
      left = Math.min(rect.left, vw - 340);
      top = rect.bottom + window.scrollY + 8;
      if (rect.bottom + 220 > vh + window.scrollY) top = rect.top + window.scrollY - 226;
    } else { left = (vw - 320) / 2; top = window.scrollY + 80; }
    left = Math.max(8, left);
    card.style.left = left + 'px';
    card.style.top = Math.max(8, top) + 'px';
  }

  document.addEventListener('mouseup', e => {
    if (!enabled) return;
    if (floatBtn && floatBtn.contains(e.target)) return;
    if (card && card.contains(e.target)) return;
    hideFloatBtn();
    const sel = window.getSelection();
    const text = sel ? String(sel).trim() : '';
    if (!text || text.length > 200) { if (card && !card.contains(e.target)) closeCard(); return; }
    let rect = null;
    try { rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null; } catch (err) {}
    if (rect && (rect.width || rect.height)) lastRect = rect;
    // 只在文本元素内触发，避免按钮/输入框误触
    const node = sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (el && /INPUT|TEXTAREA/.test(el.tagName)) return;
    showFloatBtn(e.clientX, e.clientY, text);
  }, true);

  document.addEventListener('mousedown', e => {
    if (card && !card.contains(e.target) && (!floatBtn || !floatBtn.contains(e.target))) closeCard();
  }, true);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCard(); hideFloatBtn(); } });

  // 右键菜单请求 + 弹窗读取选中文本
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'DK_TRANSLATE' && msg.text) ensureData().then(() => showCard(msg.text, lastRect));
      if (msg && msg.type === 'DK_GET_SELECTION') {
        const sel = window.getSelection();
        sendResponse({ text: sel ? String(sel).trim() : '' });
      }
      return false;
    });
  } catch (e) { /* ignore */ }
})();
