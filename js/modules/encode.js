/* 编解码工具：Base64 / URL / HTML实体 / Unicode / JWT / 哈希 / 进制 */

/* MD5 实现已抽到 js/lib/md5.js */

DK.registerTool({
  id: 'encode',
  name: '编解码',
  icon: '码',
  desc: 'Base64 · URL · HTML 实体 · Unicode · JWT · MD5/SHA · 进制转换',
  render(body) {
    const { h } = DK;
    const input = h('textarea', { class: 'ta', style: { minHeight: '90px' }, placeholder: '输入要编码 / 解码的文本…' });
    const out = DK.resultBlock('结果', () => lastOut);
    let lastOut = '';

    function show(v) { lastOut = v; out.pre.textContent = v; }

    const b64url = h('input', { type: 'checkbox' });
    const b64Label = h('label', { style: { fontSize: '12px', color: 'var(--text2)', cursor: 'pointer' } }, [b64url, ' URL-Safe']);

    const enc = {
      b64e: () => {
        let r = btoa(unescape(encodeURIComponent(input.value)));
        if (b64url.checked) r = r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        show(r);
      },
      b64d: () => {
        try {
          let s = input.value.trim().replace(/-/g, '+').replace(/_/g, '/');
          while (s.length % 4) s += '=';
          show(decodeURIComponent(escape(atob(s))));
        } catch (e) { DK.toast('Base64 解码失败', 'err'); }
      },
      urle: () => show(encodeURIComponent(input.value)),
      urld: () => { try { show(decodeURIComponent(input.value.trim())); } catch (e) { DK.toast('URL 解码失败', 'err'); } },
      htmle: () => show(input.value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))),
      htmld: () => {
        const parsed = new DOMParser().parseFromString(input.value, 'text/html');
        show(parsed.documentElement.textContent || '');
      },
      unie: () => show(input.value.split('').map(c => {
        const code = c.codePointAt(0).toString(16);
        return code.length > 4 ? '\\u{' + code + '}' : '\\u' + code.padStart(4, '0');
      }).join('')),
      unid: () => {
        try { show(input.value.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16)))); }
        catch (e) { DK.toast('解码失败', 'err'); }
      }
    };

    async function hash(alg) {
      const s = input.value;
      if (!s) return;
      if (alg === 'MD5') return show(dkMD5(s));
      const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(s));
      show([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''));
    }

    function jwt() {
      const t = input.value.trim();
      const parts = t.split('.');
      if (parts.length < 2) { DK.toast('不是有效的 JWT', 'err'); return; }
      const dec = p => { try { return JSON.stringify(JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))), null, 2); } catch (e) { return '（解码失败）'; } };
      let out = 'Header:\n' + dec(parts[0]) + '\n\nPayload:\n' + dec(parts[1]);
      if (parts[2]) {
        try {
          const payload = JSON.parse(dec(parts[1]));
          if (payload.exp) {
            const left = payload.exp * 1000 - Date.now();
            out += '\n\n过期状态: ' + (left > 0 ? '未过期，剩余 ' + Math.floor(left / 1000 / 60) + ' 分钟' : '已过期 ' + Math.floor(-left / 1000 / 60) + ' 分钟');
          }
        } catch (e) {}
      }
      show(out);
    }

    // 进制转换
    function radixRow() {
      const inp = h('input', { class: 'ti', style: { flex: '2', height: '30px' }, placeholder: '数值' });
      const from = h('select', { class: 'sel' }, [2, 8, 10, 16, 36].map(r => h('option', { value: String(r), text: r + ' 进制' })));
      const result = h('span', { class: 'muted' });
      inp.addEventListener('input', DK.debounce(() => {
        const n = parseInt(inp.value.trim(), +from.value);
        if (isNaN(n)) { result.textContent = '无效数字'; return; }
        result.textContent = '二 ' + n.toString(2) + ' · 八 ' + n.toString(8) + ' · 十 ' + n + ' · 十六 ' + n.toString(16).toUpperCase() + ' · 36进制 ' + n.toString(36).toUpperCase();
      }, 150));
      return h('div', { class: 'row' }, [inp, from, result]);
    }

    const btn = (label, fn) => h('button', { class: 'btn', text: label, onclick: fn });
    body.appendChild(input);
    body.appendChild(h('div', { class: 'row' }, [
      btn('Base64 编码', enc.b64e), btn('Base64 解码', enc.b64d), b64Label
    ]));
    body.appendChild(h('div', { class: 'row' }, [
      btn('URL 编码', enc.urle), btn('URL 解码', enc.urld),
      btn('HTML 转义', enc.htmle), btn('HTML 还原', enc.htmld)
    ]));
    body.appendChild(h('div', { class: 'row' }, [
      btn('Unicode 转义', enc.unie), btn('Unicode 还原', enc.unid),
      btn('解析 JWT', jwt)
    ]));
    body.appendChild(h('div', { class: 'row' }, [
      btn('MD5', () => hash('MD5')), btn('SHA-1', () => hash('SHA-1')),
      btn('SHA-256', () => hash('SHA-256')), btn('SHA-512', () => hash('SHA-512'))
    ]));
    body.appendChild(out.el);
    body.appendChild(h('div', { class: 'muted', style: { margin: '14px 0 6px' }, text: '进制转换' }));
    body.appendChild(radixRow());
  }
});
