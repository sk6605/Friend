#!/usr/bin/env bash
# 回滚到上一个成功部署的 release（只切代码，不回滚数据库 schema）。
# 用法：bash ~/friend-current/deploy/rollback.sh
set -euo pipefail

: "${HOME:?HOME is not set}"
RELEASES_DIR="$HOME/friend-releases"
CURRENT_LINK="$HOME/friend-current"

CURRENT_TARGET=$(readlink -f "$CURRENT_LINK")
PREV=""
for dir in $(ls -1dt "$RELEASES_DIR"/*/); do
  dir="${dir%/}"
  [ "$(readlink -f "$dir")" = "$CURRENT_TARGET" ] && continue
  # 只选成功部署过的 release（deploy.sh 成功后才会写 .deployed）
  if [ -f "$dir/.deployed" ]; then PREV="$dir"; break; fi
done

if [ -z "$PREV" ]; then
  echo "没有可回滚的 release" >&2
  exit 1
fi

echo "==> 当前：$CURRENT_TARGET"
echo "==> 回滚到：$PREV"
ln -sfn "$PREV" "$CURRENT_LINK"
pm2 startOrReload "$PREV/deploy/ecosystem.config.cjs" --update-env
pm2 save
echo "==> 回滚完成"
