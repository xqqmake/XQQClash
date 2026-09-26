const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { execFile } = require('child_process');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 9090);
const ROOT = __dirname;
const STATE_FILE = process.env.STATE_FILE || path.join(ROOT, 'data', 'state.json');
let config = { yaml: '', groupYaml: {}, nodes: [], groups: [], counts: {} };
let upstreamRunning = false;
const HTTPS_FILE = process.env.HTTPS_FILE || path.join(path.dirname(STATE_FILE),'network.json');
let network = {domain:'',httpPort:PORT,httpsEnabled:false,httpUrl:'',httpsUrl:'',certificate:null};
function loadNetwork(){try{if(fs.existsSync(HTTPS_FILE))network={...network,...JSON.parse(fs.readFileSync(HTTPS_FILE,'utf8'))}}catch(e){}}
loadNetwork();
function saveNetwork(){ensureStateDir();fs.writeFileSync(HTTPS_FILE,JSON.stringify(network,null,2))}
function run(cmd,args){return new Promise((resolve,reject)=>execFile(cmd,args,{timeout:30000},(e,stdout,stderr)=>e?reject(new Error(stderr||e.message)):resolve(stdout)))}
function certCandidates(domain){const roots=['/etc/letsencrypt/live','/www/server/panel/vhost/cert','/etc/nginx/ssl','/etc/ssl'];const out=[];for(const root of roots){try{for(const ent of fs.readdirSync(root,{withFileTypes:true})){const dir=path.join(root,ent.name);if(ent.isDirectory()&&(!domain||ent.name===domain||ent.name.includes(domain))){const cert=path.join(dir,'fullchain.pem'),key=path.join(dir,'privkey.pem');if(fs.existsSync(cert)&&fs.existsSync(key))out.push({domain:ent.name,cert,key})}}}catch(e){}}return out}
loadNetwork();loadNetwork();

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
    if(req.method==='GET' && u.pathname==='/api/data') return json(res,200,{...config,settings:{port:PORT,network}});
     if(req.method==='GET' && u.pathname==='/api/network') return json(res,200,{success:true,network,candidates:certCandidates(network.domain)});
     if(req.method==='POST' && u.pathname==='/api/network/scan'){const b=await body(req);network.domain=String(b.domain||network.domain||'');saveNetwork();return json(res,200,{success:true,network,candidates:certCandidates(network.domain)})}
     if(req.method==='POST' && u.pathname==='/api/network/apply-cert'){const b=await body(req);if(!b.cert||!b.key||!fs.existsSync(b.cert)||!fs.existsSync(b.key))return json(res,400,{success:false,error:'证书或私钥路径不存在'});network={...network,domain:String(b.domain||network.domain),certificate:{cert:b.cert,key:b.key},httpsEnabled:true,httpsUrl:`https://${b.domain||network.domain}/`};saveNetwork();return json(res,200,{success:true,network})}
     if(req.method==='POST' && u.pathname==='/api/network/letsencrypt'){const b=await body(req);const domain=String(b.domain||'').trim();if(!domain)return json(res,400,{success:false,error:'请填写域名'});try{await run('certbot',['certonly','--webroot','-w',process.env.ACME_WEBROOT||'/var/www/certbot','-d',domain,'--non-interactive','--agree-tos','-m',String(b.email||`admin@${domain}`)]);const cert=`/etc/letsencrypt/live/${domain}/fullchain.pem`,key=`/etc/letsencrypt/live/${domain}/privkey.pem`;network={...network,domain,certificate:{cert,key},httpsEnabled:true,httpsUrl:`https://${domain}/`};saveNetwork();return json(res,200,{success:true,network})}catch(e){return json(res,500,{success:false,error:e.message})}}
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