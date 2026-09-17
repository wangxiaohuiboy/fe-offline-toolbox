/* 命名转换库：中文/英文 -> 各类前端命名风格。依赖 DKTranslate。 */
(function () {
  'use strict';

  function words(input) {
    let text = (input || '').trim();
    if (!text) return [];
    // 先走词典+拼音
    let wordList = window.DKTranslate.zhToWords(text);
    if (!wordList.length) {
      // 纯英文/混合输入：按常见分隔符与驼峰切分
      wordList = text.replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_\-./\\,;:|]+/)
        .map(word => word.trim()).filter(Boolean);
    }
    return wordList.map(word => word.toLowerCase()).filter(Boolean);
  }

  function capitalize(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

  const STYLES = {
    camelCase: wordList => wordList.map((word, index) => index ? capitalize(word) : word).join(''),
    PascalCase: wordList => wordList.map(capitalize).join(''),
    snake_case: wordList => wordList.join('_'),
    'kebab-case': wordList => wordList.join('-'),
    CONSTANT_CASE: wordList => wordList.join('_').toUpperCase(),
    lowerJoined: wordList => wordList.join(''),
    pinyinCamel: wordList => {
      // 无词典命中时退化为拼音
      const pinyin = window.DKTranslate.toPinyin((rawInput || ''));
      return pinyin.length ? pinyin[0] + pinyin.slice(1).map(capitalize).join('') : '';
    }
  };

  let rawInput = '';

  function convert(input) {
    rawInput = (input || '').trim();
    const wordList = words(rawInput);
    if (!wordList.length) return null;
    const result = { words: wordList };
    Object.keys(STYLES).forEach(styleKey => { result[styleKey] = STYLES[styleKey](wordList); });
    // 常用工程命名
    result.suggestions = {
      vue组件: result.PascalCase + '.vue',
      react组件: result.PascalCase + '.tsx',
      文件名: result['kebab-case'],
      css类: result['kebab-case'],
      布尔: 'is' + result.PascalCase,
      事件: 'on' + result.PascalCase,
      获取方法: 'get' + result.PascalCase,
      设置方法: 'set' + result.PascalCase,
      状态: result.camelCase + 'Status',
      列表: result.camelCase + 'List',
      接口: 'fetch' + result.PascalCase
    };
    return result;
  }

  window.DKNaming = { convert, words };
})();
