#!/usr/bin/env bash
# 在 EC2 上部署 ~/friend-repo 当前的 HEAD。
# 调用方应先把仓库对齐到 origin/main（GitHub Actions 已经这样做）；手动部署：
#   git -C ~/friend-repo fetch origin main && git -C ~/friend-repo reset --hard origin/main
#   bash ~/friend-repo/deploy/deploy.sh
#
# 流程：导出代码到新 release 目录 → 从 S3 拉 .env → npm ci → build → prisma db push
#       → 切换 ~/friend-current → pm2 reload → 清理旧 release
# 任一步失败脚本立即退出，~/friend-current 不变，线上继续跑上一个 release。
set -euo pipefail

: "${HOME:?HOME is not set}"
REPO_DIR="$HOME/friend-repo"
RELEASES_DIR="$HOME/friend-releases"
CURRENT_LINK="$HOME/friend-current"
CONF_FILE="$HOME/.friend-deploy.conf"
KEEP_RELEASES=3

# 机器本地配置（bootstrap-ec2.sh 生成，不进 git）：ENV_S3_URI、AWS_DEFAULT_REGION
if [ -f "$CONF_FILE" ]; then
  set -a; . "$CONF_FILE"; set +a
fi
: "${ENV_S3_URI:?ENV_S3_URI 未设置，应写在 $CONF_FILE 里（例如 ENV_S3_URI=s3://my-bucket/production.env）}"

SHA=$(git -C "$REPO_DIR" rev-parse --short HEAD)
RELEASE="$RELEASES_DIR/$(date +%Y%m%d%H%M%S)-$SHA"

echo "==> [1/7] 导出 $SHA 到 $RELEASE"
mkdir -p "$RELEASE"
git -C "$REPO_DIR" archive HEAD | tar -x -C "$RELEASE"

echo "==> [2/7] 从 S3 拉取 .env"
(umask 077 && aws s3 cp --only-show-errors "$ENV_S3_URI" "$RELEASE/.env")

cd "$RELEASE"

echo "==> [3/7] npm ci"
npm ci --no-audit --no-fund

echo "==> [4/7] build"
npm run build

# build 成功后才改 schema。不加 --accept-data-loss：会丢数据的变更会直接失败，需人工处理
echo "==> [5/7] prisma db push"
npx prisma db push --skip-generate

echo "==> [6/7] 切换 friend-current 并 reload"
ln -sfn "$RELEASE" "$CURRENT_LINK"
pm2 startOrReload "$RELEASE/deploy/ecosystem.config.cjs" --update-env
pm2 save
touch "$RELEASE/.deployed"

echo "==> [7/7] 清理旧 release（保留最近 $KEEP_RELEASES 个 + 当前）"
CURRENT_TARGET=$(readlink -f "$CURRENT_LINK")
ls -1dt "$RELEASES_DIR"/*/ | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  old="${old%/}"
  # 只删 ~/friend-releases/<时间戳>-<sha> 形式的目录，且绝不删当前 release
  case "$old" in
    "$RELEASES_DIR"/2*) ;;
    *) echo "    跳过（路径不符合预期）：$old"; continue ;;
  esac
  [ "$(readlink -f "$old")" = "$CURRENT_TARGET" ] && continue
  echo "    删除 $old"
  rm -rf -- "$old"
done

echo "==> 部署完成：$SHA"
