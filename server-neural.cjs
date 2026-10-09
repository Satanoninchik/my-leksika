'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=__dirname,port=Number(process.env.PORT||process.env.LEXIKA_PORT)||4173,python=process.env.LEXIKA_PYTHON||(process.platform!=='win32'?'python3':'C:/Users/Саша/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
let child,sequence=0;const pending=new Map();
function getVoiceProcess(){if(child)return child;child=spawn(python,['-u',path.join(root,'piper_service.py')],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});let buffer='';child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const data=JSON.parse(line),request=pending.get(data.id);if(request){clearTimeout(request.timer);pending.delete(data.id);data.error?request.reject(Error(data.error)):request.resolve(Buffer.from(data.wav,'base64'))}}catch(e){console.error('Ошибка ответа синтезатора')}}});child.stderr.on('data',()=>{});const failed=()=>{child=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Локальный голос недоступен. Перезапусти приложение.'))}pending.clear()};child.on('error',failed);child.on('exit',failed);return child;}
function synthesize(text,lang,rate){if(pending.size>=8)return Promise.reject(Error('Подожди завершения озвучивания.'));return new Promise((resolve,reject)=>{const engine=getVoiceProcess(),id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Создание аудио заняло слишком много времени. Попробуй ещё раз.'))},90000);pending.set(id,{resolve,reject,timer});engine.stdin.write(JSON.stringify({id,text,lang,rate})+'\n',err=>{if(err){clearTimeout(timer);pending.delete(id);reject(err)}})});}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const accounts=require(process.env.DATABASE_URL?'./accounts-postgres.cjs':'./accounts.cjs')(root,json);
const publicOrigin=process.env.LEXIKA_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;if(publicOrigin)process.env.LEXIKA_PUBLIC_ORIGIN=publicOrigin;
const origins=new Set(['http://127.0.0.1:'+port,'http://localhost:'+port,...(publicOrigin?[publicOrigin]:[])]);
const hosts=new Set([...origins].map(x=>new URL(x).host));
const server=http.createServer(async(req,res)=>{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
if(req.url==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
if(!hosts.has(req.headers.host)){res.writeHead(403);return res.end()}
let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1:4173').pathname)}catch(e){res.writeHead(400);return res.end()}
if(['POST','PUT'].includes(req.method)&&(!origins.has(req.headers.origin)||!(req.headers['content-type']||'').startsWith('application/json')))return json(res,403,{error:'Недопустимый источник или формат запроса.'});
if(await accounts(req,res,name))return;
if(name==='/api/tts'){
if(req.method!=='POST')return json(res,405,{error:'Используй POST.'});if(req.headers.origin&&!origins.has(req.headers.origin))return json(res,403,{error:'Недопустимый источник запроса.'});
const chunks=[];let size=0;try{for await(const chunk of req){size+=chunk.length;if(size>32000)return json(res,413,{error:'Слишком длинный текст.'});chunks.push(chunk)}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000||!['en','ru'].includes(data.lang))return json(res,400,{error:'Некорректный текст или язык.'});const wav=await synthesize(data.text,data.lang,Math.min(1.2,Math.max(.5,Number(data.rate)||1)));res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length,'Cache-Control':'no-store'});return res.end(wav)}catch(e){return json(res,503,{error:e.message||'Не удалось создать аудио.'})}}
if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
const allowed=new Set(['/index.html','/style.css','/core.js','/app.js','/bulk.js','/ui.js','/voice-piper.js','/profile.js']);if(name==='/')name='/index.html';if(!allowed.has(name)){res.writeHead(404);return res.end('Not found')}
fs.readFile(path.join(root,name.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8','js':'application/javascript; charset=utf-8'})[path.extname(name).slice(1)]);res.end(req.method==='HEAD'?undefined:data)});
});server.listen(port,process.env.LEXIKA_BIND||'127.0.0.1',()=>console.log('Лексика: http://127.0.0.1:'+port));process.on('exit',()=>child?.kill());
