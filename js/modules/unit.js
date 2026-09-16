/* 单位换算：px ↔ rem ↔ vw（移动端适配常用） */
DK.registerTool({
  id: 'unit',
  name: 'px·rem·vw',
  icon: '尺',
  desc: 'px / rem / vw / % 换算 · 常用字号速查 · 移动端适配',
  render(body) {
    const { h } = DK;
    const rootFs = h('input', { class: 'ti', type: 'number', value: '16', min: '1', style: { width: '70px', height: '30px' } });
    const vpW = h('input', { class: 'ti', type: 'number', value: '375', min: '1', style: { width: '70px', height: '30px' } });
    const cfgRow = h('div', { class: 'row', style: { margin: '10px 0' } }, [
      h('label', { class: 'muted', text: '根字号(px)' }), rootFs,
      h('label', { class: 'muted', text: '视口宽度(px)' }), vpW,
      h('span', { class: 'muted', text: 'PostCSS/开发常用基准可在此调整' })
    ]);

    const inVal = h('input', { class: 'ti', type: 'number', value: '24', style: { flex: '1', height: '34px' } });
    const inUnit = h('select', { class: 'sel' }, ['px', 'rem', 'vw'].map(u => h('option', { value: u, text: u })));
    const outBox = h('div', { class: 'result-pre', style: { maxHeight: 'none' } });
    const outWrap = h('div', { class: 'result-block' }, [
      h('div', { class: 'result-head' }, [
        h('span', { text: '换算结果（点击复制）' })
      ]), outBox
    ]);

    function calc() {
      const v = parseFloat(inVal.value);
      if (isNaN(v)) { outBox.textContent = ''; return; }
      const root = Math.max(1, +rootFs.value || 16);
      const vw = Math.max(1, +vpW.value || 375);
      let px;
      if (inUnit.value === 'px') px = v;
      else if (inUnit.value === 'rem') px = v * root;
      else px = v / 100 * vw;
      const rem = px / root;
      const vwc = px / vw * 100;
      const rows = [
        ['px  ', px.toFixed(2).replace(/\.?0+$/, '') + 'px', px + 'px'],
        ['rem ', (+rem.toFixed(6)) + 'rem', (+rem.toFixed(4)) + 'rem'],
        ['vw  ', (+vwc.toFixed(4)) + 'vw', (+vwc.toFixed(2)) + 'vw'],
        ['%   ', (px / root * 100).toFixed(2) + '%（相对根字号）', '']
      ];
      outBox.textContent = '';
      rows.forEach(([label, val, copyV]) => {
        const line = h('div', { class: 'unit-line', title: '点击复制', onclick: () => copyV && DK.copy(copyV).then(() => DK.toast('已复制 ' + copyV)) }, [
          h('span', { class: 'unit-k', text: label }),
          h('span', { class: 'unit-v', text: val })
        ]);
        outBox.appendChild(line);
      });
    }
    [inVal, rootFs, vpW].forEach(el => el.addEventListener('input', calc));
    inUnit.addEventListener('change', calc);

    // 常用字号速查
    const sizes = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48];
    function quickTable() {
      const root = Math.max(1, +rootFs.value || 16);
      const vw = Math.max(1, +vpW.value || 375);
      const grid = h('div', { class: 'url-grid' });
      grid.appendChild(h('div', { class: 'url-head', text: 'px' }));
      grid.appendChild(h('div', { class: 'url-head', text: 'rem' }));
      grid.appendChild(h('div', { class: 'url-head', text: 'vw @' + vw }));
      sizes.forEach(p => {
        const rem = (p / root);
        const v = (p / vw * 100);
        [p + 'px', (+rem.toFixed(4)) + 'rem', (+v.toFixed(3)) + 'vw'].forEach((t, i) => {
          grid.appendChild(h('div', { class: 'url-k', text: t, title: '点击复制', onclick: () => DK.copy(t).then(() => DK.toast('已复制 ' + t)) }));
        });
      });
      return grid;
    }
    let qt = quickTable();
    const qtWrap = h('div', {});
    qtWrap.appendChild(qt);
    [rootFs, vpW].forEach(el => el.addEventListener('input', () => { qt = quickTable(); qtWrap.innerHTML = ''; qtWrap.appendChild(qt); }));

    body.appendChild(h('div', { class: 'tip', html: '移动端适配常用：设计稿 375px 时 <code>1px = 0.2667vw</code>；rem 方案记得同步根字号。点击任意结果即可复制。' }));
    body.appendChild(cfgRow);
    body.appendChild(h('div', { class: 'row' }, [inVal, inUnit]));
    body.appendChild(h('div', { style: { height: '10px' } }));
    body.appendChild(outWrap);
    body.appendChild(h('div', { class: 'muted', style: { margin: '14px 0 6px' }, text: '常用字号速查' }));
    body.appendChild(qtWrap);
    calc();
  }
});
