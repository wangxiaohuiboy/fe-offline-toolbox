/* Cron 解析：5 位表达式 → 中文描述 + 未来执行时间（纯本地计算） */
DK.registerTool({
  id: 'cron',
  name: 'Cron 解析',
  icon: '⏰',
  desc: '解析分/时/日/月/周 五段式表达式 · 中文描述 · 未来 5 次执行时间',
  render(body) {
    const { h } = DK;
    const input = h('input', { class: 'ti', style: { fontFamily: 'var(--mono)', flex: '1' }, placeholder: 'Cron 表达式，如：0 9 * * 1-5（工作日 9 点）' });
    const descBox = DK.resultBlock('含义', () => '');
    const nextBox = DK.resultBlock('未来 5 次执行时间', () => '');
    const errTip = h('div', {});
    const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    function parseField(f, min, max, names) {
      // 返回匹配值集合的判断函数
      if (f === '*') return () => true;
      const set = new Set();
      for (const part of f.split(',')) {
        const stepM = /^(\*|\d+-?\d*)\/(\d+)$/.exec(part);
        let range = part, step = 1;
        if (stepM) { range = stepM[1]; step = +stepM[2]; }
        let lo = min, hi = max;
        if (range !== '*' && range !== '') {
          const r = range.split('-');
          lo = num(r[0], min, max); hi = r.length > 1 ? num(r[1], min, max) : lo;
          if (lo == null || hi == null) throw new Error('字段「' + f + '」数值超出范围');
        }
        for (let v = lo; v <= hi; v += step) {
          set.add(names ? v % names.length : v);
          if (names && v === 7 && max === 7) set.add(0); // 周 7=周日
        }
      }
      return v => set.has(v);
    }
    function num(s, min, max) {
      const n = +s;
      if (isNaN(n)) throw new Error('无法解析数值「' + s + '」');
      if (n < min || n > max) return null;
      return n;
    }
    function listStr(set, max, names) {
      const vals = [...set].sort((a, b) => a - b);
      if (vals.length === max - min + 1 + (max === 7 ? 1 : 0)) return '';
      return vals.map(v => names ? names[v] : v).join('、');
    }

    function parse(expr) {
      const parts = expr.trim().split(/\s+/);
      if (parts.length !== 5) throw new Error('需要 5 个字段：分 时 日 月 周');
      const minF = parseField(parts[0], 0, 59);
      const hourF = parseField(parts[1], 0, 23);
      const domF = parseField(parts[2], 1, 31);
      const monF = parseField(parts[3], 1, 12);
      const dowF = parseField(parts[4], 0, 7, WD);
      const domRestricted = parts[2] !== '*';
      const dowRestricted = parts[4] !== '*';

      // 描述
      function descField(f, unit, names, rangeDesc) {
        if (f === '*' || f === '') return '每' + unit;
        if (/^\*\/(\d+)$/.test(f)) return '每 ' + f.split('/')[1] + ' ' + unit;
        const setDesc = f.replace(/\//g, ' 间隔 ').replace(/-/g, ' 到 ').replace(/,/g, '、');
        if (names) {
          const describeName = value => names[(+value) % 7 === 0 && +value === 7 ? 0 : (+value) % 7] || value;
          const described = f.split(',').map(part => {
            const range = /^(\d+)-(\d+)$/.exec(part);
            if (range) return describeName(range[1]) + '至' + describeName(range[2]);
            if (/^\d+$/.test(part)) return describeName(part);
            return part;
          }).join('、');
          return '在 ' + described;
        }
        return '在 ' + setDesc + ' ' + unit;
      }
      const d = [
        descField(parts[0], '分钟'),
        descField(parts[1], '小时'),
        parts[2] === '*' ? '' : descField(parts[2], '日'),
        parts[3] === '*' ? '' : descField(parts[3], '月'),
        parts[4] === '*' ? '' : descField(parts[4], '周', WD)
      ].filter(Boolean).join('，');
      return {
        match: (d0) => {
          if (!monF(d0.getMonth() + 1)) return false;
          const domOk = domF(d0.getDate());
          const dowOk = dowF(d0.getDay());
          if (domRestricted && dowRestricted) { if (!domOk && !dowOk) return false; }
          else { if (!domOk || !dowOk) return false; }
          return hourF(d0.getHours()) && minF(d0.getMinutes());
        },
        desc: d || '每分钟'
      };
    }

    function run() {
      errTip.innerHTML = '';
      descBox.pre.textContent = '';
      nextBox.pre.textContent = '';
      const expr = input.value.trim();
      if (!expr) return;
      let p;
      try { p = parse(expr); }
      catch (e) {
        errTip.appendChild(h('div', { class: 'tip warn', text: e.message }));
        return;
      }
      descBox.pre.textContent = p.desc;
      // 向后找 5 次执行时间
      const times = [];
      const cur = new Date();
      cur.setSeconds(0, 0);
      cur.setMinutes(cur.getMinutes() + 1);
      let guard = 0;
      while (times.length < 5 && guard < 500000) {
        guard++;
        if (p.match(cur)) {
          const pad = x => String(x).padStart(2, '0');
          times.push(cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate()) + ' ' + pad(cur.getHours()) + ':' + pad(cur.getMinutes()) + ' ' + WD[cur.getDay()]);
          cur.setMinutes(cur.getMinutes() + 1);
        } else {
          // 快进：分钟不匹配则跳到下一小时
          if (cur.getMinutes() === 59) cur.setHours(cur.getHours() + 1, 0);
          else cur.setMinutes(cur.getMinutes() + 1);
        }
      }
      nextBox.pre.textContent = times.length ? times.join('\n') : '（未找到未来执行时间，请检查表达式）';
    }
    input.addEventListener('input', DK.debounce(run, 250));

    const examples = [
      ['*/5 * * * *', '每 5 分钟'],
      ['0 9 * * 1-5', '工作日早 9 点'],
      ['0 0 1 * *', '每月 1 号零点'],
      ['30 8,18 * * *', '每天 8:30 和 18:30'],
      ['0 2 * * 0', '每周日凌晨 2 点']
    ];
    const egBox = h('div', { class: 'cheat-grid' });
    examples.forEach(([e, d]) => egBox.appendChild(h('div', { class: 'cheat-item', onclick: () => { input.value = e; run(); } }, [
      h('code', { text: e }), h('span', { class: 'd', text: d })
    ])));

    body.appendChild(h('div', { class: 'row' }, [input, h('button', { class: 'btn primary', text: '解析', onclick: run })]));
    body.appendChild(errTip);
    body.appendChild(descBox.el);
    body.appendChild(h('div', { style: { height: '10px' } }));
    body.appendChild(nextBox.el);
    body.appendChild(h('div', { class: 'muted', style: { margin: '14px 0 6px' }, text: '常见示例（点击填入）' }));
    body.appendChild(egBox);

    input.value = '0 9 * * 1-5';
    run();
  }
});
