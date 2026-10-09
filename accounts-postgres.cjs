'use strict';
const createAccounts=require('./accounts.cjs');
// A locked PostgreSQL row keeps the small personal app's account store durable,
// including sessions, and prevents parallel servers from overwriting each other.
module.exports=function(root,json,options={}){
 const pool=options.pool||new(require('pg').Pool)({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000,query_timeout:20000});
 pool.on?.('error',()=>console.error('База данных временно недоступна.'));
 const limits=new Map();let ready;
 function initialize(){return ready??=(async()=>{await pool.query('CREATE TABLE IF NOT EXISTS lexika_accounts (id integer PRIMARY KEY CHECK (id = 1), payload jsonb NOT NULL)');await pool.query('INSERT INTO lexika_accounts (id,payload) VALUES (1,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify({users:[],sessions:[]})])})().catch(e=>{ready=null;throw e})}
 return async function(req,res,name){if(!name.startsWith('/api/account/'))return false;let client,response;
 try{await initialize();client=await pool.connect();await client.query('BEGIN');await client.query("SET LOCAL lock_timeout = '15s'");const result=await client.query('SELECT payload FROM lexika_accounts WHERE id=1 FOR UPDATE');const storage={db:result.rows[0].payload,limits,changed:false};
 await createAccounts(root,(_res,status,data)=>{response={status,data}},storage)(req,res,name);
 if(storage.changed)await client.query('UPDATE lexika_accounts SET payload=$1::jsonb WHERE id=1',[JSON.stringify(storage.db)]);
 await client.query('COMMIT');json(res,response.status,response.data);
 }catch(e){if(client)try{await client.query('ROLLBACK')}catch{}res.removeHeader('Set-Cookie');json(res,503,{error:'Хранилище временно недоступно. Попробуй ещё раз: данные остались в браузере.'})}finally{client?.release()}
 return true;
 }
};
