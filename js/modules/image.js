/* 图片工具：本地转 Base64 / 压缩（canvas，全部离线） */
DK.registerTool({
  id: 'image',
  name: '图片工具',
  icon: '图',
  desc: '图片转 Base64 · 本地压缩(改宽/质量/格式) · 预览复制',
  render(body) {
    const { h } = DK;
    const fmt = (b) => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';

    body.appendChild(h('div', { class: 'tip', html:
      '<b>纯本地处理</b>：图片不离开浏览器，适合内网环境处理截图与设计稿切图。转 Base64 或压缩后直接复制使用。' }));

    const drop = h('div', { class: 'drop-zone' }, [
      h('div', { class: 'muted', text: '点击选择图片，或把图片拖到这里' })
    ]);
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (f) handleFile(f);
    });

    const preview = h('img', { class: 'img-preview', style: { display: 'none' } });
    const meta = h('div', { class: 'stat' });

    // 输出选项
    const maxWidth = h('input', { class: 'ti', type: 'number', value: '0', min: '0', style: { width: '90px', height: '30px' }, title: '0 = 保持原尺寸' });
    const quality = h('input', { class: 'ti', type: 'number', value: '0.8', min: '0.1', max: '1', step: '0.05', style: { width: '70px', height: '30px' } });
    const outFmt = h('select', { class: 'sel', style: { height: '30px' } },
      ['image/png', 'image/jpeg', 'image/webp'].map(t => h('option', { value: t, text: { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' }[t] })));
    const opts = h('div', { class: 'row', style: { margin: '10px 0' } }, [
      h('label', { class: 'muted', text: '目标宽度(px,0=原始)' }), maxWidth,
      h('label', { class: 'muted', text: '质量' }), quality, outFmt,
      h('button', { class: 'btn primary', text: '转换', onclick: () => current && process(current) })
    ]);

    const out = DK.resultBlock('Base64 / Data URI', () => lastOut);
    let lastOut = '';
    const outPre = out.pre;
    outPre.style.whiteSpace = 'pre-wrap';
    outPre.style.wordBreak = 'break-all';
    outPre.style.maxHeight = '140px';

    const cssOut = DK.resultBlock('CSS / HTML 用法', () => lastCss);
    let lastCss = '';

    let current = null; // {img, w, h, size, name}

    function handleFile(f) {
      if (!/^image\//.test(f.type)) { DK.toast('请选择图片文件', 'err'); return; }
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          current = { img, w: img.naturalWidth, h: img.naturalHeight, size: f.size, name: f.name };
          preview.src = img.src;
          preview.style.display = 'block';
          meta.innerHTML = '<b>' + DK.esc(f.name) + '</b> · ' + img.naturalWidth + '×' + img.naturalHeight +
            ' · ' + fmt(f.size) + ' · ' + DK.esc(f.type);
          process(current);
        };
        img.src = String(r.result);
      };
      r.readAsDataURL(f);
    }

    function process(cur) {
      const w = Math.max(0, +maxWidth.value || 0);
      const q = Math.min(1, Math.max(0.1, +quality.value || 0.8));
      const type = outFmt.value;
      const scale = w > 0 && w < cur.w ? w / cur.w : 1;
      const tw = Math.round(cur.w * scale), th = Math.round(cur.h * scale);
      const cv = document.createElement('canvas');
      cv.width = tw; cv.height = th;
      const ctx = cv.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th); }
      ctx.drawImage(cur.img, 0, 0, tw, th);
      let uri;
      try { uri = cv.toDataURL(type, q); }
      catch (e) { uri = cv.toDataURL('image/png'); DK.toast('该格式不可用，已输出 PNG', 'err'); }
      lastOut = uri;
      outPre.textContent = uri.slice(0, 5000) + (uri.length > 5000 ? '\n…（共 ' + uri.length.toLocaleString() + ' 字符，点右上「复制」取全文）' : '');
      const bytes = Math.round((uri.length - uri.indexOf(',') - 1) * 3 / 4);
      meta.innerHTML += '<br>输出：' + tw + '×' + th + ' · ' + fmt(bytes) +
        '（Base64 后为源文件 ' + Math.round(bytes / cur.size * 100) + '%）';
      lastCss = '/* CSS */\nbackground-image: url(' + uri.slice(0, 60) + '...);\n\n/* HTML */\n<img src="' + uri.slice(0, 60) + '..." alt="">';
      cssOut.pre.textContent = '完整 CSS/HTML 已含在 Base64 输出中，直接复制替换即可。';
      cssOut.pre.style.color = 'var(--text2)';
    }

    body.appendChild(drop);
    body.appendChild(fileInput);
    body.appendChild(preview);
    body.appendChild(meta);
    body.appendChild(opts);
    body.appendChild(out.el);
    body.appendChild(cssOut.el);
  }
});
