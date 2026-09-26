# XQQ Clash Web

XQQ Clash 是一个纯 HTML/JavaScript 的 Clash YAML 配置生成器，也可以作为 Linux 服务器网页应用运行。

## 功能

- 支持 VLESS、VMess、Trojan、SS、SSR、Hysteria2、TUIC、WireGuard、AnyTLS、SOCKS5
- 生成 Clash YAML 配置
- 浏览器直接导入、编辑、下载 YAML
- 节点资料库持久化
- 订阅分发接口：`/clash`、`/sub`
- 支持按分组输出：`/clash?group=分组名`
- 支持订阅 URL 拉取
- 无需 Electron，浏览器即可使用

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm install
npm run start:web
```

默认访问：

```text
http://127.0.0.1:9090/
```

可通过环境变量修改监听地址和端口：

```bash
HOST=0.0.0.0 PORT=9090 npm run start:web
```

数据默认保存到：

```text
data/state.json
```

也可以指定数据文件：

```bash
STATE_FILE=/var/lib/xqq-clash/state.json npm run start:web
```

## 一键安装（Debian / Ubuntu）

从 GitHub 仓库执行：

```bash
curl -fsSL https://raw.githubusercontent.com/xqqmake/XQQClash/main/install.sh | sudo bash
```

安装脚本会自动完成：

1. 安装 Node.js、npm、Git 和 CA 证书
2. 拉取 GitHub 源码
3. 安装生产依赖
4. 创建 `/var/lib/xqq-clash` 持久化数据目录
5. 配置并启动 `xqqclash-web.service`
6. 设置开机自动启动

默认监听本机 `127.0.0.1:9090`，建议再使用 Nginx 或 Caddy 配置域名和 HTTPS。

可自定义仓库、分支、安装目录和端口：

```bash
curl -fsSL https://raw.githubusercontent.com/xqqmake/XQQClash/main/install.sh \\
  | sudo env XQQ_CLASH_REPO=https://github.com/xqqmake/XQQClash.git \\
           XQQ_CLASH_BRANCH=main \\
           XQQ_CLASH_PORT=9090 bash
```

卸载：

```bash
curl -fsSL https://raw.githubusercontent.com/xqqmake/XQQClash/main/uninstall.sh | sudo bash
```

## 功能说明

### 网页配置面板

打开网页后可以添加和编辑代理节点，支持实时生成 Clash YAML。配置内容可以复制或下载。

### 节点资料库

节点保存到服务器端状态文件后，即使重启服务也不会丢失。网页端可以启用、停用、删除和按分组管理节点。

### 订阅分发

配置完成后，客户端可以使用以下地址订阅：

```text
http://服务器地址:9090/clash
http://服务器地址:9090/sub
```

指定分组：

```text
http://服务器地址:9090/clash?group=分组名称
```

### 服务管理

```bash
sudo systemctl status xqqclash-web
sudo systemctl restart xqqclash-web
sudo journalctl -u xqqclash-web -f
```

停止服务：

```bash
sudo systemctl stop xqqclash-web
```


- `GET /`：网页界面
- `GET /api/data`：当前配置快照
- `GET /api/state`：读取状态
- `PUT /api/state`：保存状态
- `PUT /api/config`：更新服务器配置
- `POST /api/fetch`：服务器端拉取订阅 URL
- `GET /api/server/status`：服务状态
- `GET /clash`：输出完整 Clash YAML
- `GET /sub`：`/clash` 别名
- `GET /clash?group=分组名`：输出指定分组 YAML

## 生产环境建议

建议使用 Nginx/Caddy 反向代理到 `127.0.0.1:9090`，并配置 HTTPS。不要将 SSH 密码、私有订阅地址或服务器状态文件提交到 GitHub。

## Electron 桌面版

项目仍保留 Electron 桌面版入口：

```bash
npm start
```

Linux 原生包：

```bash
npm run build:linux
```

## 测试

```bash
npm run test:server
```

## 安装教程

### Windows 桌面版

在 GitHub Release 下载：

- `XQQClash-1.4.1-Portable.exe`：免安装，下载后直接运行。
- `XQQ Clash Setup 1.4.1.exe`：安装版，按向导安装后从开始菜单启动。

### Linux 桌面版

在支持图形桌面的 Debian/Ubuntu 上下载 `XQQClash-1.4.1-linux-x86_64.AppImage`：

```bash
chmod +x XQQClash-1.4.1-linux-x86_64.AppImage
./XQQClash-1.4.1-linux-x86_64.AppImage
```

Debian/Ubuntu 也可以安装 deb：

```bash
sudo apt install ./XQQClash-1.4.1-linux-amd64.deb
xqq-clash
```

如果系统不支持 AppImage，下载 `XQQClash-1.4.1-linux-x64.tar.gz`：

```bash
tar -xzf XQQClash-1.4.1-linux-x64.tar.gz
cd linux-unpacked
./xqq-clash --no-sandbox
```

### Linux 网页版（不使用 Docker）

```bash
curl -fsSL https://raw.githubusercontent.com/xqqmake/XQQClash/main/install.sh | sudo bash
```

默认访问：

```text
http://服务器IP:9090/
```

自定义端口：

```bash
curl -fsSL https://raw.githubusercontent.com/xqqmake/XQQClash/main/install.sh \
  | sudo env XQQ_CLASH_PORT=9090 bash
```

服务管理：

```bash
sudo systemctl status xqqclash-web
sudo systemctl restart xqqclash-web
sudo journalctl -u xqqclash-web -f
```

### Docker 网页版

需要已安装 Docker 和 Docker Compose：

```bash
git clone https://github.com/xqqmake/XQQClash.git
cd XQQClash
docker compose up -d --build
```

浏览器访问：

```text
http://服务器IP:9090/
```

停止服务：

```bash
docker compose down
```

节点和配置保存在 Docker volume `xqqclash-data` 中。

## License

MIT
