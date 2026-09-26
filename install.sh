#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="xqq-clash"
APP_DIR="${XQQ_CLASH_DIR:-/opt/xqqclash/web}"
DATA_DIR="${XQQ_CLASH_DATA_DIR:-/var/lib/xqq-clash}"
SERVICE_NAME="xqqclash-web"
PORT="${XQQ_CLASH_PORT:-9090}"
REPO_URL="${XQQ_CLASH_REPO:-https://github.com/xqqmake/XQQClash.git}"
BRANCH="${XQQ_CLASH_BRANCH:-main}"

log(){ printf '\033[1;34m[xqq-clash]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[xqq-clash] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || fail "请使用 root 运行：curl -fsSL <INSTALL_URL> | sudo bash"
command -v apt-get >/dev/null || fail "当前脚本仅支持 Debian/Ubuntu 系统"

export DEBIAN_FRONTEND=noninteractive
log "安装系统依赖"
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl git nodejs npm

log "获取源码到 ${APP_DIR}"
install -d -m 0755 "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "安装 Node.js 依赖"
cd "$APP_DIR"
npm ci --omit=dev --ignore-scripts

log "创建持久化数据目录"
install -d -m 0755 "$DATA_DIR"
chown -R www-data:www-data "$DATA_DIR" 2>/dev/null || true

log "安装 systemd 服务"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=XQQ Clash Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=${PORT}
Environment=STATE_FILE=${DATA_DIR}/state.json
ExecStart=/usr/bin/node ${APP_DIR}/web-server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
sleep 1
systemctl is-active --quiet "$SERVICE_NAME" || { journalctl -u "$SERVICE_NAME" -n 40 --no-pager; exit 1; }

log "安装完成"
log "访问地址：http://服务器IP:${PORT}/"
log "订阅地址：http://服务器IP:${PORT}/clash"
log "服务状态：systemctl status ${SERVICE_NAME}"
