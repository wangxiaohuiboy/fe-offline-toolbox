/* 文本处理：大小写/排序/去重/统计/Diff/全角半角 */
DK.registerTool({
  id: 'text',
  name: '文本处理',
  icon: '文',
  desc: '大小写 · 排序去重 · 行处理 · 统计 · 行 Diff · 全角半角',
  render(body) {
    const { h, $$ } = DK;
    const input = h('textarea', { class: 'ta', style: { minHeight: '120px' }, placeholder: '输入文本，每行一条记录效果最佳…' });
    const out = DK.resultBlock('处理结果', () => lastOut);
    let lastOut = '';
    const show = v => { lastOut = v; out.pre.textContent = v; };

    const lines = () => input.value.split('\n');

    function stats() {
      const v = input.value;
      const words = (v.match(/[a-zA-Z]+/g) || []).length;
      const cjk = (v.match(/[\u4e00-\u9fa5]/g) || []).length;
      const bytes = new Blob([v]).size;
      return v.length ? '字符 ' + v.length + ' · 英文单词 ' + words + ' · 汉字 ' + cjk + ' · 行数 ' + lines().length + ' · UTF-8 字节 ' + bytes : '';
    }
    const statBox = h('div', { class: 'stat' });
    input.addEventListener('input', DK.debounce(() => { statBox.innerHTML = stats(); }, 200));

    const btn = (t, fn) => h('button', { class: 'btn', text: t, onclick: fn });

    const rows1 = h('div', { class: 'row' }, [
      btn('转大写', () => show(input.value.toUpperCase())),
      btn('转小写', () => show(input.value.toLowerCase())),
      btn('行转 camelCase', () => show(lines().map(l => DKNaming.convert(l)).map(r => r ? r.camelCase : l).join('\n'))),
      btn('行转 snake_case', () => show(lines().map(l => DKNaming.convert(l)).map(r => r ? r.snake_case : l).join('\n'))),
      btn('行转 kebab-case', () => show(lines().map(l => DKNaming.convert(l)).map(r => r ? r['kebab-case'] : l).join('\n')))
    ]);
    const rows2 = h('div', { class: 'row' }, [
      btn('排序', () => show(lines().filter(l => l.trim()).sort((a, b) => a.localeCompare(b, 'zh')).join('\n'))),
      btn('倒序', () => show(lines().filter(l => l.trim()).sort((a, b) => b.localeCompare(a, 'zh')).join('\n'))),
      btn('按长度', () => show(lines().filter(l => l.trim()).sort((a, b) => a.length - b.length).join('\n'))),
      btn('去重', () => show([...new Set(lines())].join('\n'))),
      btn('去空行', () => show(lines().filter(l => l.trim()).join('\n'))),
      btn('去首尾空格', () => show(lines().map(l => l.trim()).join('\n')))
    ]);
    const rows3 = h('div', { class: 'row' }, [
      btn('加行号', () => show(lines().map((l, i) => (i + 1) + '. ' + l).join('\n'))),
      btn('合并为一行', () => show(lines().map(l => l.trim()).filter(Boolean).join(''))),
      btn('逗号连接', () => show(lines().map(l => l.trim()).filter(Boolean).join(', '))),
      btn('引号包裹', () => show(lines().map(l => "'" + l.trim() + "'").filter(l => l !== "''").join(',\n'))),
      btn('全角→半角', () => show(input.value.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' '))),
      btn('半角→全角', () => show(input.value.replace(/[\x21-\x7E]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))))
    ]);
    const preIn = h('input', { class: 'ti', style: { width: '110px', height: '30px' }, placeholder: '行前缀' });
    const sufIn = h('input', { class: 'ti', style: { width: '110px', height: '30px' }, placeholder: '行后缀' });
    const preRow = h('div', { class: 'row' }, [
      preIn,
      sufIn,
      btn('添加前后缀', () => {
        show(lines().map(l => l.trim() ? preIn.value + l + sufIn.value : l).join('\n'));
      })
    ]);

    // 行 Diff
    function diff() {
      const box = $$('#tool-body textarea.ta');
      const b = box[1];
      if (!b || !b.value) { DK.toast('请在第二个文本框中输入对比内容', 'err'); return; }
      const A = lines().filter(l => l !== '');
      const B = b.value.split('\n').filter(l => l !== '');
      const n = A.length, m = B.length;
      // LCS DP
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const res = [];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (A[i] === B[j]) { res.push([' ', A[i]]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { res.push(['-', A[i]]); i++; }
        else { res.push(['+', B[j]]); j++; }
      }
      while (i < n) { res.push(['-', A[i++]]); }
      while (j < m) { res.push(['+', B[j++]]); }
      show(res.map(([t, l]) => t === ' ' ? '  ' + l : t + ' ' + l).join('\n'));
    }

    body.appendChild(input);
    body.appendChild(statBox);
    body.appendChild(rows1);
    body.appendChild(rows2);
    body.appendChild(rows3);
    body.appendChild(preRow);
    body.appendChild(h('div', { class: 'muted', style: { margin: '12px 0 6px' }, text: '行 Diff（下方输入对比文本）' }));
    const inputB = h('textarea', { class: 'ta', style: { minHeight: '80px' }, placeholder: '对比文本…' });
    body.appendChild(inputB);
    body.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn primary', text: '对比差异', onclick: diff })]));
    body.appendChild(out.el);

    input.value = 'banana\napple\nbanana\ncherry';
    statBox.innerHTML = stats();
  }
});
