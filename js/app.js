/* 主控：侧栏渲染 / 工具路由 / 搜索 / 面板窗口与标签页适配 */
(function () {
  'use strict';

  /* ---------- 错误可见化：任何异常都显示出来，绝不静默空白 ---------- */
  function fatal(msg, detail) {
    let box = document.getElementById('dk-fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dk-fatal';
      box.className = 'tip warn';
      box.style.margin = '16px';
      document.body.appendChild(box);
    }
    box.innerHTML = '<b>插件页面出错</b>：' + String(msg) +
      (detail ? '<br><span style="color:var(--text2)">' + String(detail).slice(0, 400) + '</span>' : '') +
      '<br><span style="color:var(--text2)">请把这段信息截图反馈；通常点击 chrome://extensions 里的「重新加载」即可恢复。</span>';
  }
  window.addEventListener('error', e => fatal(e.message || '脚本错误', (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e => fatal('异步错误', e.reason && (e.reason.message || e.reason)));

  if (!window.DK || !window.DKTranslate) {
    fatal('核心脚本未加载成功', '请确认 js/ 目录文件完整，并在 chrome://extensions 中重新加载插件');
    return;
  }

  const { $, h } = DK;

  // 布局模式：窗口宽度决定（面板窗口 920px / 标签页更宽均为全屏布局）
  const narrow = () => window.innerWidth <= 820;
  function applyLayoutClass() {
    document.body.classList.toggle('popup', narrow());
    document.body.classList.toggle('fullpage', !narrow());
  }
  applyLayoutClass();
  window.addEventListener('resize', applyLayoutClass);

  let active = null;

  function buildNav(filter) {
    const nav = $('#nav');
    if (!nav) return;
    nav.innerHTML = '';
    const f = (filter || '').trim().toLowerCase();
    (DK.tools || []).forEach(tool => {
      if (f && !(tool.name + (tool.desc || '') + tool.id).toLowerCase().includes(f)) return;
      const item = h('div', { class: 'nav-item' + (active === tool.id ? ' active' : ''), onclick: () => show(tool.id) }, [
        h('span', { class: 'ico', text: tool.icon }),
        h('span', { text: tool.name })
      ]);
      nav.appendChild(item);
    });
  }

  function show(id) {
    const tool = (DK.tools || []).find(t => t.id === id);
    if (!tool) return;
    active = id;
    DK.store.set('dkLastTool', id);
    $('#tool-name').textContent = tool.name;
    $('#tool-desc').textContent = tool.desc || '';
    const body = $('#tool-body');
    body.innerHTML = '';
    try { tool.render(body); } catch (e) {
      body.appendChild(h('div', { class: 'tip warn', text: '「' + tool.name + '」渲染失败：' + e.message }));
    }
    buildNav($('#search').value);
    body.scrollTop = 0;
  }

  const search = $('#search');
  if (search) {
    search.addEventListener('input', DK.debounce(e => buildNav(e.target.value), 120));
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = $('.nav-item');
        if (first) first.click();
      }
    });
  }

  /* 底部按钮：面板窗口（≤1100px）→ 切到标签页；标签页 → 提示已是完整版 */
  const openBtn = $('#open-tab');
  const inPanel = () => window.innerWidth <= 1100;
  function syncOpenBtn() {
    if (inPanel()) {
      openBtn.textContent = '⤢ 在标签页中打开';
      openBtn.title = '在浏览器标签页中以大屏方式打开';
    } else {
      openBtn.textContent = '✓ 已在标签页模式';
      openBtn.title = '当前已是标签页/大屏模式';
    }
  }
  syncOpenBtn();
  window.addEventListener('resize', syncOpenBtn);
  openBtn.onclick = () => {
    if (!inPanel()) { DK.toast('当前已是完整大屏模式'); return; }
    try {
      chrome.runtime.sendMessage({ type: 'DK_OPEN_TAB' }, () => {
        // 面板窗口打开标签页后自动收起
        setTimeout(() => { try { window.close(); } catch (e) {} }, 400);
      });
    } catch (e) { window.open(location.href, '_blank'); }
  };

  /* ---------- 初始化 ---------- */
  (async function init() {
    try {
      const settings = (DK.tools || []).find(t => t.id === 'settings');
      if (settings && settings.preload) {
        try { await settings.preload(); } catch (e) { /* 词库加载失败不阻塞主流程 */ }
      }
      const last = await DK.store.get('dkLastTool', null);
      const first = (DK.tools || [])[0];
      if (!first) { fatal('没有注册任何工具模块'); return; }
      show((DK.tools || []).some(t => t.id === last) ? last : first.id);
      if (search) setTimeout(() => { try { search.focus(); } catch (e) {} }, 60);
    } catch (e) {
      fatal(e.message, e.stack);
    }
  })();
})();
