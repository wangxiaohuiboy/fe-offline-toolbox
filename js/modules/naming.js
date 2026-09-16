/* 中文转变量名：符合前端工程命名规范 */
DK.registerTool({
  id: 'naming',
  name: '中文转变量名',
  icon: '名',
  desc: '中文需求描述 → camelCase / PascalCase / snake_case 等命名规范',
  render(body) {
    const { h } = DK;
    body.appendChild(h('div', { class: 'tip', html:
      '输入中文（如 <b>用户订单列表</b>、<b>商品详情页</b>），基于离线词典 + 拼音兜底转换为各类命名风格，点击卡片即可复制。' }));

    const input = h('textarea', { class: 'ta', placeholder: '输入中文词组，如：订单支付成功回调' });
    const out = h('div', {});
    const batch = h('div', {});
    let mode = 'single';

    function card(k, v) {
      if (!v) return null;
      return h('div', { class: 'name-card', title: '点击复制', onclick: () => { DK.copy(v).then(ok => DK.toast(ok ? '已复制：' + v : '复制失败', ok ? '' : 'err')); } }, [
        h('span', { class: 'k', text: k }),
        h('span', { class: 'v', text: v })
      ]);
    }

    function renderSingle() {
      out.innerHTML = '';
      batch.innerHTML = '';
      const text = input.value.trim();
      if (!text) return;
      const r = DKNaming.convert(text);
      if (!r) return;
      const grid = h('div', { class: 'name-grid' });
      [['camelCase 变量/函数', r.camelCase], ['PascalCase 类/组件', r.PascalCase],
       ['snake_case python风格', r.snake_case], ['kebab-case css/文件', r['kebab-case']],
       ['CONSTANT_CASE 常量', r.CONSTANT_CASE], ['拼音兜底', r['拼音驼峰']]
      ].forEach(([k, v]) => { const c = card(k, v); if (c) grid.appendChild(c); });
      out.appendChild(grid);

      out.appendChild(h('div', { class: 'muted', style: { margin: '12px 0 6px' }, text: '工程命名建议' }));
      const grid2 = h('div', { class: 'name-grid' });
      Object.entries(r.suggestions).forEach(([k, v]) => { const c = card(k, v); if (c) grid2.appendChild(c); });
      out.appendChild(grid2);

      if (r.words.length) {
        out.appendChild(h('div', { class: 'muted', style: { margin: '10px 0 4px' }, text: '分词结果：' + r.words.join(' · ') }));
      }
    }

    function renderBatch() {
      out.innerHTML = '';
      batch.innerHTML = '';
      const lines = input.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;
      const rows = lines.map(line => ({ line, r: DKNaming.convert(line) }));
      const mkTable = (key, label) => {
        const valid = rows.filter(x => x.r && x.r[key]);
        if (!valid.length) return null;
        return h('div', { class: 'result-block', style: { marginBottom: '10px' } }, [
          h('div', { class: 'result-head' }, [
            h('span', { text: label }),
            h('button', { class: 'mini-btn', text: '复制全部', onclick: () => {
              DK.copy(valid.map(x => x.r[key]).join('\n')).then(() => DK.toast('已复制 ' + valid.length + ' 行'));
            } })
          ]),
          h('div', { class: 'result-pre', style: { maxHeight: '200px' }, text: valid.map(x => x.r[key]).join('\n') })
        ]);
      };
      ['camelCase', 'snake_case', 'CONSTANT_CASE'].forEach(key => {
        const t = mkTable(key, key);
        if (t) batch.appendChild(t);
      });
    }

    input.addEventListener('input', DK.debounce(() => { mode === 'single' ? renderSingle() : renderBatch(); }, 200));

    body.appendChild(input);
    body.appendChild(h('div', { class: 'row', style: { margin: '8px 0 12px' } }, [
      h('button', { class: 'btn primary', text: '单词组模式', onclick: e => { mode = 'single'; renderSingle(); } }),
      h('button', { class: 'btn', text: '批量模式（每行一个）', onclick: () => { mode = 'batch'; renderBatch(); } }),
      h('button', { class: 'btn', text: '清空', onclick: () => { input.value = ''; out.innerHTML = ''; batch.innerHTML = ''; input.focus(); } })
    ]));
    body.appendChild(out);
    body.appendChild(batch);

    input.value = '用户订单列表';
    renderSingle();
  }
});
