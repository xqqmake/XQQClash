// XQQClash Electron 冒烟测试：加载页面，检查关键 API 与功能，然后退出
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 800, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  await win.loadFile(path.join(__dirname, 'index.html'));
  const results = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    out.hasElectronAPI = !!(window.electronAPI && window.electronAPI.fetchUrl && window.electronAPI.saveFile);
    // SOCKS 表格解析
    const tbl = parseSocksTable('协议\\tsocks\\n地址\\t198.46.252.28\\n端口\\t37971\\n密码 Auth\\t启用 udp\\tIP\\npassword\\ttrue\\t127.0.0.1\\n用户名\\t密码\\n0\\tBz3V8zzadj\\tLqi3edeINs');
    out.tableParse = tbl && tbl.server === '198.46.252.28' && tbl.username === 'Bz3V8zzadj' ? 'OK' : 'FAIL';
    // 订阅拉取 IPC（用一个公开可访问的测试 URL）
    let fetchTest = 'SKIP';
    try {
      const r = await window.electronAPI.fetchUrl('https://www.gstatic.com/generate_204');
      fetchTest = (r && r.success) ? 'OK(' + r.statusCode + ')' : 'FAIL(' + (r && r.error) + ')';
    } catch (e) { fetchTest = 'FAIL(' + e.message + ')'; }
    out.fetchUrl = fetchTest;
    // SSR 兼容 + provider 输出
    let genTest = 'SKIP';
    try {
      document.getElementById('ssrCompat').checked = true;
      document.getElementById('providerMode').checked = true;
      proxies = [{ id: 1, name: 'R1', type: 'ssr', server: 'x.com', port: 8388, cipher: 'aes-256-cfb', password: 'pw', obfs: 'plain', protocol: 'origin', udp: true }];
      rules = []; subscriptions = [{ id: 1, name: 'mysub', url: 'https://mysub.com/s', nodes: [] }];
      generateYAML();
      const y = document.getElementById('output').textContent;
      genTest = (y.includes('proxy-providers:') && y.includes('type: ss') && y.includes('use:') && y.includes('- mysub')) ? 'OK' : 'FAIL';
    } catch (e) { genTest = 'FAIL(' + e.message + ')'; }
    out.generate = genTest;
    return out;
  })()`);
  console.log('SMOKE_RESULT ' + JSON.stringify(results));
  app.exit(0);
});
app.on('window-all-closed', () => app.quit());
