#!/usr/bin/env bash
# 新 EC2（Ubuntu 24.04）一次性初始化。以 ubuntu 用户执行（不要 sudo 整个脚本）：
#   git clone <repo> ~/friend-repo
#   bash ~/friend-repo/deploy/bootstrap-ec2.sh s3://<bucket>/production.env
#
# 前提：实例已挂 IAM role（AmazonSSMManagedInstanceCore + 对该 S3 对象的 s3:GetObject）。
set -euo pipefail

ENV_S3_URI="${1:?用法：bash bootstrap-ec2.sh s3://<bucket>/<key>}"
REPO_DIR="$HOME/friend-repo"
CONF_FILE="$HOME/.friend-deploy.conf"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "找不到 $REPO_DIR，请先 git clone 到这个位置" >&2
  exit 1
fi

echo "==> [1/7] 2G swap（t3.small 编译 Next.js 需要）"
if ! swapon --show | grep -q '^/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

echo "==> [2/7] 安装 Node 22、nginx、AWS CLI、pm2"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
command -v aws > /dev/null || sudo snap install aws-cli --classic
command -v pm2 > /dev/null || sudo npm install -g pm2

# Ghostty 等终端的 TERM 在 Ubuntu 上不被识别，会导致 nano 打不开
grep -q 'TERM=xterm-256color' "$HOME/.bashrc" || echo 'export TERM=xterm-256color' >> "$HOME/.bashrc"

echo "==> [3/7] 写入本机部署配置 $CONF_FILE"
IMDS_TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
REGION=$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
umask 077
printf 'ENV_S3_URI=%s\nAWS_DEFAULT_REGION=%s\n' "$ENV_S3_URI" "$REGION" > "$CONF_FILE"
umask 022

echo "==> [4/7] 检查能否读取 S3 上的 env 文件"
AWS_DEFAULT_REGION="$REGION" aws s3 cp --only-show-errors "$ENV_S3_URI" - > /dev/null \
  || { echo "读不到 $ENV_S3_URI：检查 EC2 IAM role 的 s3:GetObject 权限和路径" >&2; exit 1; }

echo "==> [5/7] 配置 nginx"
sudo cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/friend
sudo ln -sfn /etc/nginx/sites-available/friend /etc/nginx/sites-enabled/friend
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> [6/7] 首次部署"
bash "$REPO_DIR/deploy/deploy.sh"

echo "==> [7/7] pm2 开机自启"
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME"
pm2 save

echo "==> 初始化完成。验证：curl -I http://localhost/"
