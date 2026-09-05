// 订阅分发服务器逻辑测试（模拟 main.js 的服务器实现）
const http = require('http');

// ===== 复制自 main.js 的服务器逻辑 =====
let subPort = 9090;
let subConfig = { yaml: '# test yaml\nport: 7890', groupYaml: { '家': '# 家组\nport: 7891' }, nodes: [{ name: 'A1' }], groups: ['家'], counts: { total: 1 } };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pth = url.pathname;
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
    res.end(JSON.stringify({ ip: '127.0.0.1', port: subPort }));
    return;
  }
  if (pth === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html>OK</html>');
    return;
  }
  res.writeHead(404); res.end('404');
});

function get(p, port) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, ct: res.headers['content-type'], body: d, cors: res.headers['access-control-allow-origin'] }));
    }).on('error', e => resolve({ error: e.message }));
  });
}

(async () => {
  await new Promise(r => server.listen(19090, '127.0.0.1', r));
  const tests = [];
  // 1. /clash 返回 YAML
  let r = await get('/clash', 19090);
  tests.push(['/clash 返回YAML', r.status === 200 && r.body.includes('port: 7890') && r.ct.includes('text/yaml')]);
  // 2. /sub 别名
  r = await get('/sub', 19090);
  tests.push(['/sub 别名', r.status === 200 && r.body.includes('port: 7890')]);
  // 3. ?group= 过滤
  r = await get('/clash?group=' + encodeURIComponent('家'), 19090);
  tests.push(['?group= 分组过滤', r.status === 200 && r.body.includes('家组') && !r.body.includes('test yaml')]);
  // 4. 未知组回退全量
  r = await get('/clash?group=' + encodeURIComponent('不存在'), 19090);
  tests.push(['未知组回退全量', r.status === 200 && r.body.includes('port: 7890')]);
  tests.push(['未知组回退全量', r.status === 200 && r.body.includes('port: 7890')]);
  // 5. /api/data JSON
  r = await get('/api/data', 19090);
  const j = JSON.parse(r.body);
  tests.push(['/api/data JSON', r.status === 200 && r.ct.includes('application/json') && j.nodes.length === 1 && j.counts.total === 1]);
  // 6. /api/lan-ip
  r = await get('/api/lan-ip', 19090);
  const j2 = JSON.parse(r.body);
  tests.push(['/api/lan-ip', j2.port === 19090 || j2.port === 9090]);
  // 7. / 首页
  r = await get('/', 19090);
  tests.push(['/ 首页HTML', r.status === 200 && r.body.includes('<html>')]);
  // 8. 404
  r = await get('/nope', 19090);
  tests.push(['404', r.status === 404]);
  // 9. CORS
  r = await get('/clash', 19090);
  tests.push(['CORS 头', r.cors === '*']);
  // 10. OPTIONS
  r = await new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: 19090, path: '/clash', method: 'OPTIONS' }, (res) => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'] })); });
    req.end();
  });
  tests.push(['OPTIONS 204+CORS', r.status === 204 && r.cors === '*']);

  server.close();
  let fail = 0;
  tests.forEach(([n, ok]) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); if (!ok) fail++; });
  console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();
