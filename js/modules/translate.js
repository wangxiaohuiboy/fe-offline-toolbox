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
      '<b>词典翻译</b>=逐词直译（术语准）；<b>神经翻译</b>=本地 AI 模型整句翻译（语句更自然，中→英，首次加载模型约 10-30 秒）。' +
      '未收录词可到「设置 → 自定义词库」补充。' }));

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
      const cfg = await DK.store.get('dkApi', null);
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

    // ---- 神经翻译（本地 WASM 模型，Transformers.js + opus-mt-zh-en，完全离线）----
    let neuralPipe = null;
    let neuralLoading = false;
    async function getNeuralPipe(onStatus) {
      if (neuralPipe) return neuralPipe;
      if (neuralLoading) throw new Error('模型加载中，请稍候…');
      neuralLoading = true;
      try {
        const isExt = location.protocol === 'chrome-extension:';
        // 注意：v4 的本地存在性检查会拒绝 http(s) 开头的 localModelPath（防盗链设计），
        // 因此网页环境用相对路径、扩展环境用 chrome-extension:// 绝对路径
        const modelBase = isExt ? chrome.runtime.getURL('models/') : 'models/';
        const ortBase = isExt ? chrome.runtime.getURL('js/lib/ort/') : new URL('js/lib/ort/', location.href).href;
        // 动态 import 的相对路径以「当前模块文件」为基准，必须转成绝对 URL
        const tfUrl = isExt ? chrome.runtime.getURL('js/lib/transformers/transformers.min.js')
                            : new URL('js/lib/transformers/transformers.min.js', location.href).href;
        const mod = await import(tfUrl);
        mod.env.allowLocalModels = true;
        mod.env.allowRemoteModels = false;
        mod.env.localModelPath = modelBase;
        mod.env.backends.onnx.wasm.wasmPaths = ortBase;
        mod.env.backends.onnx.wasm.numThreads = 1;   // 扩展页无 SharedArrayBuffer，用单线程
        onStatus('模型加载中…（首次约 10-30 秒）');
        neuralPipe = await mod.pipeline('translation', 'opus-mt-zh-en', {
          dtype: 'q8', device: 'wasm',
          progress_callback: p => {
            if (p && p.status === 'progress' && p.total) {
              onStatus('加载模型… ' + Math.round(p.loaded / p.total * 100) + '%（' + p.file.split('/').pop() + '）');
            } else if (p && p.status) {
              onStatus('模型加载：' + p.status);
            }
          }
        });
        return neuralPipe;
      } finally { neuralLoading = false; }
    }

    async function neuralTranslate() {
      const text = input.value.trim();
      if (!text) { DK.toast('请先输入要翻译的内容', 'err'); return; }
      if (!DKTranslate.CJK_RE.test(text)) {
        DK.toast('神经模型为 中→英 方向；英文请用「翻译」按钮（词典直译）', 'err');
        return;
      }
      const btn = neuralBtn;
      btn.disabled = true;
      try {
        const pipe = await getNeuralPipe(s => { btn.textContent = s.slice(0, 22); });
        btn.textContent = '翻译中…';
        const t0 = performance.now();
        const result = await pipe(text, { max_new_tokens: 256 });
        const ms = Math.round(performance.now() - t0);
        const en = (result && result[0] && result[0].translation_text) || '（无输出）';
        out.pre.textContent = en;
        dirLabel.textContent = '中 → 英 · 神经整句';
        lastResult = { dir: 'zh2en', text: en };
        noteBox.innerHTML = '';
        noteBox.appendChild(h('div', { class: 'tip', html:
          '本地神经模型 opus-mt-zh-en（' + ms + ' ms），完全离线，不出浏览器。' }));
        termsBox.innerHTML = '';
      } catch (e) {
        DK.toast('神经翻译失败：' + e.message, 'err');
      } finally { btn.textContent = '神经翻译'; btn.disabled = false; }
    }

    let apiBtn, neuralBtn;
    const row1 = h('div', { class: 'row' }, [
      h('button', { class: 'btn primary', text: '翻译', onclick: render }),
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
      neuralBtn = h('button', { class: 'btn', text: '神经翻译', title: '本地 AI 模型整句翻译（中→英，完全离线，首次加载较慢）', onclick: neuralTranslate }),
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
