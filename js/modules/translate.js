/* 翻译工具：离线词典 + 术语高亮 + 神经整句翻译 + 可选内网接口 */
DK.registerTool({
  id: 'translate',
  name: '翻译',
  icon: '译',
  desc: '离线翻译（词典直译 + 神经整句）· 划词可用 · 支持内网接口',
  render(body) {
    const { h } = DK;
    const st = DKTranslate.dictStats ? DKTranslate.dictStats() : { total: DKTranslate.dictSize() };
    body.appendChild(h('div', { class: 'tip', html:
      '<b>离线词典</b>：共 <b>' + st.total.toLocaleString() + '</b> 个中文词条（团队精编 ' + st.curated + ' + 扩充词典）' +
      (st.pinyin ? '、拼音表 ' + st.pinyin + ' 字' : '') + '，内网断网可用。<br>' +
      '<b>智能翻译</b>=短词和术语走词典，整句自动走本地神经模型，并优先保护代码标识符、变量名和自定义术语；' +
      '<b>词典翻译</b>=逐词直译，可快速查看命中词条。本地神经模型为中英双向，' +
      '首次加载约 10-30 秒。未收录词可到「设置 → 自定义词库」补充。' }));

    const input = h('textarea', { class: 'ta', placeholder: '输入中文或英文…（支持整段粘贴）' });
    const dirLabel = h('span', { class: 'muted', text: '自动检测' });
    let forceDir = null;
    // 默认关闭：未收录的字保留中文，比拼音可读；命名转换模块另有拼音兜底
    const pinyinChk = h('input', { type: 'checkbox' });
    pinyinChk.addEventListener('change', () => render());

    const out = DK.resultBlock('译文', () => lastResult && lastResult.text);
    const termsBox = h('div', {});
    const noteBox = h('div', {});
    let lastResult = null;

    function detect(text) {
      return DKTranslate.CJK_RE.test(text) ? 'zh2en' : 'en2zh';
    }

    function render() {
      const text = input.value.trim();
      termsBox.innerHTML = '';
      noteBox.innerHTML = '';
      out.pre.textContent = '';
      if (!text) { dirLabel.textContent = '自动检测'; lastResult = null; return; }
      const dir = forceDir || detect(text);
      dirLabel.textContent = dir === 'zh2en' ? '中 → 英' : '英 → 中';
      const r = DKTranslate.translate(text, { pinyinFallback: pinyinChk.checked });
      lastResult = { dir, text: r.text };
      out.pre.textContent = r.text || '（无结果，可尝试添加自定义词库）';

      // 命中率与未收录词提示
      if (dir === 'zh2en' && r.zhTotal) {
        const pct = Math.round((r.coverage || 0) * 100);
        const uniq = [...new Set(r.missing || [])];
        if (uniq.length) {
          noteBox.appendChild(h('div', { class: 'tip', html:
            '词典命中 <b>' + pct + '%</b>（' + r.zhHit + '/' + r.zhTotal + ' 字）。未收录：<b>' +
            DK.esc(uniq.slice(0, 20).join('、')) + '</b>' + (uniq.length > 20 ? ' 等 ' + uniq.length + ' 处' : '') +
            '<br>提示：把未收录词按 <code>中文=英文</code> 格式加到「设置 → 自定义词库」，即可立刻出现在译文里。' }));
        } else {
          noteBox.appendChild(h('div', { class: 'tip', html: '词典命中 <b>100%</b>，全部词条已收录。' }));
        }
      }

      if (r.terms.length) {
        termsBox.appendChild(h('div', { class: 'result-block' }, [
          h('div', { class: 'result-head' }, [
            h('span', { text: '命中词条（' + r.terms.length + '）' }),
            h('button', { class: 'mini-btn', text: '复制', onclick: () => {
              DK.copy(r.terms.map(t => t.zh + ' → ' + t.en).join('\n')).then(() => DK.toast('已复制'));
            } })
          ]),
          h('div', { class: 'result-pre', style: { maxHeight: '180px' }, text:
            r.terms.map(t => t.zh + '  →  ' + t.en).join('\n') })
        ]));
      }
    }

    input.addEventListener('input', DK.debounce(render, 200));

    // ---- 内网接口翻译 ----
    async function apiTranslate() {
      const cfg = window.DKSessionApi || await DK.store.get('dkApi', null);
      if (!cfg || !cfg.url) { DK.toast('请先在「设置」中配置内网翻译接口', 'err'); return; }
      const text = input.value.trim();
      if (!text) return;
      const btn = apiBtn;
      btn.textContent = '请求中…'; btn.disabled = true;
      try {
        let resp;
        const q = encodeURIComponent(text);
        if ((cfg.method || 'GET').toUpperCase() === 'POST') {
          resp = await fetch(cfg.url, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.headers || {}),
            body: JSON.stringify({ [cfg.qParam || 'q']: text })
          });
        } else {
          resp = await fetch(cfg.url + (cfg.url.includes('?') ? '&' : '?') + (cfg.qParam || 'q') + '=' + q, {
            headers: cfg.headers || {}
          });
        }
        let data = await resp.text();
        try {
          const j = JSON.parse(data);
          let v = j;
          (cfg.respPath || 'data').split('.').filter(Boolean).forEach(k => { v = v == null ? v : v[k]; });
          data = typeof v === 'string' ? v : (v != null ? JSON.stringify(v, null, 2) : data);
        } catch (e) { /* 纯文本响应 */ }
        out.pre.textContent = data;
        dirLabel.textContent += ' · 接口';
        lastResult = { text: data };
      } catch (e) {
        DK.toast('接口请求失败：' + e.message, 'err');
      } finally { btn.textContent = '接口翻译'; btn.disabled = false; }
    }

    // ---- 神经翻译（本地 WASM 模型，Transformers.js + opus-mt 系列，完全离线）----
    // 双向：中→英用 opus-mt-zh-en，英→中用 opus-mt-en-zh；按输入是否含中文自动判定方向。
    // 优先走 Offscreen Document 常驻加载（避免面板弹窗关闭中断）；不可用时降级到本页面加载。
    const pipes = {};   // 方向 -> 本页面已加载 pipeline

    // 本页面加载（降级路径）
    async function getNeuralPipe(dir, onStatus) {
      if (pipes[dir]) return pipes[dir];
      pipes[dir] = await window.DKNeural.getPipeline(dir, onStatus);
      return pipes[dir];
    }

    // 后台 Offscreen 翻译：返回 Promise，进度通过消息回传
    function neuralOffscreen(text, dir, onStatus) {
      return new Promise((resolve, reject) => {
        const reqId = 'n' + Date.now() + Math.random().toString(36).slice(2, 7);
        let done = false;
        let timer = null;
        const cleanup = () => {
          chrome.runtime.onMessage.removeListener(onMsg);
          chrome.runtime.onMessage.removeListener(onProg);
          if (timer) clearTimeout(timer);
        };
        const onMsg = msg => {
          if (!msg || msg.type !== 'DK_NEURAL_DONE' || msg.reqId !== reqId) return;
          done = true; cleanup();
          if (msg.error) reject(new Error(msg.error)); else resolve(msg.text);
        };
        const onProg = msg => {
          if (!msg || msg.type !== 'DK_NEURAL_PROGRESS' || msg.reqId !== reqId) return;
          onStatus && onStatus(msg.status);
        };
        chrome.runtime.onMessage.addListener(onMsg);
        chrome.runtime.onMessage.addListener(onProg);
        timer = setTimeout(() => { if (!done) { cleanup(); reject(new Error('后台神经翻译超时')); } }, 180000);
        chrome.runtime.sendMessage({ type: 'DK_ENSURE_OFFSCREEN' }, resp => {
          if (!resp || !resp.ok) { cleanup(); reject(new Error('OFFSCREEN_UNAVAILABLE')); return; }
          chrome.runtime.sendMessage({ type: 'DK_NEURAL', text, dir, reqId }).catch(e => { cleanup(); reject(e); });
        });
      });
    }

    // 缺失模型/库时的可发现引导（H1）
    function showMissingAssets(missing) {
      const list = (missing || []).map(f => '<code>' + DK.esc(f) + '</code>').join('、');
      noteBox.innerHTML = '';
      noteBox.appendChild(h('div', { class: 'tip warn', html:
        '<b>神经翻译模型/库未就绪</b>（默认不进 git，需先下载）：' + list +
        '<br>请在项目根目录运行 <code>bash tools/download_models.sh</code> 下载模型与运行库，' +
        '然后回到本插件页面重新点击「神经翻译」。<br>' +
        '（词典翻译不受影响，可继续正常使用。）' }));
      DK.toast('神经翻译模型未下载', 'err');
    }

    function isMissingAssetsErr(e) {
      return e && (e.code === 'MISSING_ASSETS' || (e.message && e.message.indexOf('MISSING_ASSETS') === 0));
    }
    function missingFromErr(e) {
      const m = e && e.missing;
      if (Array.isArray(m)) return m;
      if (e && e.message) {
        const i = e.message.indexOf('MISSING_ASSETS:');
        if (i === 0) return e.message.slice('MISSING_ASSETS:'.length).split(',');
      }
      return [];
    }

    async function neuralTranslate() {
      const text = input.value.trim();
      if (!text) { DK.toast('请先输入要翻译的内容', 'err'); return; }
      // 自动判定方向：含中文 → 中→英（opus-mt-zh-en）；否则 → 英→中（opus-mt-en-zh）
      const dir = DKTranslate.CJK_RE.test(text) ? 'zh2en' : 'en2zh';
      const model = dir === 'en2zh' ? 'opus-mt-en-zh' : 'opus-mt-zh-en';
      const btn = neuralBtn;
      btn.disabled = true;
      btn.textContent = '加载中…';
      neuralStatus.textContent = '';
      const setStatus = s => { neuralStatus.textContent = s; };
      try {
        let trans;
        try {
          trans = await neuralOffscreen(text, dir, setStatus);   // 优先后台常驻
      } catch (e) {
        // 后台不可用或超时：降级到本页面加载（保证可用性，不硬失败）
        if (e && (e.message === 'OFFSCREEN_UNAVAILABLE' || /超时/.test(e.message))) {
            setStatus('后台不可用，改用本页面加载…');
            const pipe = await getNeuralPipe(dir, setStatus);  // 降级到本页面
            setStatus('翻译中…');
            const t0 = performance.now();
            const result = await pipe(text, { max_new_tokens: 256 });
            const ms = Math.round(performance.now() - t0);
            trans = (result && result[0] && result[0].translation_text) || '（无输出）';
            setStatus('本地神经模型 ' + model + '（' + ms + ' ms），完全离线');
          } else {
            throw e;
          }
        }
        out.pre.textContent = trans;
        dirLabel.textContent = (dir === 'en2zh' ? '英 → 中' : '中 → 英') + ' · 神经整句';
        lastResult = { dir, text: trans };
        noteBox.innerHTML = '';
        const protectedCount = (DKNeural._test && DKNeural._test.collectCodeMatches(text).length) || 0;
        noteBox.appendChild(h('div', { class: 'tip', html:
          '本地神经模型 ' + model + '，完全离线，不出浏览器。' +
          (protectedCount ? ' 已保护 <b>' + protectedCount + '</b> 个代码/标识符片段。' : '') }));
        termsBox.innerHTML = '';
        return true;
      } catch (e) {
        if (isMissingAssetsErr(e)) showMissingAssets(missingFromErr(e));
        else DK.toast('神经翻译失败：' + (e && e.message), 'err');
        return false;
      } finally { btn.textContent = '神经翻译'; btn.disabled = false; }
    }

    function isShortDictionaryInput(text) {
      const value = (text || '').trim();
      if (!value || /[。！？!?；;\n]/.test(value)) return false;
      const cjkCount = (value.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
      if (cjkCount && cjkCount <= 12 && !/[A-Za-z_]/.test(value)) return true;
      if (/^[A-Za-z][A-Za-z\s'-]{0,30}$/.test(value) && value.split(/\s+/).length <= 2) return true;
      return false;
    }

    async function smartTranslate() {
      const text = input.value.trim();
      if (!text) { DK.toast('请先输入要翻译的内容', 'err'); return; }
      if (isShortDictionaryInput(text)) {
        render();
        DK.toast('短术语已使用词典翻译');
        return;
      }
      const ok = await neuralTranslate();
      if (!ok) {
        render();
        noteBox.appendChild(h('div', { class: 'tip warn', text: '神经翻译不可用，已回退到词典翻译；该结果仅供快速参考。' }));
      }
    }

    let apiBtn, neuralBtn, neuralStatus;
    const row1 = h('div', { class: 'row' }, [
      h('button', { class: 'btn primary', text: '智能翻译', onclick: smartTranslate }),
      h('button', { class: 'btn', text: '词典翻译', onclick: render }),
      h('button', { class: 'btn', text: '中→英', onclick: e => { forceDir = 'zh2en'; render(); } }),
      h('button', { class: 'btn', text: '英→中', onclick: () => { forceDir = 'en2zh'; render(); } }),
      h('button', { class: 'btn', text: '自动', onclick: () => { forceDir = null; render(); } }),
      h('span', { class: 'muted', text: ' ' }, [dirLabel])
    ]);
    const row2 = h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: '清空', onclick: () => { input.value = ''; render(); input.focus(); } }),
      h('button', { class: 'btn', text: '读取页面选中文本', onclick: async () => {
        try {
          // 面板窗口的「当前窗口」是自己，因此要取最近聚焦的普通窗口里的活动标签
          let tab;
          try {
            const w = await chrome.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
            tab = (w.tabs || []).find(t => t.active) || (w.tabs || [])[0];
          } catch (e) { /* fallthrough */ }
          if (!tab) {
            const res = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            tab = res[0];
          }
          if (!tab) { DK.toast('没找到可读取的网页', 'err'); return; }
          const resp = await chrome.tabs.sendMessage(tab.id, { type: 'DK_GET_SELECTION' });
          if (resp && resp.text) { input.value = resp.text; render(); }
          else DK.toast('该页面没有选中文本', 'err');
        } catch (e) { DK.toast('无法读取（该页面不支持，如浏览器内置页）', 'err'); }
      } }),
      apiBtn = h('button', { class: 'btn', text: '接口翻译', title: '使用设置中配置的内网翻译接口', onclick: apiTranslate }),
      neuralBtn = h('button', { class: 'btn', text: '神经翻译', title: '本地 AI 模型整句翻译（中英双向，自动判定方向，完全离线，首次加载较慢）', onclick: neuralTranslate }),
      neuralStatus = h('span', { class: 'muted', style: { marginLeft: '8px', alignSelf: 'center', fontSize: '12px' } }),
      h('label', { class: 'chk-label', title: '未收录的词用拼音代替（变量命名场景更实用）' }, [pinyinChk, '未收录字用拼音'])
    ]);

    body.appendChild(row1);
    body.appendChild(input);
    body.appendChild(row2);
    body.appendChild(out.el);
    body.appendChild(noteBox);
    body.appendChild(h('div', { style: { height: '10px' } }));
    body.appendChild(termsBox);

    // ---- 词典速查 ----
    body.appendChild(h('div', { style: { margin: '14px 0 6px' }, class: 'muted', text: '词典速查（输入中文查所有英文说法）' }));
    const q = h('input', { class: 'ti', placeholder: '如：订单、用户、支付…' });
    const list = h('div', { class: 'cheat-grid', style: { marginTop: '8px' } });
    q.addEventListener('input', DK.debounce(() => {
      list.innerHTML = '';
      DKTranslate.suggestZh(q.value).forEach(item => {
        list.appendChild(h('div', { class: 'cheat-item', onclick: () => { DK.copy(item.en.split(',')[0]).then(() => DK.toast('已复制')); } }, [
          h('code', { text: item.en }),
          h('span', { class: 'd', text: item.zh })
        ]));
      });
    }, 150));
    body.appendChild(q);
    body.appendChild(list);
  }
});
