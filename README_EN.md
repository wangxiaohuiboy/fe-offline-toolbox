# FE Offline Toolbox (Chrome Extension)

[中文文档](./README.md)

A Chrome extension built for **intranet / offline environments**, providing 17 high-frequency productivity tools for frontend developers. **Zero external dependencies**: dictionary, pinyin table, algorithms and UI are all bundled locally — works perfectly with no internet, and never sends data to any external address.

## ✨ Features

| Tool | Description |
|------|-------------|
| **Translate** | Dual-engine, fully offline: **① Dictionary lookup** — 77,000 Chinese-English entries (1,270+ hand-curated + extended dictionary from [ECDICT](https://github.com/skywind3000/ECDICT)), accurate terms, instant; **② Neural translation** — built-in local AI model opus-mt-zh-en ([Transformers.js](https://github.com/huggingface/transformers.js) + WASM, ~110MB), natural full-sentence output; first load takes 10-30s. Bidirectional; optional intranet translation API support |
| **Selection Translate** | Select text on any webpage → click the floating "译" button → offline dictionary card |
| **Chinese → Variable Names** | Chinese phrases → camelCase / PascalCase / snake_case / kebab-case / CONSTANT, plus engineering suggestions (Vue/React component names, `is/on/get/set` prefixes, status/list/fetch patterns); batch mode; pinyin fallback (all 6,763 GB2312 characters included) |
| **JSON Tools** | Format (with line/column error location), minify, key sorting, escaping, JSON→TypeScript interfaces, JSON→YAML, JSONPath extraction, syntax highlighting |
| **API Debugger** | Send requests to intranet APIs (GET/POST/PUT/PATCH/DELETE), custom headers/body, response time/size/headers display, last 8 history entries with one-click refill; CORS permission granted on demand |
| **Encode/Decode** | Base64 (UTF-8 safe), URL, HTML entities, Unicode, JWT parsing (with expiry check), MD5/SHA1/SHA256/SHA512, radix conversion |
| **Timestamp** | Live timestamp, auto-detect seconds/milliseconds, ISO/UTC formats, relative time |
| **URL Tools** | URL parsing (protocol/host/path/hash), decoded parameter table, params→JSON, query builder |
| **Image Tools** | Image to Base64 (drag & drop), local compression (width/quality/format: PNG/JPEG/WebP), preview & copy |
| **px·rem·vw** | Mobile unit conversion (configurable root font-size & viewport width), common size lookup table, click-to-copy |
| **Regex Tester** | Live match highlighting, capture groups, replace preview, 14 common patterns library |
| **Table Converter** | CSV / TSV (paste directly from Excel) / Markdown tables / JSON arrays — convert between all formats for docs and data export |
| **Text Tools** | Case/naming-style conversion, sort & dedupe, line prefixes/suffixes, full/half-width conversion, statistics, line diff |
| **Color Tools** | HEX/RGB/HSL conversion, 10-step color scale, color picker |
| **Random** | UUID v4, NanoID, random passwords, Chinese placeholder text |
| **Cron Parser** | 5-field expressions → plain-language description + next 5 run times |
| **Cheat Sheet** | CSS tips / Git / npm / HTTP status codes / keyCodes |
| **Settings** | Team custom dictionary (shared by translate & naming, import/export), intranet translation API config, selection-translate toggle, config backup |

## 📥 Installation (no internet required)

1. Download / unzip this repo (or `fe-offline-kit.zip`)
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `fe-offline-kit` folder
5. **Click the extension icon** in the toolbar — a movable, resizable panel window (920×680) opens
6. Alternatively: right-click the icon → "Open full toolbox in a tab", or press `Ctrl/Cmd + Shift + U`

> Intranet distribution: just send the zip to your teammates. Everything works offline.

## 🌐 About Offline Translation

The Translate tool ships with **two offline engines**:

- **Dictionary mode** (default): word-by-word lookup against local dictionaries — accurate terms, instant response. Structural particles (的/了/把…) are automatically omitted. Maintain business terms in Settings → Custom Dictionary; instantly affects both translation and naming
- **Neural mode**: a local AI model (opus-mt-zh-en, Marian NMT) runs entirely in your browser via [Transformers.js](https://github.com/huggingface/transformers.js) + WebAssembly — real full-sentence translation with natural grammar. The model files (~110MB) ship with the zip distribution and never touch the network. First load takes 10-30s; per-sentence inference ~2-10s
  - Example: `仓库的代码已经超过一万行了，需要安排一次代码评审。` → *The warehouse code has exceeded 10,000 lines and requires a code review.*
  - When cloning from GitHub, model weights are excluded (size); run `bash tools/download_models.sh` to fetch them (defaults to the hf-mirror.com mirror for China)
- **Intranet translation API**: if your company runs a translation service, configure the endpoint (GET/POST, param name, response path, headers) in Settings

Dictionary-mode example: `用户支付订单后自动发送短信通知` → `user pay order auto send sms notification`

## 🔒 Privacy

- All dictionary lookups and computation happen locally
- Images never leave the browser
- Requests are only sent to the **intranet endpoint you configure yourself**

## 📁 Project Structure

```
fe-offline-kit/
├── manifest.json          # MV3 config (with author info)
├── app.html               # Main UI (shared by panel & tab)
├── background.js          # Panel window / context menus / shortcuts
├── content/               # Selection-translate content script
├── css/ · icons/
├── js/
│   ├── app.js             # Controller / routing / search
│   ├── lib/               # Dictionary data, translate engine, naming, utils
│   ├── modules/           # 17 tool modules (one file per tool)
└── tools/                # Dev scripts (dictionary/icon generation, smoke tests)
```

## ✏️ Extending the Dictionary

Edit `js/lib/dict.data.js` (highest priority), one entry per line: `中文=english1,english2`. The special value `的=~` means the structural word is omitted in translation. Reload the extension in `chrome://extensions/` after saving.

## 🛠 Development

```bash
# Regenerate the extended dictionary (requires ECDICT csv, see script header)
python tools/gen_bigdict.py 30000
# Regenerate the pinyin table (requires pypinyin)
python tools/gen_pinyin.py
# Run smoke tests (22 cases)
node tools/smoke.test.js
```

## 📮 Contact

- **Author**: Wang Yaohui (王耀辉)
- **Email**: [wangxiaohuiya@gmail.com](mailto:wangxiaohuiya@gmail.com)
- **Repository**: https://github.com/wangxiaohuiboy/fe-offline-toolbox

## 📄 License

Dictionary data from [ECDICT](https://github.com/skywind3000/ECDICT) (MIT License). This extension's code is released under the [MIT License](./LICENSE).
