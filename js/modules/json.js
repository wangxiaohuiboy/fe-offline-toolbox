/* JSON 工具：格式化/校验/压缩/转义/键排序/转TS/转YAML/取值 */
(function () {
  'use strict';

  // 带行列的错误定位
  function parseJSONWithPos(str) {
    try { return { ok: true, data: JSON.parse(str) }; }
    catch (e) {
      const m = /position (\d+)/.exec(e.message);
      let line = 1, col = 1;
      if (m) {
        const pos = +m[1];
        const before = str.slice(0, pos);
        line = before.split('\n').length;
        col = pos - before.lastIndexOf('\n');
      }
      return { ok: false, error: e.message, line, col };
    }
  }

  function highlight(json) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc(json).replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (match, str, colon, bool) => {
        if (str) return '<span class="' + (colon ? 'j-key' : 'j-str') + '">' + str + '</span>' + (colon ? '<span class="j-punc">' + colon + '</span>' : '');
        if (bool) return '<span class="j-bool">' + bool + '</span>';
        if (match === 'null') return '<span class="j-null">null</span>';
        if (/^-?\d/.test(match)) return '<span class="j-num">' + match + '</span>';
        return match;
      });
  }

  function sortKeys(v, asc) {
    if (Array.isArray(v)) return v.map(x => sortKeys(x, asc));
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).sort(asc ? undefined : (a, b) => b.localeCompare(a)).forEach(k => { o[k] = sortKeys(v[k], asc); });
      return o;
    }
    return v;
  }

  function stats(v) {
    let nodes = 0, depth = 0, maxArr = 0;
    (function walk(x, d) {
      nodes++;
      depth = Math.max(depth, d);
      if (Array.isArray(x)) { maxArr = Math.max(maxArr, x.length); x.forEach(i => walk(i, d + 1)); }
      else if (x && typeof x === 'object') Object.values(x).forEach(i => walk(i, d + 1));
    })(v, 1);
    return { nodes, depth, maxArr };
  }

  function toYAML(v, indent) {
    indent = indent || 0;
    const pad = '  '.repeat(indent);
    if (v === null) return 'null';
    if (typeof v !== 'object') {
      if (typeof v === 'string') {
        const plainSafe = v.trim()
          && !/^(true|false|null|~|[-+]?\d+(?:\.\d+)?)$/i.test(v)
          && !/[:#\[\]{},&*!|>'"%@`]/.test(v)
          && !/^[-?:]\s/.test(v)
          && !/\s{2,}/.test(v)
          && /^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5 ./()\-]*$/.test(v);
        return plainSafe ? v : JSON.stringify(v);
      }
      return String(v);
    }
    const lines = [];
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      v.forEach(item => {
        if (item && typeof item === 'object') {
          const inner = toYAML(item, indent + 1);
          lines.push(pad + '- ' + inner.trimStart());
        } else lines.push(pad + '- ' + toYAML(item));
      });
      return lines.join('\n');
    }
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    keys.forEach(k => {
      const val = v[k];
      const key = /^[A-Za-z_$][\w$-]*$/.test(k) ? k : JSON.stringify(k);
      if (val && typeof val === 'object') {
        lines.push(pad + key + ':\n' + toYAML(val, indent + 1));
      } else lines.push(pad + key + ': ' + toYAML(val));
    });
    return lines.join('\n');
  }

  function toTS(v, name) {
    name = name || 'Root';
    const ifaces = [];
    const seen = new Set();

    function typeOf(x, key) {
      if (x === null) return 'null';
      if (Array.isArray(x)) {
        if (!x.length) return 'unknown[]';
        const types = [...new Set(x.map(i => typeOf(i, key)))];
        return types.length === 1 ? types[0] + '[]' : '(' + types.join(' | ') + ')[]';
      }
      if (typeof x === 'object') {
        const iName = ifaceName(key);
        genInterface(x, iName);
        return iName;
      }
      if (typeof x === 'number') return 'number';
      return typeof x;
    }

    function ifaceName(key) {
      let n = (key || 'Item').replace(/[^A-Za-z0-9_\u4e00-\u9fa5]/g, '');
      if (/^\d/.test(n)) n = 'I' + n;
      if (!n) n = 'Item';
      n = n.charAt(0).toUpperCase() + n.slice(1);
      let base = n, i = 2;
      while (seen.has(n)) n = base + i++;
      return n;
    }

    function genInterface(obj, name) {
      if (seen.has(name) && ifaces.some(i => i.name === name)) return;
      seen.add(name);
      const lines = ['export interface ' + name + ' {'];
      for (const [k, val] of Object.entries(obj)) {
        const opt = val === null ? '?' : '';
        lines.push('  ' + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + opt + ': ' + typeOf(val, k) + ';');
      }
      lines.push('}');
      ifaces.push({ name, code: lines.join('\n') });
    }

    const rootType = typeOf(v, name);
    let out = '';
    // 依赖顺序：后生成的先被引用 → 倒序输出
    ifaces.forEach(i => { out += i.code + '\n\n'; });
    if (!ifaces.length || (typeof v !== 'object' || v === null)) out = 'export const ' + (name || 'value') + ': ' + rootType + ';\n';
    return out.trim();
  }

  function getPath(obj, path) {
    // 支持 $.a.b[0].c 或 a.b[0]
    let p = path.trim().replace(/^\$\.?/, '');
    const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let cur = obj;
    for (const k of parts) {
      if (cur == null) return undefined;
      cur = cur[k];
    }
    return cur;
  }

  DK.registerTool({
    id: 'json',
    name: 'JSON 工具',
    icon: '{ }',
    desc: '格式化 · 校验定位 · 压缩 · 转义 · 键排序 · 转 TypeScript / YAML',
    render(body) {
      const { h } = DK;
      const input = h('textarea', { class: 'ta', style: { minHeight: '150px' }, placeholder: '粘贴 JSON 字符串…' });
      const out = DK.resultBlock('结果', () => currentOut);
      const outWrap = h('div', { class: 'result-code', style: { maxHeight: '300px' } });
      out.el.querySelector('pre').style.display = 'none';
      out.el.appendChild(outWrap);
      let currentOut = '';
      const statBox = h('div', { class: 'stat' });
      const errBox = h('div', {});
      let indent = 2;

      function setOut(text, isJson) {
        currentOut = text;
        if (isJson !== false) {
          outWrap.innerHTML = highlight(text);
        } else outWrap.textContent = text;
      }

      function withData() {
        const str = input.value.trim();
        if (!str) { DK.toast('请先输入 JSON', 'err'); return { ok: false }; }
        const r = parseJSONWithPos(str);
        if (!r.ok) {
          errBox.innerHTML = '';
          errBox.appendChild(h('div', { class: 'tip warn', html: '<b>JSON 语法错误</b>（第 ' + r.line + ' 行，第 ' + r.col + ' 列）：<br>' + DK.esc(r.error) }));
          outWrap.innerHTML = '';
          currentOut = '';
          return { ok: false };
        }
        errBox.innerHTML = '';
        return r;
      }

      function showStats(data) {
        const s = stats(data);
        const bytes = new Blob([input.value]).size;
        statBox.innerHTML = '节点 <b>' + s.nodes + '</b> · 深度 <b>' + s.depth + '</b> · 最大数组 <b>' + s.maxArr + '</b> · 体积 <b>' + (bytes / 1024).toFixed(2) + ' KB</b>';
      }

      const ops = [
        ['格式化', () => { const r = withData(); if (!r.ok) return; setOut(JSON.stringify(r.data, null, indent || 0)); showStats(r.data); }, true],
        ['压缩', () => { const r = withData(); if (!r.ok) return; setOut(JSON.stringify(r.data)); }, true],
        ['键排序', () => { const r = withData(); if (!r.ok) return; setOut(JSON.stringify(sortKeys(r.data, true), null, indent || 0)); }, true],
        ['键倒序', () => { const r = withData(); if (!r.ok) return; setOut(JSON.stringify(sortKeys(r.data, false), null, indent || 0)); }, true],
        ['转义', () => {
          const r = withData(); if (!r.ok) return;
          setOut(JSON.stringify(JSON.stringify(r.data, null, indent || 0)).slice(1, -1), false);
        }],
        ['去转义', () => {
          let s = input.value.trim();
          if (!s) return;
          s = s.replace(/^["']+|["']+$/g, '');
          try { s = JSON.parse('"' + s.replace(/"/g, '\\"') + '"'); } catch (e) { /* 不是标准转义串则原样输出 */ }
          setOut(s, false);
          try { showStats(JSON.parse(s)); } catch (e) {}
        }],
        ['转 TypeScript', () => { const r = withData(); if (!r.ok) return; setOut(toTS(r.data, 'Root'), false); }],
        ['转 YAML', () => { const r = withData(); if (!r.ok) return; setOut(toYAML(r.data), false); }]
      ];

      const btns = h('div', { class: 'row' },
        ops.map(([label, fn], i) => h('button', { class: 'btn' + (i === 0 ? ' primary' : ''), text: label, onclick: fn })));
      btns.appendChild(h('button', { class: 'btn', text: '示例', onclick: () => {
        input.value = JSON.stringify({ code: 0, msg: '成功', data: { list: [{ id: 1, name: '商品A', price: 99.5, tags: ['新品', 'hot'], seller: { id: 88, nickname: '小店' } }], total: 1, hasMore: false } }, null, 2);
        input.dispatchEvent(new Event('input'));
      } }));

      const indentSel = h('select', { class: 'sel', onchange: e => { indent = +e.target.value; } },
        [h('option', { value: '2', text: '缩进 2 空格' }), h('option', { value: '4', text: '缩进 4 空格' }), h('option', { value: '0', text: '紧凑' })]);
      btns.appendChild(indentSel);

      // JSONPath 取值
      const pathInput = h('input', { class: 'ti', style: { flex: '1', height: '30px' }, placeholder: 'JSONPath 取值，如：$.data.list[0].name' });
      const pathBtn = h('button', { class: 'btn', text: '取值', onclick: () => {
        const r = withData(); if (!r.ok) return;
        const v = getPath(r.data, pathInput.value);
        setOut(v === undefined ? '（路径无结果）' : (typeof v === 'object' ? JSON.stringify(v, null, indent || 0) : String(v)), typeof v === 'object');
      } });
      const pathRow = h('div', { class: 'row', style: { marginTop: '10px' } }, [pathInput, pathBtn]);

      input.addEventListener('input', DK.debounce(() => {
        const str = input.value.trim();
        if (!str) { outWrap.innerHTML = ''; currentOut = ''; statBox.innerHTML = ''; errBox.innerHTML = ''; return; }
        const r = parseJSONWithPos(str);
        if (r.ok) { errBox.innerHTML = ''; setOut(JSON.stringify(r.data, null, indent)); showStats(r.data); }
        else {
          errBox.innerHTML = '';
          errBox.appendChild(h('div', { class: 'tip warn', html: '<b>JSON 语法错误</b>（第 ' + r.line + ' 行，第 ' + r.col + ' 列）：<br>' + DK.esc(r.error) }));
        }
      }, 300));

      body.appendChild(input);
      body.appendChild(btns);
      body.appendChild(statBox);
      body.appendChild(errBox);
      body.appendChild(out.el);
      body.appendChild(pathRow);
    }
  });
})();
