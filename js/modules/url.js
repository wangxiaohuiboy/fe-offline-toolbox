/* URL 工具：解析 / 参数表 / query↔JSON 互转 / 重新构造 */
DK.registerTool({
  id: 'url',
  name: 'URL 工具',
  icon: '链',
  desc: 'URL 解析 · 参数表格 · query↔JSON 互转 · 重新拼 URL',
  render(body) {
    const { h } = DK;
    const input = h('textarea', { class: 'ta', style: { minHeight: '70px' }, placeholder: '粘贴 URL，如：https://api.example.com/v1/user?id=1&name=%E5%BC%A0%E4%B8%89&tab=info#detail' });

    function addParamValue(target, key, value) {
      if (!(key in target)) target[key] = value;
      else if (Array.isArray(target[key])) target[key].push(value);
      else target[key] = [target[key], value];
    }

    function parse() {
      partsBox.innerHTML = '';
      paramBox.innerHTML = '';
      const v = input.value.trim();
      if (!v) return null;
      let u;
      try { u = new URL(v); } catch (e) {
        try { u = new URL('http://placeholder.local' + (v.startsWith('/') ? '' : '/') + v); } catch (e2) { return null; }
      }
      return u;
    }

    function render() {
      const u = parse();
      if (!u) { partsBox.innerHTML = ''; paramBox.innerHTML = ''; return; }
      const rows = [
        ['协议 protocol', u.protocol], ['域名 host', u.host], ['端口 port', u.port || '（默认）'],
        ['路径 pathname', u.pathname], ['查询 search', u.search || '（无）'], ['锚点 hash', u.hash || '（无）'],
        ['页面地址 origin', u.origin !== 'null' ? u.origin : '']
      ];
      partsBox.appendChild(h('div', { class: 'result-pre', style: { maxHeight: 'none' }, text:
        rows.map(([k, v]) => k.padEnd(16, '　') + ' ' + v).join('\n') }));

      const params = [...u.searchParams.entries()];
      if (params.length) {
        const grid = h('div', { class: 'url-grid' });
        grid.appendChild(h('div', { class: 'url-head', text: '参数名' }));
        grid.appendChild(h('div', { class: 'url-head', text: '值（自动 URL 解码）' }));
        params.forEach(([k, val]) => {
          grid.appendChild(h('div', { class: 'url-k', text: k, title: '点击复制', onclick: () => DK.copy(k).then(() => DK.toast('已复制')) }));
          grid.appendChild(h('div', { class: 'url-v', text: val, title: '点击复制', onclick: () => DK.copy(val).then(() => DK.toast('已复制')) }));
        });
        paramBox.appendChild(grid);
        const json = {};
        params.forEach(([key, value]) => {
          const converted = value !== '' && !isNaN(+value) ? +value : value;
          addParamValue(json, key, converted);
        });
        paramBox.appendChild(DK.resultBlock('参数 → JSON', () => JSON.stringify(json, null, 2)).el);
      } else {
        paramBox.appendChild(h('div', { class: 'muted', text: '该 URL 没有查询参数' }));
      }
    }
    input.addEventListener('input', DK.debounce(render, 250));

    const partsBox = h('div', { style: { marginTop: '10px' } });
    const paramBox = h('div', { style: { marginTop: '10px' } });

    // ---- query 构造器 ----
    const qInput = h('textarea', { class: 'ta', style: { minHeight: '70px' }, placeholder: '每行一个参数：key=value（值自动 URL 编码）\n如：\npage=1\nkeyword=手机壳' });
    const baseUrl = h('input', { class: 'ti', style: { flex: '1', height: '30px' }, placeholder: '基础 URL（可选），如 https://api.example.com/list' });
    const qOut = DK.resultBlock('Query / 新 URL', () => qOutVal);
    let qOutVal = '';
    function buildQuery() {
      const lines = qInput.value.split('\n').map(s => s.trim()).filter(Boolean);
      const qs = lines.map(l => {
        const i = l.indexOf('=');
        if (i < 0) return encodeURIComponent(l) + '=';
        return encodeURIComponent(l.slice(0, i)) + '=' + encodeURIComponent(l.slice(i + 1));
      }).join('&');
      qOutVal = qs ? (baseUrl.value.trim() ? baseUrl.value.trim() + (baseUrl.value.includes('?') ? '&' : '?') + qs : qs) : '';
      qOut.pre.textContent = qOutVal || '（在上方输入参数）';
    }
    qInput.addEventListener('input', DK.debounce(buildQuery, 250));
    baseUrl.addEventListener('input', DK.debounce(buildQuery, 250));

    body.appendChild(input);
    body.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn primary', text: '解析', onclick: render }),
      h('button', { class: 'btn', text: '复制全部参数 JSON', onclick: () => {
        const u = parse(); if (!u) return DK.toast('请先输入 URL', 'err');
        const json = {};
        [...u.searchParams.entries()].forEach(([key, value]) => addParamValue(json, key, value));
        DK.copy(JSON.stringify(json, null, 2)).then(() => DK.toast('已复制'));
      } })
    ]));
    body.appendChild(partsBox);
    body.appendChild(paramBox);
    body.appendChild(h('div', { class: 'muted', style: { margin: '16px 0 6px' }, text: 'Query 构造器（参数 → URL）' }));
    body.appendChild(qInput);
    body.appendChild(h('div', { style: { height: '8px' } }));
    body.appendChild(baseUrl);
    body.appendChild(h('div', { style: { height: '8px' } }));
    body.appendChild(qOut.el);

    input.value = 'https://api.example.com/v1/user?id=1&name=%E5%BC%A0%E4%B8%89&tab=info#detail';
    render();
  }
});
