/* 接口调试：内网 API 测试器（支持权限按需申请、超时控制、历史记录） */
DK.registerTool({
  id: 'api',
  name: '接口调试',
  icon: '联',
  desc: '内网 API 调试 · GET/POST/PUT/DELETE · 响应耗时统计 · 历史记录',
  render(body) {
    const { h } = DK;

    body.appendChild(h('div', { class: 'tip', html:
      '<b>简易接口调试器</b>：内网联调利器。首次请求某个域名时 Chrome 会请求跨域授权，点「允许」即可。响应自动尝试 JSON 格式化。' }));

    const method = h('select', { class: 'sel', style: { height: '34px' } },
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(m => h('option', { value: m, text: m })));
    const url = h('input', { class: 'ti', style: { flex: '1', height: '34px', fontFamily: 'var(--mono)' }, placeholder: 'http://内网地址/api/xxx?id=1' });
    const send = h('button', { class: 'btn primary', text: '发送', onclick: doSend });

    const headersTa = h('textarea', { class: 'ta', style: { minHeight: '54px' }, placeholder: '请求头（每行 key: value 或留空），如：\nAuthorization: Bearer xxx\nContent-Type: application/json' });
    const bodyTa = h('textarea', { class: 'ta', style: { minHeight: '70px' }, placeholder: '请求体（POST/PUT/PATCH）：JSON 或表单文本' });

    const statBox = h('div', { class: 'stat' });
    const out = DK.resultBlock('响应', () => lastResp);
    let lastResp = '';
    const outPre = out.pre;
    outPre.style.maxHeight = '320px';
    const historyBox = h('div', {});
    const history = [];

    function parseHeaders() {
      const hs = {};
      headersTa.value.split('\n').forEach(line => {
        const i = line.indexOf(':');
        if (i > 0) hs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      return hs;
    }

    async function doRequest(u) {
      const opt = {
        method: method.value,
        headers: parseHeaders(),
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
      };
      if (!['GET', 'HEAD'].includes(method.value) && bodyTa.value.trim()) {
        opt.body = bodyTa.value;
        if (!opt.headers['Content-Type'] && !Object.keys(opt.headers).some(k => k.toLowerCase() === 'content-type')) {
          opt.headers['Content-Type'] = 'application/json';
        }
      }
      return fetch(u, opt);
    }

    async function show(u) {
      lastResp = ''; outPre.textContent = ''; statBox.innerHTML = '';
      if (!u.trim()) { DK.toast('请输入接口地址', 'err'); return; }
      if (!/^https?:\/\//i.test(u.trim())) { DK.toast('地址需以 http(s):// 开头', 'err'); return; }
      send.disabled = true; send.textContent = '请求中…';
      const t0 = performance.now();
      try {
        let resp;
        try { resp = await doRequest(u); }
        catch (e) {
          // 可能是跨域权限未授权 → 申请该内网域名权限后重试一次
          const origin = new URL(u).origin + '/*';
          const granted = await new Promise(r => {
            try { chrome.permissions.request({ origins: [origin] }, r); } catch (err) { r(false); }
          });
          if (granted) resp = await doRequest(u);
          else throw e;
        }
        const ms = Math.round(performance.now() - t0);
        const text = await resp.text();
        let pretty = text;
        try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* 非 JSON */ }
        lastResp = pretty;
        outPre.textContent = pretty || '（空响应体）';
        let respHeaders = '';
        resp.headers.forEach((v, k) => { respHeaders += k + ': ' + v + '\n'; });
        const size = new Blob([text]).size;
        statBox.innerHTML = '状态 <b class="' + (resp.ok ? 's-ok' : 's-err') + '">' + resp.status + ' ' + resp.statusText + '</b>' +
          ' · 耗时 <b>' + ms + ' ms</b> · 大小 <b>' + (size / 1024).toFixed(2) + ' KB</b>' +
          '<div class="muted" style="margin-top:4px;white-space:pre-wrap;font-size:11px">' + DK.esc(respHeaders.trim()) + '</div>';
        history.unshift({ m: method.value, u, ok: resp.ok, ms });
        if (history.length > 8) history.pop();
        renderHistory();
      } catch (e) {
        statBox.innerHTML = '请求失败：<b class="s-err">' + DK.esc(e.message) + '</b><div class="muted" style="margin-top:4px">常见原因：地址写错 / 内网不通 / 跨域权限被拒绝（可到 chrome://extensions → 本插件 → 权限里重新授权）</div>';
      } finally {
        send.disabled = false; send.textContent = '发送';
      }
    }
    function doSend() { show(url.value); }

    function renderHistory() {
      historyBox.innerHTML = '';
      if (!history.length) return;
      historyBox.appendChild(h('div', { class: 'muted', style: { margin: '12px 0 6px' }, text: '最近请求（点击回填）' }));
      history.forEach(item => {
        historyBox.appendChild(h('div', {
          class: 'hist-item',
          title: '点击回填并重发',
          onclick: () => { method.value = item.m; url.value = item.u; show(item.u); }
        }, [
          h('span', { class: 'hist-m ' + (item.ok ? 's-ok' : 's-err'), text: item.m }),
          h('span', { class: 'hist-u', text: item.u }),
          h('span', { class: 'hist-ms', text: item.ms + 'ms' })
        ]));
      });
    }

    body.appendChild(h('div', { class: 'row' }, [method, url, send]));
    body.appendChild(headersTa);
    body.appendChild(bodyTa);
    body.appendChild(statBox);
    body.appendChild(out.el);
    body.appendChild(historyBox);

    url.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
  }
});
