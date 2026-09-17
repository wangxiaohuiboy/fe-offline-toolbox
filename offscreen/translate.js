/* Offscreen Document 的翻译脚本：常驻加载神经模型，接收面板发来的翻译请求，
 * 通过 chrome.runtime 消息把进度与结果回传给面板。失败不影响面板内降级路径。 */
(function () {
  'use strict';
  if (!window.DKNeural) { console.error('[offscreen] neural.js 未加载'); return; }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'DK_NEURAL') return false;
    const reqId = msg.reqId;
    const progress = s => { try { chrome.runtime.sendMessage({ type: 'DK_NEURAL_PROGRESS', reqId, status: s }); } catch (e) {} };
    DKNeural.run(msg.text, { dir: msg.dir, onStatus: progress })
      .then(en => { try { chrome.runtime.sendMessage({ type: 'DK_NEURAL_DONE', reqId, text: en }); } catch (e) {} })
      .catch(e => { try { chrome.runtime.sendMessage({ type: 'DK_NEURAL_DONE', reqId, error: e && e.message }); } catch (e2) {} });
    return false; // 异步处理，不占用 sendResponse
  });
})();
