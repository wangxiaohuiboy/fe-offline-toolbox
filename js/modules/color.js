/* 颜色工具：HEX/RGB/HSL 互转 + 色阶生成 */
DK.registerTool({
  id: 'color',
  name: '颜色工具',
  icon: '色',
  desc: 'HEX · RGB · HSL 互转 · 透明度 · 10 级色阶生成',
  render(body) {
    const { h } = DK;

    function hexToRgb(hex) {
      let s = hex.trim().replace(/^#/, '');
      if (s.length === 3) s = s.split('').map(c => c + c).join('');
      if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
      return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
    }
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let hue = 0, sat = 0;
      const light = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue /= 6;
      }
      return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(light * 100) };
    }
    function hslToRgb(hh, ss, ll) {
      hh /= 360; ss /= 100; ll /= 100;
      if (ss === 0) { const v = Math.round(ll * 255); return { r: v, g: v, b: v }; }
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
      const p = 2 * ll - q;
      const hue2rgb = (t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return {
        r: Math.round(hue2rgb(hh + 1 / 3) * 255),
        g: Math.round(hue2rgb(hh) * 255),
        b: Math.round(hue2rgb(hh - 1 / 3) * 255)
      };
    }

    const input = h('input', { class: 'ti', style: { flex: '1', fontFamily: 'var(--mono)' }, placeholder: '输入颜色：#4F5BE7 / rgb(79,91,231) / hsl(234,79%,61%)' });
    const preview = h('div', { class: 'color-preview' });
    const out = DK.resultBlock('各格式输出（点击行复制）', () => '');
    const outPre = out.pre;
    const shades = h('div', { class: 'shade-row' });
    let cur = null;

    function render() {
      const v = input.value.trim();
      let rgb = null;
      let m;
      if ((m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v))) {
        const c = hexToRgb(v); if (c) rgb = c;
      } else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v))) {
        rgb = { r: +m[1], g: +m[2], b: +m[3] };
      } else if ((m = /^hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/.exec(v))) {
        rgb = hslToRgb(+m[1], +m[2], +m[3]);
      }
      if (!rgb) { outPre.textContent = '无法识别的颜色格式'; preview.style.background = 'transparent'; shades.innerHTML = ''; return; }
      cur = rgb;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      const lines = [
        'HEX：  ' + hex,
        'RGB：  rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')',
        'RGBA： rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 1)',
        'HSL：  hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)',
        'CSS 变量： --color: ' + hex + ';'
      ];
      outPre.textContent = lines.join('\n');
      outPre.style.lineHeight = '1.9';
      preview.style.background = hex;
      // 10 级色阶
      shades.innerHTML = '';
      const shadesList = [95, 88, 76, 64, 52, 40, 32, 24, 16, 10];
      shadesList.forEach((l, i) => {
        const c = hslToRgb(hsl.h, hsl.s, l);
        const bg = rgbToHex(c.r, c.g, c.b);
        const el = h('div', { class: 'shade', style: { background: bg }, title: bg + ' · 点击复制', onclick: () => DK.copy(bg).then(() => DK.toast('已复制 ' + bg)) }, [
          h('span', { style: { color: l > 50 ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.8)' }, text: (i + 1) * 100 })
        ]);
        shades.appendChild(el);
      });
    }
    input.addEventListener('input', DK.debounce(render, 150));

    body.appendChild(h('div', { class: 'row' }, [
      input,
      h('input', { type: 'color', style: { width: '42px', height: '34px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff', padding: '2px', cursor: 'pointer' }, oninput: e => { input.value = e.target.value.toUpperCase(); render(); } })
    ]));
    body.appendChild(preview);
    body.appendChild(out.el);
    body.appendChild(shades);

    input.value = '#4F5BE7';
    render();
  }
});
