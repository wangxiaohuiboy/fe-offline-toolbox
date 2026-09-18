/* 随机工具：UUID / NanoID / 密码 / 随机数 / 占位文本 */
DK.registerTool({
  id: 'random',
  name: '随机生成',
  icon: '骰',
  desc: 'UUID v4 · NanoID · 随机密码 · 随机数 · 中英占位文本',
  render(body) {
    const { h } = DK;
    const out = DK.resultBlock('生成结果', () => '');
    const outPre = out.pre;
    const countInput = h('input', { class: 'ti', type: 'number', value: 5, min: 1, max: 500, style: { width: '70px', height: '30px' } });

    function count() { return Math.max(1, Math.min(500, +countInput.value || 1)); }

    function uuidV4() {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }
    function secureRandomIndex(max) {
      if (max <= 0) return 0;
      const limit = Math.floor(0x100000000 / max) * max;
      const buffer = new Uint32Array(1);
      let value;
      do { crypto.getRandomValues(buffer); value = buffer[0]; } while (value >= limit);
      return value % max;
    }

    function pickRandom(pool) {
      return pool.charAt(secureRandomIndex(pool.length));
    }

    function nanoId(len) {
      const alphabet = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict';
      return Array.from({ length: len }, () => pickRandom(alphabet)).join('');
    }

    const pwLen = h('input', { class: 'ti', type: 'number', value: 16, min: 6, max: 64, style: { width: '60px', height: '30px' } });
    const pwOpt = (label, checked) => h('label', { style: { fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' } }, [
      h('input', { type: 'checkbox', checked }), label
    ]);
    const [optU, optL, optD, optS] = [pwOpt('大写', true), pwOpt('小写', true), pwOpt('数字', true), pwOpt('符号', false)];

    function genPassword() {
      const pools = [];
      if (optU.firstChild.checked) pools.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
      if (optL.firstChild.checked) pools.push('abcdefghijkmnpqrstuvwxyz');
      if (optD.firstChild.checked) pools.push('23456789');
      if (optS.firstChild.checked) pools.push('!@#$%^&*()-_=+[]{};:,.<>?');
      if (!pools.length) { DK.toast('请至少选择一种字符', 'err'); return; }
      const pool = pools.join('');
      const length = Math.max(pools.length, +pwLen.value || 16);
      const outLines = [];
      for (let index = 0; index < count(); index++) {
        const characters = pools.map(pickRandom);
        while (characters.length < length) characters.push(pickRandom(pool));
        for (let position = characters.length - 1; position > 0; position--) {
          const swapIndex = secureRandomIndex(position + 1);
          [characters[position], characters[swapIndex]] = [characters[swapIndex], characters[position]];
        }
        outLines.push(characters.join(''));
      }
      outPre.textContent = outLines.join('\n');
    }

    function randomNums() {
      outPre.textContent = Array.from({ length: count() }, () => secureRandomIndex(100000)).join('\n');
    }

    const LOREM_CN = '这是一个占位文本用于在内网环境下快速填充界面内容测试布局效果无需依赖任何外部服务所有数据均在本地生成保证内网可用性同时支持自定义长度与段落数量方便前端同学快速搭建页面原型';
    function lorem() {
      const n = count();
      const paras = [];
      for (let i = 0; i < Math.min(n, 10); i++) {
        let s = '';
        const len = 60 + Math.floor(Math.random() * 60);
        while (s.length < len) s += LOREM_CN[Math.floor(Math.random() * LOREM_CN.length)];
        paras.push(s + '。');
      }
      outPre.textContent = paras.join('\n\n');
    }

    const btn = (t, fn, primary) => h('button', { class: 'btn' + (primary ? ' primary' : ''), text: t, onclick: fn });
    body.appendChild(h('div', { class: 'row' }, [
      h('label', { class: 'muted', text: '数量' }), countInput,
      btn('UUID v4', () => { outPre.textContent = Array.from({ length: count() }, uuidV4).join('\n'); }, true),
      btn('NanoID (21位)', () => { outPre.textContent = Array.from({ length: count() }, () => nanoId(21)).join('\n'); }),
      btn('中占位文本', lorem)
    ]));
    body.appendChild(h('div', { class: 'row' }, [
      h('label', { class: 'muted', text: '密码长度' }), pwLen,
      optU, optL, optD, optS,
      btn('生成密码', genPassword)
    ]));
    body.appendChild(h('div', { class: 'row' }, [btn('随机整数(0-99999)', randomNums)]));
    body.appendChild(out.el);
  }
});
