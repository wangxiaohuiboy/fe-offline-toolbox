# 前端离线工具箱（fe-offline-kit）代码评审

> 评审范围：截至 v1.5.0（神经整句翻译引入后）的全部手写源码。
> 评审日期：2026-09-16
> 结论：**整体质量良好，架构清晰，离线目标达成。手写逻辑约 5.8k 行**；所谓"超 1 万行"中 7.68 万行是自动生成的 `dict.big.js`（ECDICT 衍生数据），非手写代码。以下按严重程度列出问题并给出可落地建议。

---

## 0. 规模与结构总览

| 类别 | 行数 | 说明 |
|---|---|---|
| `js/lib/dict.big.js` | 76,798 | 自动生成，勿手改 |
| `js/lib/dict.data.js` | 1,363 | 团队精编词典 |
| 其余 `js/**`（除大词典） | ~5,140 | 手写引擎 + 21 个工具模块 |
| `tools/**`（Python/JS） | ~720 | 构建 / 推送 / 测试脚本 |

目录职责清晰：`js/lib/` 放零依赖引擎（翻译、命名、MD5、核心工具），`js/modules/` 每个工具一个 IIFE 注册到 `DK.tools`，`content/` 划词脚本，`background.js` Service Worker。单文件职责单一，耦合度低。

---

## 1. 架构亮点（值得保留）

- **翻译引擎纯函数化、零依赖**：`translate-core.js` 全部为纯逻辑，已有 `tools/smoke.test.js` 共 38 条断言且全部通过，覆盖中→英/英→中/复数/短语/口语/命名/拼音/MD5。
- **`REDGE_LOCK` 反查锁定机制**：精编词典锁定的英文词，扩充词典永不覆盖，从根本上挡住了"加下标次序=is""项目=item""前端=fringe"这类机翻噪声抢注。设计巧妙。
- **面板级错误兜底**（`app.js` 全局 `error`/`unhandledrejection` → `fatal()`）：任何脚本异常都会显示在页面上，不会静默白屏，利于现场排障。
- **MV3 合规到位**：CSP 含 `'wasm-unsafe-eval'`；神经翻译明确 `numThreads=1` 规避扩展页无 `SharedArrayBuffer` 的限制；`web_accessible_resources` 仅暴露必要资源。
- **内容脚本防护**：`__dkContentReady` 防重复注入；大词典（1.7MB）按需 `ensureData()` 懒加载而非每个网页静态注入。
- **`push_api.py` 设计精巧**：blob 去重、`git commit-tree` 重建以对齐 SHA、>200KB 走临时文件规避 macOS `ARG_MAX`、代理路径过滤自动大小写绕过。

---

## 2. 功能缺陷 / 高风险（建议优先处理）

### 🔴 H1. 神经翻译依赖未进 git，首次使用会静默失败
- 位置：`manifest.json` 未列 `models/`、`js/lib/ort/*`、`js/lib/transformers/*`；`.gitignore` 明确排除这些文件（约 110MB+57MB）。
- 问题：新克隆仓库点"神经翻译"时，`getNeuralPipe` 会因为 `chrome.runtime.getURL('models/...')` 404 而抛错，仅弹 toast。用户无法从 UI 得知"需要先下载模型"。
- 建议：
  1. 在 `getNeuralPipe` 捕获异常时检测文件是否存在（用 `fetch` HEAD 或 `chrome.runtime.getPackageDirectoryEntry`），缺失则给出明确引导："首次使用请运行 `tools/download_models.sh`"。
  2. README 的"离线翻译"小节已提到下载脚本，但应在"神经翻译"按钮首次出现时加一行提示文案（现状 tooltip 已说"首次加载较慢"，需补"若报错请先下载模型"）。

### 🔴 H2. 神经模型加载绑定在面板窗口上下文，关闭即中断
- 位置：`js/modules/translate.js` `getNeuralPipe` / `neuralTranslate`（模型与推理都在 `app.html` 面板页执行）。
- 问题：模型加载约 10–30 秒，若用户在此期间关闭 popup 面板窗口，页面上下文被销毁，加载/推理中断且无提示；重复打开需重新加载。
- 建议（架构级改进，可选）：将神经翻译移到 **Offscreen Document** 或在 `background.js` Service Worker 中常驻加载（MV3 允许 SW 内运行 WASM/ONNX），面板只发消息取结果，跨窗口共享、不随面板关闭而失效。

---

## 3. 中等问题（影响体验 / 健壮性）

### 🟡 M1. `suggestZh` 全量线性扫描，长词典下会卡顿
- 位置：`js/lib/translate-core.js:323` `suggestZh(prefix)` 对 `DICT`（7.6 万条）逐条 `k.startsWith || k.includes`，每次按键触发（已 150ms 防抖）。
- 影响：慢机上每次约 10–50ms，连续输入有掉帧风险。
- 建议：构建前缀索引（如按首字/首字母分桶），或限制返回 30 条后提前 `break`（当前逻辑已 `break`，但扫描仍是 O(n)），或只在 `length>=2` 时启用搜索。

### 🟡 M2. 大词典在每个网页惰性加载 1.7MB，多标签页重复占内存
- 位置：`content/content.js:14` `ensureData()` 动态 `import('js/lib/dict.big.js')`。
- 问题：只要用户点过一次"译"按钮，整个 1.7MB 词典就常驻该标签页。开 10 个网页即 ≈17MB 重复。
- 建议：划词翻译本就只用到精编词典足够覆盖高频词；可改为"未收录才按需懒加载大词典"，或把大词典放进 **Web Worker / 共享 Worker** 避免每标签页复制。

### 🟡 M3. 内网接口配置以明文存于 `chrome.storage.local`
- 位置：`js/modules/settings.js:82` `dkApi` 含 `headers`（可能带 `Authorization: Bearer`）。
- 风险：扩展本地存储明文，任何拥有 `storage` 读取能力的程序/扩展可读到 token。
- 建议：UI 提示"含密钥的配置请勿保存在共享设备"；或提供"仅本次会话"模式（不 `store.set`，存内存变量）。

### 🟡 M4. `REDGE_LOCK` 对"一词多义"的副作用缺少文档
- 位置：`js/lib/translate-core.js:9,22-24`。
- 说明：精编词典一旦锁定某英文词，大词典里该词的任何其他中文义项都无法反查（例如锁定 `project→项目` 后，大词典的 `project→工程` 失效）。这是合理取舍，但**依赖精编词条在 `dict.data.js` 中的书写顺序**决定谁先锁（`i < pri0` 才覆盖），顺序脆弱、易在后续增词时引入回归。
- 建议：在 `dict.data.js` 文件头注释明确"锁定策略 + 增词顺序约定"；新增精编词后用 `smoke.test.js` 补断言防止反查回归。

---

## 4. 低级 / 代码异味（顺手清理）

- 🟢 `js/modules/json.js:107` `return typeof x === 'number' ? Number.isInteger(x) ? 'number' : 'number';` —— 三元恒为 `'number'`，死代码/笔误，清理即可。
- 🟢 `js/modules/translate.js:158` `btn.textContent = s.slice(0, 22)` 对 CJK 进度文案做字节截断，可能截断半个汉字或显示不全；建议按"不截断 CJK"或改为状态行单独元素。
- 🟢 `js/modules/translate.js:131` 设置 `mod.env.backends.onnx.wasm.numThreads` 前未判空，若对象未初始化会抛；加 `if (mod.env.backends?.onnx?.wasm)` 防御更稳。
- 🟢 `js/modules/api.js:42` `AbortSignal.timeout` 在老旧 Chrome（<103）缺失，会传 `undefined` 导致无超时；当前 MV3 目标基本满足，可加 `typeof AbortSignal.timeout === 'function'` 判断兜底。
- 🟢 `js/lib/naming.js:29` `'拼音驼峰'` 风格在 `convert()` 内用模块级 `input0` 重算拼音，与 `words()` 已返回的拼音列表重复；可改为直接消费 `list` 中未命中的拼音词，去掉对 `input0` 闭包的依赖（当前无 TDZ 错误，但可读性差）。

---

## 5. 离线 / 无网络保证核对

| 能力 | 是否离线 | 备注 |
|---|---|---|
| 词典直译（中↔英） | ✅ 完全离线 | 数据内联，无网络调用 |
| 划词翻译 | ✅ 完全离线 | 内容脚本本地计算 |
| 命名转换 | ✅ 完全离线 | 复用词典 + 拼音 |
| 神经整句翻译 | ✅ 模型本地 WASM | 但模型文件 gitignored，需先下载 |
| 接口调试 / 内网翻译 | ⚠️ 主动联网 | 仅用户主动发起，符合"内网联调"定位 |
| 推送脚本 `push_api.py` | ❌ 需联网 | 仅开发期用，非插件运行期 |

隐私声明（`settings.js:139`）准确：除用户主动配置的内网接口外不出网。

---

## 6. 安全 / 隐私核对

- ✅ 无 `eval` / 动态 `innerHTML` 注入用户输入（输出均经 `DK.esc` 或 `textContent`）。
- ✅ 内容脚本注入浮层用 `textContent`，不执行页面脚本。
- ✅ 接口调试走用户显式触发的 `fetch`，并引导 `chrome.permissions.request` 按需授权。
- ⚠️ 见 M3：内网接口 token 明文落盘。
- ✅ 模型/库文件虽 gitignored，但来源固定（hf-mirror / jsdelivr），`download_models.sh` 应锁定版本（现状已锁 `@huggingface/transformers@4.3.0`），建议对下载产物增加 checksum 校验以防供应链篡改。

---

## 7. `push_api.py` 专项

- 优点：blob 去重、SHA 对齐、`-d @file` 规避 `ARG_MAX`、代理伪 404 自动大小写绕过，逻辑严谨。
- 风险点：`CLOAKED_REPO` 绕过依赖"本机沙箱代理按 URL 精确过滤"这一环境特征，换环境可能失效；建议在脚本顶部加注释标明"仅适用于被代理按 URL 过滤的本地环境"，避免他人误用。
- 小建议：token 仅从 `gh auth token` 读取、不落盘，良好；可加一步 `gh auth status` 预检避免无效 token 跑到一半才报错。

---

## 8. 优先级行动清单

| 优先级 | 事项 | 预估工作量 |
|---|---|---|
| P0 | H1：神经翻译缺失文件检测 + UI 引导 | 0.5h |
| P1 | H2：神经翻译移入 Offscreen/SW（架构改进，可选） | 半天 |
| P1 | M3：内网接口 token 不持久化 / 加提示 | 0.5h |
| P2 | M1：`suggestZh` 建索引 | 1h |
| P2 | M2：大词典改为 Worker / 按需更深 | 2h |
| P2 | M4：`dict.data.js` 锁定策略注释 + 回归断言 | 0.5h |
| P3 | 清理第 4 节代码异味 | 0.5h |
| P3 | `download_models.sh` 增加 checksum 校验 | 0.5h |

---

## 9. 评审结论

代码已达到"可发布、可维护"的水平：核心翻译引擎有测试守护、离线目标严格达成、MV3 各项约束处理正确、错误不白屏。主要改进空间在于**神经翻译的首次使用引导与跨窗口加载架构**（H1/H2），以及**大词典在多标签页下的内存占用**（M2）。其余均为可顺手清理的体验/健壮性问题。建议优先做 H1 + M3，其余按节奏纳入迭代。
