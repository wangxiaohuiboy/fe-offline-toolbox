/* 正则测试：实时匹配高亮 / 分组 / 替换预览 / 常用正则库 */
DK.registerTool({
  id: 'regex',
  name: '正则测试',
  icon: '.*',
  desc: '实时匹配 · 分组捕获 · 替换预览 · 常用正则库',
  render(body) {
    const { h } = DK;
    const patInput = h('input', { class: 'ti', style: { flex: '2', fontFamily: 'var(--mono)' }, placeholder: '正则表达式，如：\\d+' });
    const flagInput = h('input', { class: 'ti', style: { width: '70px', fontFamily: 'var(--mono)' }, value: 'g', placeholder: '标志' });
    const testInput = h('textarea', { class: 'ta', placeholder: '测试文本…' });
    const out = DK.resultBlock('匹配结果', () => '');
    const outPre = out.pre;
    const replaceInput = h('input', { class: 'ti', style: { flex: '1', fontFamily: 'var(--mono)' }, placeholder: '替换为（支持 $1 $2）' });
    const repOut = DK.resultBlock('替换预览', () => '');
    const repPre = repOut.pre;
    const stat = h('div', { class: 'stat' });
    const errTip = h('div', {});

    function run() {
      errTip.innerHTML = '';
      outPre.textContent = '';
      repPre.textContent = '';
      stat.innerHTML = '';
      const pat = patInput.value;
      const text = testInput.value;
      if (!pat || !text) return;
      let re;
      try {
        let flags = flagInput.value.replace(/[^gimsuy]/g, '');
        if (!flags.includes('g')) flags += 'g';
        re = new RegExp(pat, flags);
      } catch (e) {
        errTip.appendChild(h('div', { class: 'tip warn', text: '正则语法错误：' + e.message }));
        return;
      }
      const matches = [...text.matchAll(re)];
      if (!matches.length) { outPre.textContent = '（无匹配）'; return; }
      stat.innerHTML = '匹配 <b>' + matches.length + '</b> 处';
      // 高亮显示
      let html = '';
      let last = 0;
      const esc = DK.esc;
      for (const m of matches) {
        if (m.index > last) html += esc(text.slice(last, m.index));
        html += '<mark style="background:#fff3bf;border-radius:3px;padding:0 1px;">' + esc(m[0]) + '</mark>';
        last = m.index + (m[0].length || 1);
      }
      html += esc(text.slice(last));
      outPre.innerHTML = html || '（空匹配）';
      // 分组详情
      const groups = matches.slice(0, 50).map((m, i) => {
        let s = '[' + i + '] ' + JSON.stringify(m[0]) + ' @' + m.index;
        if (m.length > 1) {
          for (let g = 1; g < m.length; g++) {
            const name = m.groups && Object.keys(m.groups).find(k => m.groups[k] === m[g]);
            s += '  $' + g + '=' + JSON.stringify(m[g]);
            if (name) s += '（' + name + '）';
          }
        }
        return s;
      });
      out.el.appendChild(h('div', { class: 'result-pre', style: { maxHeight: '150px', borderTop: '1px solid var(--border)', color: 'var(--text2)', fontSize: '11.5px' }, text: groups.join('\n') }));
      // 替换预览
      if (replaceInput.value) {
        try { repPre.textContent = text.replace(re, replaceInput.value); } catch (e) { repPre.textContent = e.message; }
      }
    }

    replaceInput.addEventListener('input', DK.debounce(run, 200));
    [patInput, flagInput].forEach(el => el.addEventListener('input', DK.debounce(run, 200)));
    testInput.addEventListener('input', DK.debounce(run, 200));

    const LIB = [
      ['手机号', '^1[3-9]\\d{9}$'],
      ['邮箱', '[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}'],
      ['身份证(18位)', '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]'],
      ['URL', 'https?://[^\\s"\'<>]+'],
      ['IPv4', '(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'],
      ['中文', '[\\u4e00-\\u9fa5]+'],
      ['HTML 标签', '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)</\\1>'],
      ['十六进制颜色', '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b'],
      ['日期 YYYY-MM-DD', '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])'],
      ['时间 HH:mm:ss', '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?'],
      ['千分位', '\\B(?=(\\d{3})+(?!\\d))'],
      ['空白行', '^\\s*$'],
      ['img src', '<img[^>]+src=["\\\']([^"\\\']+)["\\\']'],
      ['密码强度(8-20位大小写数字)', '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[\\S]{8,20}$']
    ];
    const libBox = h('div', { class: 'cheat-grid', style: { marginTop: '12px' } });
    LIB.forEach(([name, re]) => {
      libBox.appendChild(h('div', { class: 'cheat-item', onclick: () => { patInput.value = re; run(); DK.toast('已填入：' + name); } }, [
        h('code', { text: re }),
        h('span', { class: 'd', text: name })
      ]));
    });

    body.appendChild(h('div', { class: 'row' }, [patInput, flagInput]));
    body.appendChild(testInput);
    body.appendChild(stat);
    body.appendChild(errTip);
    body.appendChild(out.el);
    body.appendChild(h('div', { class: 'row', style: { margin: '10px 0 4px' } }, [replaceInput]));
    body.appendChild(repOut.el);
    body.appendChild(h('div', { class: 'muted', style: { margin: '14px 0 6px' }, text: '常用正则库（点击填入）' }));
    body.appendChild(libBox);

    patInput.value = '[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}';
    testInput.value = '联系 test@example.com 或 admin@corp.cn，工单号 #1024，日期 2026-09-16。';
    run();
  }
});
