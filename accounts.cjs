'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util'),scrypt=promisify(crypto.scrypt),C=require('./core.js');
module.exports=function createAccounts(root,json,storage={}){
 const dir=process.env.LEXIKA_DATA_DIR||path.join(root,'private-data'),file=path.join(dir,'accounts.json');if(!storage.db)fs.mkdirSync(dir,{recursive:true});
 let db=storage.db||(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{users:[],sessions:[]});const limits=storage.limits||new Map();
 function persist(){if(storage.db){storage.db.users=db.users;storage.db.sessions=db.sessions;storage.changed=true;return}const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,file)}
 const digest=t=>crypto.createHash('sha256').update(t).digest('hex');
 function session(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lexika_session='))?.slice(15);return db.sessions.find(s=>s.hash===digest(token||'')&&s.expires>Date.now())}
 function cookie(res,token,age){res.setHeader('Set-Cookie',`lexika_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.LEXIKA_PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`)}
 function issue(req,res,user){const old=session(req);db.sessions=db.sessions.filter(s=>s.expires>Date.now()&&s!==old);const token=crypto.randomBytes(32).toString('hex');db.sessions.push({hash:digest(token),user:user.id,expires:Date.now()+7*86400000});persist();cookie(res,token,604800)}
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>10000000)throw Object.assign(Error('Слишком большой запрос.'),{status:413});chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(Error('Некорректные данные.'),{status:400})}}
 return async function(req,res,name){if(!name.startsWith('/api/account/'))return false;
 try{
 const s=session(req),u=db.users.find(x=>x.id===s?.user);
 if(name==='/api/account/me'&&req.method==='GET'){json(res,200,{user:u?{login:u.login}:null});return true}
 if(name==='/api/account/state'&&req.method==='GET'){if(!u)json(res,401,{error:'Войди в аккаунт.'});else json(res,200,{state:u.state,revision:u.revision});return true}
 if(!['POST','PUT'].includes(req.method)){json(res,405,{error:'Метод не поддерживается.'});return true}
 const data=await body(req);
 if(name==='/api/account/register'||name==='/api/account/login'){
 const key=(process.env.RENDER==='true'?String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim():req.socket.remoteAddress),now=Date.now();let limit=limits.get(key);if(!limit||now-limit.at>600000){limit={at:now,count:0};limits.set(key,limit)}if(++limit.count>20){json(res,429,{error:'Слишком много попыток. Попробуй через 10 минут.'});return true}
 const login=typeof data.login==='string'?data.login.trim().toLowerCase():'',password=typeof data.password==='string'?data.password:'';
 if(!/^[a-z0-9_.-]{3,40}$/.test(login)||password.length<10||password.length>128){json(res,400,{error:'Логин: 3–40 латинских букв, цифр, точек, дефисов или _. Пароль: 10–128 символов.'});return true}
 if(name.endsWith('/register')){
 if(db.users.some(x=>x.login===login)){json(res,409,{error:'Этот логин уже занят.'});return true}
 const state=data.state?C.validate(data.state):C.initial(),salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64,{N:32768,maxmem:64*1024*1024})).toString('hex');
 if(db.users.some(x=>x.login===login)){json(res,409,{error:'Этот логин уже занят.'});return true}
 const user={id:crypto.randomUUID(),login,salt,hash,state,revision:0};db.users.push(user);issue(req,res,user);json(res,201,{user:{login},state,revision:0});return true
 }
 const user=db.users.find(x=>x.login===login),hash=await scrypt(password,user?.salt||'00000000000000000000000000000000',64,{N:32768,maxmem:64*1024*1024});if(!user||!crypto.timingSafeEqual(hash,Buffer.from(user.hash,'hex'))){json(res,401,{error:'Неверный логин или пароль.'});return true}issue(req,res,user);json(res,200,{user:{login},state:user.state,revision:user.revision});return true
 }
 if(!u){json(res,401,{error:'Сессия завершилась. Войди снова. Несохранённые изменения остались в этом браузере.'});return true}
 if(name==='/api/account/logout'){db.sessions=db.sessions.filter(x=>x!==s);persist();cookie(res,'',0);json(res,200,{ok:true});return true}
 if(name==='/api/account/state'&&req.method==='PUT'){if(data.revision!==u.revision){json(res,409,{error:'Профиль изменён в другой вкладке или на другом устройстве. Сделай экспорт своей копии и перезагрузи страницу.'});return true}const next=C.validate(data.state);u.state=next;u.revision++;persist();json(res,200,{revision:u.revision});return true}
 json(res,404,{error:'Не найдено.'});return true
 }catch(e){json(res,e.status||400,{error:e.status?e.message:'Не удалось обработать данные аккаунта.'});return true}
 }
};
