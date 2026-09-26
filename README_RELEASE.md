# XQQ Clash v1.4.1 发布说明

## Windows

构建便携版和安装版：

```powershell
npm ci
npm run build:portable
npm run build
```

产物位于 `dist/`。

## Linux 桌面版

需要 Linux 构建环境（推荐 Ubuntu/Debian）：

```bash
npm ci
npm run build:linux
```

目标为 AppImage 和 Debian 包。Windows 上如果因符号链接或缺少 `fpm` 无法构建，可使用 GitHub Actions 或 Linux runner。

## Linux 网页版

```bash
npm ci --omit=dev
HOST=0.0.0.0 PORT=9090 STATE_FILE=/var/lib/xqq-clash/state.json npm run start:web
```

推荐使用仓库内 `install.sh` 安装 systemd 服务。

## Docker 网页版

```bash
docker compose up -d --build
```

访问 `http://127.0.0.1:9090/`，数据保存在 Docker volume `xqqclash-data`。

## 安全提示

不要把 SSH 密码、GitHub Token、私有订阅链接或运行时 `data/state.json` 提交到 GitHub。生产环境建议使用 Nginx/Caddy 反向代理和 HTTPS。
