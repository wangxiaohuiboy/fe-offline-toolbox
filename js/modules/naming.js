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
    const resultContainer = h('div', {});
    const batchContainer = h('div', {});
    let mode = 'single';

    function nameCard(label, value) {
      if (!value) return null;
      return h('div', { class: 'name-card', title: '点击复制', onclick: () => { DK.copy(value).then(ok => DK.toast(ok ? '已复制：' + value : '复制失败', ok ? '' : 'err')); } }, [
        h('span', { class: 'k', text: label }),
        h('span', { class: 'v', text: value })
      ]);
    }

    function renderSingle() {
      resultContainer.innerHTML = '';
      batchContainer.innerHTML = '';
      const text = input.value.trim();
      if (!text) return;
      const result = DKNaming.convert(text);
      if (!result) return;
      const styleGrid = h('div', { class: 'name-grid' });
      [['camelCase 变量/函数', result.camelCase], ['PascalCase 类/组件', result.PascalCase],
       ['snake_case python风格', result.snake_case], ['kebab-case css/文件', result['kebab-case']],
       ['CONSTANT_CASE 常量', result.CONSTANT_CASE], ['拼音兜底', result.pinyinCamel]
      ].forEach(([label, value]) => { const card = nameCard(label, value); if (card) styleGrid.appendChild(card); });
      resultContainer.appendChild(styleGrid);

      resultContainer.appendChild(h('div', { class: 'muted', style: { margin: '12px 0 6px' }, text: '工程命名建议' }));
      const suggestionGrid = h('div', { class: 'name-grid' });
      Object.entries(result.suggestions).forEach(([label, value]) => { const card = nameCard(label, value); if (card) suggestionGrid.appendChild(card); });
      resultContainer.appendChild(suggestionGrid);

      if (result.words.length) {
        resultContainer.appendChild(h('div', { class: 'muted', style: { margin: '10px 0 4px' }, text: '分词结果：' + result.words.join(' · ') }));
      }
    }

    function renderBatch() {
      resultContainer.innerHTML = '';
      batchContainer.innerHTML = '';
      const inputLines = input.value.split('\n').map(line => line.trim()).filter(Boolean);
      if (!inputLines.length) return;
      const convertedRows = inputLines.map(line => ({ line, result: DKNaming.convert(line) }));
      const buildTable = (styleKey, label) => {
        const matchedRows = convertedRows.filter(row => row.result && row.result[styleKey]);
        if (!matchedRows.length) return null;
        return h('div', { class: 'result-block', style: { marginBottom: '10px' } }, [
          h('div', { class: 'result-head' }, [
            h('span', { text: label }),
            h('button', { class: 'mini-btn', text: '复制全部', onclick: () => {
              DK.copy(matchedRows.map(row => row.result[styleKey]).join('\n')).then(() => DK.toast('已复制 ' + matchedRows.length + ' 行'));
            } })
          ]),
          h('div', { class: 'result-pre', style: { maxHeight: '200px' }, text: matchedRows.map(row => row.result[styleKey]).join('\n') })
        ]);
      };
      ['camelCase', 'snake_case', 'CONSTANT_CASE'].forEach(styleKey => {
        const table = buildTable(styleKey, styleKey);
        if (table) batchContainer.appendChild(table);
      });
    }

    input.addEventListener('input', DK.debounce(() => { mode === 'single' ? renderSingle() : renderBatch(); }, 200));

    body.appendChild(input);
    body.appendChild(h('div', { class: 'row', style: { margin: '8px 0 12px' } }, [
      h('button', { class: 'btn primary', text: '单词组模式', onclick: e => { mode = 'single'; renderSingle(); } }),
      h('button', { class: 'btn', text: '批量模式（每行一个）', onclick: () => { mode = 'batch'; renderBatch(); } }),
      h('button', { class: 'btn', text: '清空', onclick: () => { input.value = ''; resultContainer.innerHTML = ''; batchContainer.innerHTML = ''; input.focus(); } })
    ]));
    body.appendChild(resultContainer);
    body.appendChild(batchContainer);

    input.value = '用户订单列表';
    renderSingle();
  }
});
