/* 表格转换：CSV / TSV / Markdown 表格 / JSON 互转（写文档、导数据常用） */
DK.registerTool({
  id: 'convert',
  name: '表格转换',
  icon: '表',
  desc: 'CSV · TSV · Markdown 表格 · JSON 互转，写文档/导数据常用',
  render(body) {
    const { h } = DK;
    const input = h('textarea', { class: 'ta', style: { minHeight: '130px' }, placeholder: '粘贴表格数据：CSV / TSV（Excel直接复制）/ Markdown 表格 / JSON 数组' });
    const out = DK.resultBlock('转换结果', () => lastOut);
    let lastOut = '';
    const outPre = out.pre;
    outPre.style.maxHeight = '300px';

    // ---- 解析：完整支持 RFC 4180 风格的引号与引号内换行 ----
    function parseDelimited(text, delim) {
      const rows = [];
      let row = [];
      let current = '';
      let inQuotes = false;

      for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (inQuotes) {
          if (char === '"') {
            if (text[index + 1] === '"') {
              current += '"';
              index++;
            } else {
              inQuotes = false;
            }
          } else {
            current += char;
          }
          continue;
        }

        if (char === '"') {
          inQuotes = true;
        } else if (char === delim) {
          row.push(current);
          current = '';
        } else if (char === '\n') {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        } else if (char === '\r') {
          if (text[index + 1] === '\n') continue;
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        } else {
          current += char;
        }
      }

      row.push(current);
      rows.push(row);
      while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
      return rows;
    }

    function detect(value) {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return { type: 'json', rows: jsonToRows(parsed) };
        } catch (error) {}
      }
      if (/^\|.*\|/.test(trimmed.split('\n')[0])) {
        const rows = trimmed.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'))
          .filter(line => !/^\|[\s:|-]+\|?$/.test(line))
          .map(line => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
        if (rows.length) return { type: 'md', rows };
      }
      const firstLine = trimmed.split(/\r?\n/)[0];
      if (firstLine.includes('\t')) return { type: 'tsv', rows: parseDelimited(trimmed, '\t') };
      return { type: 'csv', rows: parseDelimited(trimmed, ',') };
    }

    function jsonToRows(arr) {
      // 数组为对象 → 表头+行；数组为数组 → 直接行
      if (arr.length && Array.isArray(arr[0])) return arr;
      const keys = [];
      arr.forEach(o => Object.keys(o || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
      return [keys, ...arr.map(o => keys.map(k => o == null ? '' : (o[k] === null || o[k] === undefined ? '' : String(o[k]))))];
    }

    // ---- 输出 ----
    function toCsv(rows, delim) {
      return rows.map(r => r.map(c => {
        const s = String(c == null ? '' : c);
        return /["\n,;\t|]/.test(s) || (delim === '\t' && /\t/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(delim)).join('\n');
    }
    function toMd(rows) {
      const esc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      if (!rows.length) return '';
      const w = rows[0].length;
      const norm = rows.map(r => { const c = r.slice(); while (c.length < w) c.push(''); return c; });
      const head = '| ' + norm[0].map(esc).join(' | ') + ' |';
      const sep = '| ' + norm[0].map(() => '---').join(' | ') + ' |';
      const body = norm.slice(1).map(r => '| ' + r.map(esc).join(' | ') + ' |');
      return [head, sep, ...body].join('\n');
    }
    function toJson(rows) {
      if (rows.length < 2) return JSON.stringify(rows, null, 2);
      const head = rows[0];
      const arr = rows.slice(1).map(r => {
        const o = {};
        head.forEach((k, i) => {
          let v = r[i];
          if (v === undefined || v === '') v = null;
          else if (v === 'true') v = true;
          else if (v === 'false') v = false;
          else if (v !== '' && !isNaN(+v)) v = +v;
          o[k] = v;
        });
        return o;
      });
      return JSON.stringify(arr, null, 2);
    }

    function run(fn, label) {
      const v = input.value.trim();
      if (!v) { DK.toast('请先输入表格数据', 'err'); return; }
      const d = detect(v);
      if (!d) { DK.toast('无法识别输入格式', 'err'); return; }
      const result = fn(d.rows);
      lastOut = result;
      outPre.textContent = result;
      // 更新提示来源格式
      const names = { csv: 'CSV', tsv: 'TSV', md: 'Markdown 表格', json: 'JSON 数组' };
      statBox.innerHTML = '识别输入：<b>' + names[d.type] + '</b> · ' + d.rows.length + ' 行 × ' + (d.rows[0] || []).length + ' 列 → ' + label;
    }

    const statBox = h('div', { class: 'stat' });
    const btns = h('div', { class: 'row' }, [
      h('button', { class: 'btn primary', text: '→ Markdown 表格', onclick: () => run(toMd, 'Markdown') }),
      h('button', { class: 'btn', text: '→ JSON', onclick: () => run(toJson, 'JSON') }),
      h('button', { class: 'btn', text: '→ CSV', onclick: () => run(r => toCsv(r, ','), 'CSV') }),
      h('button', { class: 'btn', text: '→ TSV', onclick: () => run(r => toCsv(r, '\t'), 'TSV') }),
      h('button', { class: 'btn', text: '示例', onclick: () => {
        input.value = '名称,数量,备注\niPhone 15,"1,280 台含","快充版"\nMacBook Pro,320,14寸\nAirPods,"2,100",Pro2';
        statBox.innerHTML = '已载入示例，点击任意转换按钮';
      } })
    ]);

    body.appendChild(input);
    body.appendChild(btns);
    body.appendChild(statBox);
    body.appendChild(out.el);
  }
});
