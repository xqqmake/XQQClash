#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${XQQ_CLASH_DIR:-/opt/xqqclash/web}"
DATA_DIR="${XQQ_CLASH_DATA_DIR:-/var/lib/xqq-clash}"
SERVICE_NAME="xqqclash-web"

if [[ "$(id -u)" -ne 0 ]]; then echo "请使用 root 运行" >&2; exit 1; fi
systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
rm -rf "$APP_DIR" "$DATA_DIR"
echo "XQQ Clash Web 已卸载"
