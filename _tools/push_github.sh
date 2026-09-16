#!/bin/bash
# 在沙箱外执行：gh 可正常读取 macOS 钥匙串中的 token
set -e
REPO="fe-offline-toolbox"
OWNER="wangxiaohuiboy"
API="https://api.github.com"

GH_BIN="$(command -v gh || echo /usr/local/bin/gh)"
TOKEN="$("$GH_BIN" auth token 2>/dev/null)"
[ -n "$TOKEN" ] || { echo "ERR: 无法读取 gh token"; exit 1; }
echo "token 读取成功（长度 ${#TOKEN}）"

cd "$(dirname "$0")/.."
echo "== 工作目录: $(pwd)"

# 1. 建仓（已存在则跳过）
code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $TOKEN" "$API/repos/$OWNER/$REPO")
if [ "$code" = "200" ]; then
  echo "仓库已存在"
else
  echo "创建仓库 $OWNER/$REPO ..."
  curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
    "$API/user/repos" \
    -d '{"name":"'"$REPO"'","description":"前端离线工具箱 / FE Offline Toolbox — 内网可用的 Chrome 插件：离线翻译(1.7万词条)、JSON、中文转变量名、编解码等 15 个前端提效工具，零外部依赖","homepage":"https://github.com/'"$OWNER"'/'"$REPO"'","private":false,"has_issues":true,"has_wiki":false,"has_projects":false}' \
    | grep -E '"full_name"' | head -1
fi

# 2. topics（chrome 插件分类标签）
curl -s -X PUT -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github.mercy-preview+json" \
  "$API/repos/$OWNER/$REPO/topics" \
  -d '{"names":["chrome-extension","chrome-plugin","frontend","developer-tools","offline","intranet","dictionary","translate","json-tools","devtools"]}' >/dev/null
echo "topics 已设置"

# 3. 推送（askpass 注入，token 不落盘）
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/$OWNER/$REPO.git"
fi
ASKPASS=$(mktemp)
printf '#!/bin/sh\necho "$GH_TOKEN"\n' > "$ASKPASS"
chmod +x "$ASKPASS"
export GH_TOKEN="$TOKEN"
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$ASKPASS" git push -u origin main 2>&1 | grep -vE '^remote: ' | head -8
rm -f "$ASKPASS"
unset GH_TOKEN
echo "== 完成: https://github.com/$OWNER/$REPO =="
