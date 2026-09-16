/* 时间戳工具：双向转换 + 实时时间戳 + 相对时间 */
DK.registerTool({
  id: 'time',
  name: '时间戳',
  icon: '钟',
  desc: '时间戳 ↔ 日期双向转换 · 实时时间戳 · 相对时间',
  render(body) {
    const { h } = DK;

    // 实时时间戳
    const nowS = h('b', { text: '—' });
    const nowMs = h('b', { text: '—' });
    const live = h('div', { class: 'result-block', style: { marginBottom: '12px' } }, [
      h('div', { class: 'result-head' }, [
        h('span', { text: '当前时间' }),
        h('button', { class: 'mini-btn', text: '复制秒级', onclick: () => DK.copy(nowS.textContent).then(() => DK.toast('已复制')) })
      ]),
      h('div', { class: 'result-pre', style: { maxHeight: 'none' } }, [
        h('div', {}, ['秒级：', nowS, ' ', h('button', { class: 'mini-btn', text: '复制', onclick: () => DK.copy(nowS.textContent).then(() => DK.toast('已复制')) })]),
        h('div', { style: { marginTop: '4px' } }, ['毫秒：', nowMs, ' ', h('button', { class: 'mini-btn', text: '复制', onclick: () => DK.copy(nowMs.textContent).then(() => DK.toast('已复制')) })])
      ])
    ]);
    let timer = setInterval(tick, 250);
    function tick() {
      const d = new Date();
      nowS.textContent = String(Math.floor(d.getTime() / 1000));
      nowMs.textContent = String(d.getTime());
    }
    tick();
    // 离开面板时停止
    const observer = new MutationObserver(() => {
      if (!document.body.contains(live)) { clearInterval(timer); observer.disconnect(); }
    });
    observer.observe(document.getElementById('tool-body'), { childList: true });

    // ---- 时间戳 → 日期 ----
    const tsInput = h('input', { class: 'ti', placeholder: '输入时间戳（自动识别 秒/毫秒）' });
    const tsOut = DK.resultBlock('转换结果', () => '');
    const tsPre = tsOut.pre;
    tsInput.addEventListener('input', DK.debounce(() => {
      const v = tsInput.value.trim();
      if (!v || isNaN(+v)) { tsPre.textContent = ''; return; }
      let n = +v;
      if (n < 1e12) n *= 1000; // 秒 → 毫秒
      const d = new Date(n);
      if (isNaN(d.getTime())) { tsPre.textContent = '无效时间戳'; return; }
      const pad = x => String(x).padStart(2, '0');
      const diff = Date.now() - d.getTime();
      const abs = Math.abs(diff);
      const unit = abs < 6e4 ? Math.round(abs / 1e3) + ' 秒'
        : abs < 36e5 ? Math.round(abs / 6e4) + ' 分钟'
        : abs < 864e5 ? Math.round(abs / 36e5) + ' 小时'
        : Math.round(abs / 864e5) + ' 天';
      tsPre.textContent = [
        '本地：' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()),
        'ISO： ' + d.toISOString(),
        'UTC： ' + d.toUTCString(),
        '相对：' + (diff >= 0 ? '过去 ' + unit : '还有 ' + unit)
      ].join('\n');
    }, 200));

    // ---- 日期 → 时间戳 ----
    const dtInput = h('input', { class: 'ti', type: 'datetime-local', style: { flex: '1' } });
    const dtOut = DK.resultBlock('时间戳输出', () => dtOutVal);
    let dtOutVal = '';
    const dtPre = dtOut.pre;
    function dtRender() {
      if (!dtInput.value) { dtPre.textContent = ''; dtOutVal = ''; return; }
      const d = new Date(dtInput.value);
      dtOutVal = String(Math.floor(d.getTime() / 1000));
      dtPre.textContent = '秒级：' + dtOutVal + '\n毫秒：' + d.getTime();
    }
    dtInput.addEventListener('change', dtRender);
    dtInput.addEventListener('input', dtRender);

    body.appendChild(live);
    body.appendChild(h('div', { class: 'muted', style: { margin: '4px 0 6px' }, text: '时间戳 → 日期' }));
    body.appendChild(tsInput);
    body.appendChild(h('div', { style: { height: '8px' } }));
    body.appendChild(tsOut.el);
    body.appendChild(h('div', { class: 'muted', style: { margin: '14px 0 6px' }, text: '日期 → 时间戳' }));
    body.appendChild(h('div', { class: 'row' }, [
      dtInput,
      h('button', { class: 'btn', text: '现在', onclick: () => {
        const d = new Date();
        const pad = x => String(x).padStart(2, '0');
        dtInput.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        dtRender();
      } })
    ]));
    body.appendChild(dtOut.el);
  }
});
