/* Node 冒烟测试：模拟 window 环境跑核心库 */
global.window = global;
require('../js/lib/pinyin.data.js');
require('../js/lib/dict.data.js');
require('../js/lib/dict.big.js');
require('../js/lib/translate-core.js');
require('../js/lib/naming.js');
require('../js/lib/core.js');

const assert = require('assert');
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '  →  ' + e.message); }
}

const st = DKTranslate.dictStats();
console.log('== 词典规模 == 总计 ' + st.total + ' 条（精编 ' + st.curated + ' + 扩充 ' + (st.total - st.curated) + '），拼音 ' + st.pinyin + ' 字');

console.log('== 翻译引擎 ==');
t('词典已加载(>10000条)', () => assert(DKTranslate.dictSize() > 10000, '实际: ' + DKTranslate.dictSize()));
t('中→英: 用户', () => assert.strictEqual(DKTranslate.translate('用户').text, 'user'));
t('中→英: 数据', () => assert.strictEqual(DKTranslate.translate('数据').text, 'data'));
t('中→英: 订单(精编优先)', () => assert.strictEqual(DKTranslate.translate('订单').text, 'order'));
t('中→英: 部署(精编优先)', () => assert.ok(/deploy/.test(DKTranslate.translate('部署').text)));
t('中→英: 用户列表', () => {
  const r = DKTranslate.translate('用户列表');
  assert.ok(/user/.test(r.text) && /list/.test(r.text), r.text);
});
t('中→英: 商品详情页', () => {
  const r = DKTranslate.translate('商品详情页');
  assert.ok(/product|detail/.test(r.text.toLowerCase()), r.text);
});
t('未收录词保留中文、不输出拼音', () => {
  const r = DKTranslate.translate('这是一个不存在于词典中的生僻组合词凑字');
  assert.ok(!/^[a-z ]+$/.test(r.text) || /[a-zA-Z]/.test(r.text), r.text);
  assert.ok(r.missing.length > 0, '应报告未收录');
  assert.ok(r.coverage < 1, 'coverage 应 < 1');
  // 关键：未收录部分不应是拼音
  const py = DKTranslate.toPinyin('凑字');
  py.forEach(p => assert.ok(!new RegExp('\\b' + p + '\\b').test(r.text), '不应出现拼音 ' + p + ' → ' + r.text));
});
t('未收录开关：开启后才用拼音', () => {
  const r = DKTranslate.translate('凑字', { pinyinFallback: true });
  assert.ok(/cou|zi/.test(r.text), r.text);
});
t('命中率统计正确', () => {
  const r = DKTranslate.translate('用户列表');
  assert.ok(r.coverage > 0.9, 'coverage=' + r.coverage);
  assert.strictEqual(r.zhHit, 4);
});
t('英→中: user', () => assert.strictEqual(DKTranslate.translate('user').text, '用户'));
t('英→中: user list', () => assert.strictEqual(DKTranslate.translate('user list').text, '用户列表'));
t('英→中 复数: users', () => assert.strictEqual(DKTranslate.translate('users').text, '用户'));
t('英→中 短语: shopping cart', () => {
  const r = DKTranslate.translate('shopping cart');
  assert.ok(r.text.includes('购物车'), r.text);
});
t('英→中 扩充词: apple', () => assert.ok(/苹果/.test(DKTranslate.translate('apple').text)));

console.log('== 命名转换 ==');
t('用户订单列表 → camelCase', () => {
  const r = DKNaming.convert('用户订单列表');
  assert.ok(/user/i.test(r.camelCase) && /order/i.test(r.camelCase) && /list/i.test(r.camelCase), r.camelCase);
  console.log('    → camelCase: ' + r.camelCase + ' | Pascal: ' + r.PascalCase + ' | snake: ' + r.snake_case);
});
t('扩充词典也参与命名: 购物车结算', () => {
  const r = DKNaming.convert('购物车结算');
  assert.ok(/cart|shopping/i.test(r.camelCase), r.camelCase);
  console.log('    → ' + r.camelCase);
});
t('英文混合输入', () => {
  const r = DKNaming.convert('user-order detail');
  assert.ok(r && r.PascalCase.length > 0, JSON.stringify(r));
});
t('纯中文无词典时拼音兜底', () => {
  const r = DKNaming.convert('饕餮');
  assert.ok(r && r.camelCase.length > 0, '无输出');
  console.log('    → ' + r.camelCase);
});

console.log('== 拼音数据 ==');
t('常用字拼音', () => {
  assert.strictEqual(DKTranslate.toPinyin('订单支付').join('-'), 'ding-dan-zhi-fu');
});
t('拼音兜底(GB2312 生僻字)', () => {
  const py = DKTranslate.toPinyin('褶');
  assert.ok(py.length && py[0] === 'zhe', py.join(','));
});

console.log('== MD5 ==');
require('../js/lib/md5.js');
t('MD5 向量', () => {
  assert.strictEqual(window.dkMD5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.strictEqual(window.dkMD5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.strictEqual(window.dkMD5('中文测试').length, 32);
});

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
