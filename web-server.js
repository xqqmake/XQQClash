const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 9090);
const ROOT = __dirname;
const STATE_FILE = process.env.STATE_FILE || path.join(ROOT, 'data', 'state.json');
let config = { yaml: '', groupYaml: {}, nodes: [], groups: [], counts: {} };
let upstreamRunning = false;

function ensureStateDir(){ fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); }
function json(res, status, data){ res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(data)); }
function body(req){ return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)}) }
function load(){ try { if(fs.existsSync(STATE_FILE)) config=JSON.parse(fs.readFileSync(STATE_FILE,'utf8')).config||config } catch(e){} }
function save(){ ensureStateDir(); fs.writeFileSync(STATE_FILE, JSON.stringify({config},null,2)); }
function fetchUrl(target){ return new Promise((resolve,reject)=>{ const u=new URL(target); if(!['http:','https:'].includes(u.protocol)) return reject(new Error('仅支持 http/https')); const lib=u.protocol==='https:'?https:http; const req=lib.get(target,{'User-Agent':'XQQ-Clash-Web/1.0'},r=>{let s='';r.setEncoding('utf8');r.on('data',c=>s+=c);r.on('end',()=>resolve({success:r.statusCode<400,data:s,statusCode:r.statusCode}))}); req.setTimeout(20000,()=>req.destroy(new Error('拉取超时(20s)')));req.on('error',e=>reject(e)) }) }
load();
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  try{
    const u=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET' && (u.pathname==='/' || u.pathname==='/index.html')) return fs.createReadStream(path.join(ROOT,'index.html')).pipe(res);
    if(req.method==='GET' && u.pathname==='/api/data') return json(res,200,{...config,settings:{port:PORT}});
    if(req.method==='GET' && u.pathname==='/api/state') return json(res,200,{success:true,data:config.state||null});
    if(req.method==='PUT' && u.pathname==='/api/state'){const b=await body(req);config.state=b;save();return json(res,200,{success:true})}
    if(req.method==='PUT' && u.pathname==='/api/config'){const b=await body(req);config={...config,...b};save();return json(res,200,{success:true})}
    if(req.method==='POST' && u.pathname==='/api/fetch'){const b=await body(req);return json(res,200,await fetchUrl(b.url))}
    if(req.method==='GET' && (u.pathname==='/clash'||u.pathname==='/sub')){const group=u.searchParams.get('group')||'';res.writeHead(200,{'Content-Type':'text/yaml; charset=utf-8'});return res.end(group&&config.groupYaml[group]!=null?config.groupYaml[group]:(config.yaml||'# 暂无节点配置'))}
    if(req.method==='POST' && u.pathname==='/api/server/start'){upstreamRunning=true;return json(res,200,{success:true,running:true,port:PORT,ip:req.headers.host?.split(':')[0],url:`http://${req.headers.host}/clash`})}
    if(req.method==='POST' && u.pathname==='/api/server/stop'){upstreamRunning=false;return json(res,200,{success:true,running:false})}
    if(req.method==='GET' && u.pathname==='/api/server/status')return json(res,200,{success:true,running:upstreamRunning,port:PORT,url:`http://${req.headers.host}/clash`});
    res.writeHead(404);res.end('404 Not Found');
  }catch(e){json(res,500,{success:false,error:String(e.message||e)})}
});
server.listen(PORT,HOST,()=>console.log(`XQQ Clash Web listening on http://${HOST}:${PORT}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));