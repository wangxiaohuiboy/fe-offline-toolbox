# FE Offline Toolbox (Chrome Extension)

[中文文档](./README.md)

A Chrome extension built for **intranet / offline environments**, providing 15 high-frequency productivity tools for frontend developers. **Zero external dependencies**: dictionary, pinyin table, algorithms and UI are all bundled locally — works perfectly with no internet, and never sends data to any external address.

## ✨ Features

| Tool | Description |
|------|-------------|
| **Translate** | 17,000+ offline Chinese-English entries (1,100+ hand-curated frontend/IT terms + extended dictionary based on [ECDICT](https://github.com/skywind3000/ECDICT)); bidirectional; unmatched words are **kept as Chinese with a hit-rate hint** (no pinyin output); optional intranet translation API support |
| **Selection Translate** | Select text on any webpage → click the floating "译" button → offline dictionary card |
| **Chinese → Variable Names** | Chinese phrases → camelCase / PascalCase / snake_case / kebab-case / CONSTANT, plus engineering suggestions (Vue/React component names, `is/on/get/set` prefixes, status/list/fetch patterns); batch mode; pinyin fallback (all 6,763 GB2312 characters included) |
| **JSON Tools** | Format (with line/column error location), minify, key sorting, escaping, JSON→TypeScript interfaces, JSON→YAML, JSONPath extraction, syntax highlighting |
| **Encode/Decode** | Base64 (UTF-8 safe), URL, HTML entities, Unicode, JWT parsing (with expiry check), MD5/SHA1/SHA256/SHA512, radix conversion |
| **Timestamp** | Live timestamp, auto-detect seconds/milliseconds, ISO/UTC formats, relative time |
| **URL Tools** | URL parsing (protocol/host/path/hash), decoded parameter table, params→JSON, query builder |
| **Image Tools** | Image to Base64 (drag & drop), local compression (width/quality/format: PNG/JPEG/WebP), preview & copy |
| **px·rem·vw** | Mobile unit conversion (configurable root font-size & viewport width), common size lookup table, click-to-copy |
| **Regex Tester** | Live match highlighting, capture groups, replace preview, 14 common patterns library |
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

Offline translation is **dictionary-based word-by-word translation**:

- Unmatched words stay in Chinese, with a hit-rate hint; you can opt into pinyin substitution
- Structural particles (的/了/把/时…) are automatically omitted for readability
- Example: `用户支付订单后自动发送短信通知` → `user pay order auto send sms notification`

Enhancements:

1. **Team dictionary**: maintain business terms in Settings → Custom Dictionary (e.g. `结算中心=settlement center`); instantly affects both translation and naming; import/export for team-wide sharing
2. **Intranet translation API**: if your company runs a translation service, configure the endpoint (GET/POST, param name, response path, headers) in Settings

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
│   ├── modules/           # 15 tool modules (one file per tool)
└── _tools/                # Dev scripts (dictionary/icon generation, smoke tests)
```

## ✏️ Extending the Dictionary

Edit `js/lib/dict.data.js` (highest priority), one entry per line: `中文=english1,english2`. The special value `的=~` means the structural word is omitted in translation. Reload the extension in `chrome://extensions/` after saving.

## 🛠 Development

```bash
# Regenerate the extended dictionary (requires ECDICT csv, see script header)
python _tools/gen_bigdict.py 30000
# Regenerate the pinyin table (requires pypinyin)
python _tools/gen_pinyin.py
# Run smoke tests (22 cases)
node _tools/smoke.test.js
```

## 📮 Contact

- **Author**: Wang Yaohui (王耀辉)
- **Email**: [wangxiaohuiya@gmail.com](mailto:wangxiaohuiya@gmail.com)
- **Repository**: https://github.com/wangxiaohuiboy/fe-offline-toolbox

## 📄 License

Dictionary data from [ECDICT](https://github.com/skywind3000/ECDICT) (MIT License). This extension's code is released under the [MIT License](./LICENSE).
