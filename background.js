/* 后台 Service Worker：点击图标弹出面板窗口 + 右键菜单 + 快捷键。零网络依赖。 */

const PANEL_URL = chrome.runtime.getURL('app.html');
const PANEL_W = 920;
const PANEL_H = 680;

/* ---------- 面板窗口：点击扩展图标时打开（已开则聚焦） ---------- */
async function openPanel() {
  try {
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['popup', 'normal'] });
    for (const w of wins) {
      if ((w.tabs || []).some(t => (t.url || '').split('?')[0] === PANEL_URL)) {
        await chrome.windows.update(w.id, { focused: true, drawAttention: true });
        return;
      }
    }
  } catch (e) { /* ignore */ }

  let left, top;
  try {
    const cur = await chrome.windows.getLastFocused();
    const cw = cur.width || 1280, ch = cur.height || 800;
    left = Math.max(0, Math.round((cur.left || 0) + (cw - PANEL_W) / 2));
    top = Math.max(0, Math.round((cur.top || 0) + Math.min(80, (ch - PANEL_H) / 3)));
  } catch (e) { /* 用系统默认位置 */ }

  chrome.windows.create({
    url: PANEL_URL,
    type: 'popup',
    width: PANEL_W,
    height: PANEL_H,
    left,
    top,
    focused: true
  });
}

/* 在标签页中打开完整版（复用已存在的标签页） */
async function openInTab() {
  const tabs = await chrome.tabs.query({ url: PANEL_URL + '*' });
  if (tabs.length) {
    chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: PANEL_URL });
  }
}

/* ---------- 点击图标 ---------- */
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => openPanel());
}

/* ---------- 右键菜单 ---------- */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'dk-translate-selection',
      title: '离线翻译「%s」',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dk-open-panel',
      title: '打开快捷面板（同点击图标）',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'dk-open-toolbox',
      title: '在标签页中打开完整工具箱',
      contexts: ['action']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'dk-open-panel') return openPanel();
  if (info.menuItemId === 'dk-open-toolbox') return openInTab();
  if (info.menuItemId === 'dk-translate-selection' && tab && tab.id != null) {
    const payload = { type: 'DK_TRANSLATE', text: (info.selectionText || '').trim() };
    try {
      await chrome.tabs.sendMessage(tab.id, payload);
    } catch (e) {
      // 内容脚本未注入时（如刚安装），尝试按需注入
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['js/lib/pinyin.data.js', 'js/lib/dict.data.js', 'js/lib/translate-core.js', 'content/content.js']
        });
        await chrome.tabs.sendMessage(tab.id, payload);
      } catch (e2) { /* 某些系统页面无法注入，忽略 */ }
    }
  }
});

/* ---------- 快捷键 ---------- */
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === 'open-toolbox') openInTab();
});

/* ---------- 来自页面的请求 ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;
  if (msg.type === 'DK_OPEN_TAB') { openInTab(); sendResponse({ ok: true }); }
  if (msg.type === 'DK_OPEN_PANEL') { openPanel(); sendResponse({ ok: true }); }
  return false;
});
