/* 命名转换库：中文/英文 -> 各类前端命名风格。依赖 DKTranslate。 */
(function () {
  'use strict';

  function words(input) {
    let s = (input || '').trim();
    if (!s) return [];
    // 先走词典+拼音
    let list = window.DKTranslate.zhToWords(s);
    if (!list.length) {
      // 纯英文/混合输入：按常见分隔符与驼峰切分
      list = s.replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_\-./\\,;:|]+/)
        .map(w => w.trim()).filter(Boolean);
    }
    return list.map(w => w.toLowerCase()).filter(Boolean);
  }

  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  const STYLES = {
    camelCase: list => list.map((w, i) => i ? cap(w) : w).join(''),
    PascalCase: list => list.map(cap).join(''),
    snake_case: list => list.join('_'),
    'kebab-case': list => list.join('-'),
    CONSTANT_CASE: list => list.join('_').toUpperCase(),
    '小写直连': list => list.join(''),
    '拼音驼峰': list => {
      // 无词典命中时退化为拼音
      const py = window.DKTranslate.toPinyin((input0 || ''));
      return py.length ? py[0] + py.slice(1).map(cap).join('') : '';
    }
  };

  let input0 = '';

  function convert(input) {
    input0 = (input || '').trim();
    const list = words(input0);
    if (!list.length) return null;
    const out = { words: list };
    Object.keys(STYLES).forEach(k => { out[k] = STYLES[k](list); });
    // 常用工程命名
    out.suggestions = {
      vue组件: out.PascalCase + '.vue',
      react组件: out.PascalCase + '.tsx',
      文件名: out['kebab-case'],
      css类: out['kebab-case'],
      布尔: 'is' + out.PascalCase,
      事件: 'on' + out.PascalCase,
      获取方法: 'get' + out.PascalCase,
      设置方法: 'set' + out.PascalCase,
      状态: out.camelCase + 'Status',
      列表: out.camelCase + 'List',
      接口: 'fetch' + out.PascalCase
    };
    return out;
  }

  window.DKNaming = { convert, words };
})();
