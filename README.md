# 前端离线工具箱（Chrome 插件）

[English Documentation](./README_EN.md)

一个专为**内网 / 断网环境**设计的 Chrome 浏览器插件，为前端开发者提供 17 个高频提效工具。**零外部依赖**：词典、拼音表、算法、UI 全部本地打包，断网环境功能完整可用，不向任何外部地址发送数据。

## ✨ 功能总览

| 工具 | 说明 |
|------|------|
| **翻译** | 内置 **7.7 万中文词条**离线词典（团队精编术语 1270+ 条 + 基于 [ECDICT](https://github.com/skywind3000/ECDICT) 开源词典包生成的扩充词典 7.6 万条），中英双向；含日常口语与礼貌用语整句短语（如「很高兴见到你」→ nice to meet you）；未收录词**原样保留并提示命中率**（不输出拼音）；支持配置公司内网翻译接口 |
| **划词翻译** | 网页里选中文字 → 点「译」→ 悬浮卡片显示离线翻译与命中词条 |
| **中文转变量名** | 中文需求词 → camelCase / PascalCase / snake_case / kebab-case / CONSTANT，附 Vue/React 组件名、`is/on/get/set` 前缀等工程命名建议；支持批量模式；拼音兜底（内置 GB2312 全部 6763 字） |
| **JSON 工具** | 格式化（错误行列定位）、压缩、键排序、转义、JSON→TypeScript 接口、JSON→YAML、JSONPath 取值、语法高亮 |
| **接口调试** | 内网接口直接发请求（GET/POST/PUT/PATCH/DELETE）、自定义请求头/请求体、响应耗时/大小/头展示、最近 8 条历史点击回填；跨域权限按需授权 |
| **编解码** | Base64（UTF-8 安全）、URL、HTML 实体、Unicode、JWT 解析（含过期判断）、MD5/SHA1/SHA256/SHA512、进制转换 |
| **时间戳** | 实时时间戳、秒/毫秒自动识别互转、ISO/UTC、相对时间 |
| **URL 工具** | URL 解析（协议/域名/路径/锚点）、参数表格（自动解码）、参数→JSON、Query 构造器（参数拼 URL） |
| **图片工具** | 图片转 Base64（拖拽即用）、本地压缩（改宽度/质量/格式，支持 PNG/JPEG/WebP）、预览与复制 |
| **px·rem·vw** | 移动端单位换算（可调根字号/视口宽度）、常用字号速查表，点击即复制 |
| **正则测试** | 实时高亮匹配、分组捕获、替换预览、14 条常用正则库 |
| **表格转换** | CSV / TSV（Excel 直接复制）/ Markdown 表格 / JSON 数组互转，写文档、导数据即用 |
| **文本处理** | 大小写/命名风格互转、排序去重、行前后缀、全角半角、统计、行 Diff |
| **颜色工具** | HEX/RGB/HSL 互转、10 级色阶生成、取色器 |
| **随机生成** | UUID v4、NanoID、随机密码、中占位文本 |
| **Cron 解析** | 5 段式表达式 → 中文描述 + 未来 5 次执行时间 |
| **速查表** | CSS 技巧 / Git / npm / HTTP 状态码 / keyCode |
| **设置** | 团队自定义词库（翻译+命名共用，导入导出）、内网翻译接口配置、划词开关、配置备份 |

## 📥 安装（无需联网，无需商店）

1. 下载/解压本仓库（或 `fe-offline-kit.zip`）
2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 打开右上角「**开发者模式**」开关
4. 点击「**加载已解压的扩展程序**」，选择 `fe-offline-kit` 文件夹
5. **点击浏览器右上角插件图标**，会弹出可移动、可缩放的工具面板窗口（920×680）
6. 也可以：右键插件图标 →「在标签页中打开完整工具箱」；快捷键 `Ctrl/Cmd + Shift + U`

> 内网分发：直接把 zip 包发给同事，解压后按上述步骤加载即可，全程无需联网。

## 🌐 关于内网翻译的说明

纯离线模式下，翻译基于**本地词典逐词直译**：

- 未收录的词原样保留中文，并显示命中率与未收录清单；也可勾选「未收录字用拼音」
- 结构词（的/了/把/时等）自动省略，英文更通顺
- 实测示例：`用户支付订单后自动发送短信通知` → `user pay order auto send sms notification`

增强路径：

1. **团队词库**：在「设置 → 自定义词库」维护业务术语（如 `结算中心=settlement center`），翻译和命名立即生效，支持导入导出给全组分发
2. **内网翻译接口**：若公司内网有翻译服务，在「设置」中填接口地址（GET/POST、参数名、响应字段路径、请求头均可配）

## 🔒 隐私

- 所有词典查询与计算均在本地完成
- 图片处理不离开浏览器
- 仅当你主动配置内网翻译接口时，才会向**你自己填写的内网地址**发请求

## 📁 目录结构

```
fe-offline-kit/
├── manifest.json          # MV3 配置（含作者信息）
├── app.html               # 主界面（面板窗口与标签页共用）
├── background.js          # 面板窗口 / 右键菜单 / 快捷键
├── content/               # 划词翻译内容脚本
├── css/ · icons/
├── js/
│   ├── app.js             # 主控/路由/搜索
│   ├── lib/
│   │   ├── dict.data.js       # 团队精编词典（前端术语+常用词，可增补，优先级最高）
│   │   ├── dict.big.js        # 扩充词典 1.7 万条（基于 ECDICT 生成，勿手改）
│   │   ├── pinyin.data.js     # 拼音表（脚本生成，勿手改）
│   │   ├── translate-core.js  # 翻译引擎
│   │   ├── naming.js          # 命名转换
│   │   ├── md5.js / core.js   # 工具库
│   ├── modules/           # 17 个工具模块（一个文件一个工具）
└── _tools/                # 开发用脚本（词典生成/图标生成/冒烟测试），不影响使用
```

## ✏️ 增补词典

日常增补请编辑 `js/lib/dict.data.js`（优先级最高），每行一条：`中文词=english1,english2`；特殊写法 `的=~` 表示结构词翻译时省略。保存后在 `chrome://extensions/` 里点击「重新加载」生效。

## 🛠 开发

```bash
# 重新生成扩充词典（需 ECDICT csv，见脚本内说明）
python _tools/gen_bigdict.py 30000
# 重新生成拼音表（依赖 pypinyin）
python _tools/gen_pinyin.py
# 核心逻辑冒烟测试（22 项）
node _tools/smoke.test.js
```

## 📮 联系方式

- **作者**：王耀辉
- **邮箱**：[wangxiaohuiya@gmail.com](mailto:wangxiaohuiya@gmail.com)
- **仓库**：https://github.com/wangxiaohuiboy/fe-offline-toolbox

## 📄 许可

词典数据来源于 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）。本插件代码采用 [MIT License](./LICENSE) 开源。
