import http from 'node:http';
import {Readable} from 'node:stream';
import worker from '../src/worker.mjs';
import {mkdirSync} from 'node:fs';
import {localDatabase} from './local-db.mjs';
mkdirSync('.sites-runtime',{recursive:true});const DB=localDatabase('.sites-runtime/grundscout.sqlite');
const server=http.createServer(async(req,res)=>{
  try{const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);headers.set('oai-authenticated-user-id','local-developer');const r=await worker.fetch(new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Readable.toWeb(req),duplex:'half'}:{})}),{DB});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}
});server.listen(4173,'127.0.0.1',()=>console.log('Local URL: http://127.0.0.1:4173'));
