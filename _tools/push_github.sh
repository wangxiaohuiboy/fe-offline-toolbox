#!/bin/bash
# 推送插件到 GitHub 仓库
set -e
cd /Users/wangyaohui/WorkBuddy/2026-09-16-11-29-21/fe-offline-kit
echo "== 当前目录: $(pwd)"
echo "== git 状态:"
git log --oneline | head -2

# 若远程不存在则添加
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/wangxiaohuiboy/fe-offline-toolbox.git"
fi

# 仓库不存在则创建（已存在则跳过）
if ! /usr/local/bin/gh repo view wangxiaohuiboy/fe-offline-toolbox >/dev/null 2>&1; then
  /usr/local/bin/gh repo create fe-offline-toolbox --public \
    --description "前端离线工具箱 / FE Offline Toolbox — 内网可用的 Chrome 插件：离线翻译(1.7万词条)、JSON、中文转变量名、编解码等 15 个前端提效工具，零外部依赖" || true
fi

git push -u origin main
echo "== 推送完成"
