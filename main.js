const { app, BrowserWindow, Menu, ipcMain, dialog, clipboard, net } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'),
    title: 'XQQ Clash',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  // 移除顶部菜单栏（XQQ Clash / 编辑 / 视图）
  Menu.setApplicationMenu(null);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC: 保存文件
ipcMain.handle('save-file', async (event, content, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 YAML 配置',
    defaultPath: defaultName || 'clash-config.yaml',
    filters: defaultName && /\.json$/i.test(defaultName)
      ? [{ name: 'JSON 文件', extensions: ['json'] }, { name: '所有文件', extensions: ['*'] }]
      : [{ name: 'YAML 文件', extensions: ['yaml', 'yml'] }, { name: '所有文件', extensions: ['*'] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// IPC: 复制文本
ipcMain.handle('copy-text', async (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

// IPC: 拉取订阅 URL 内容（Electron net，无 CORS 限制）
ipcMain.handle('fetch-url', async (event, url) => {
  if (!url || !/^https?:\/\//i.test(url)) return { success: false, error: 'URL 格式不正确' };
  return new Promise((resolve) => {
    let req;
    try { req = net.request(url); } catch (e) { return resolve({ success: false, error: String(e.message || e) }); }
    const timeout = setTimeout(() => { try { req.abort(); } catch (e) {} resolve({ success: false, error: '拉取超时(20s)' }); }, 20000);
    req.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36');
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        clearTimeout(timeout);
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) return resolve({ success: false, error: `HTTP ${res.statusCode}` });
        resolve({ success: true, data: buf.toString('utf-8'), statusCode: res.statusCode });
      });
      res.on('error', (e) => { clearTimeout(timeout); resolve({ success: false, error: String(e.message || e) }); });
    });
    req.on('error', (e) => { clearTimeout(timeout); resolve({ success: false, error: String(e.message || e) }); });
    req.end();
  });
});

// IPC: 节点地址端口连通性测试（不经过 Clash 核心）
ipcMain.handle('test-latency', async (event, node) => {
  const host = String(node && node.server || '').trim();
  const port = Number(node && node.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return { success: false, latency: -1, error: '节点地址或端口无效' };
  }
  const protocol = node && node.tls === false ? 'http' : 'https';
  const target = `${protocol}://${host}:${port}/`;
  return new Promise((resolve) => {
    const started = Date.now();
    let req = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { if (req) req.abort(); } catch (_) {}
      finish({ success: false, latency: -1, error: '连接超时' });
    }, 5000);
    try {
      req = net.request({ method: 'HEAD', url: target });
      req.setHeader('User-Agent', 'XQQ-Clash-Latency/1.0');
      req.on('response', (res) => {
        finish({ success: true, latency: Date.now() - started, statusCode: res.statusCode });
        try { req.abort(); } catch (_) {}
      });
      req.on('error', (err) => {
        const latency = Date.now() - started;
        finish({ success: latency < 5000, latency, error: String(err.message || err) });
      });
      req.end();
    } catch (err) {
      finish({ success: false, latency: -1, error: String(err.message || err) });
    }
  });
});

// ==================== 内置订阅分发服务器（Clash Pool 功能） ====================
const http = require('http');
const os = require('os');

let subServer = null;
let subPort = 9090;
let subConfig = { yaml: '', groupYaml: {}, nodes: [], groups: [], counts: {} };

function getLanIp() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address;
      }
    }
  } catch (e) {}
  return '127.0.0.1';
}

// 渲染进程同步最新配置快照（每次 YAML 变更时调用）
ipcMain.handle('sync-config', (event, cfg) => {
  if (cfg && typeof cfg === 'object') {
    subConfig = {
      yaml: cfg.yaml || '',
      groupYaml: cfg.groupYaml || {},
      nodes: cfg.nodes || [],
      groups: cfg.groups || [],
      counts: cfg.counts || {}
    };
  }
  return { success: true };
});

ipcMain.handle('start-server', async (event, port) => {
  const p = parseInt(port) || 9090;
  if (subServer) return { success: false, error: '服务器已在运行', port: subPort };
  try {
    subServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const pth = url.pathname;
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (pth === '/clash' || pth === '/sub') {
        const group = url.searchParams.get('group') || '';
        const yaml = group && subConfig.groupYaml[group] != null ? subConfig.groupYaml[group] : subConfig.yaml;
        res.writeHead(200, { 'Content-Type': 'text/yaml; charset=utf-8' });
        res.end(yaml || '# 暂无节点配置');
        return;
      }
      if (pth === '/api/data') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ nodes: subConfig.nodes, groups: subConfig.groups, settings: { port: subPort }, counts: subConfig.counts }));
        return;
      }
      if (pth === '/api/lan-ip') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ip: getLanIp(), port: subPort }));
        return;
      }
      if (pth === '/') {
        const ip = getLanIp();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style='background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:40px;text-align:center'><h1>⚡ XQQ Clash</h1><p>订阅地址: <a href='/clash' style='color:#3b82f6'>http://${ip}:${p}/clash</a></p><p>分组过滤: <a href='/clash?group=全部' style='color:#60a5fa'>/clash?group=组名</a></p><p><a href='/api/data' style='color:#94a3b8'>/api/data</a> · <a href='/api/lan-ip' style='color:#94a3b8'>/api/lan-ip</a></p></body></html>`);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    });
    await new Promise((resolve, reject) => {
      subServer.once('error', reject);
      subServer.listen(p, '0.0.0.0', resolve);
    });
    subPort = p;
    return { success: true, port: p, ip: getLanIp(), url: `http://${getLanIp()}:${p}/clash` };
  } catch (e) {
    try { if (subServer) subServer.close(); } catch (e2) {}
    subServer = null;
    return { success: false, error: String(e.message || e) };
  }
});

ipcMain.handle('stop-server', async () => {
  if (!subServer) return { success: true, running: false };
  try { await new Promise((resolve) => subServer.close(resolve)); } catch (e) {}
  subServer = null;
  return { success: true, running: false };
});

ipcMain.handle('server-status', async () => {
  return { running: !!subServer, port: subPort, ip: getLanIp(), url: `http://${getLanIp()}:${subPort}/clash` };
});

// ==================== 配置持久化（文件，比 localStorage 可靠） ====================
function stateFile(){return path.join(app.getPath('userData'), 'xqq-clash-state.json')}
ipcMain.handle('save-state', async (event, data) => {
  try {
    const dir = path.dirname(stateFile());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(data), 'utf-8');
    return { success: true };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
});
ipcMain.handle('load-state', async () => {
  try {
    const file = stateFile();
    if (!fs.existsSync(file)) return { success: true, data: null };
    return { success: true, data: JSON.parse(fs.readFileSync(file, 'utf-8')) };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
