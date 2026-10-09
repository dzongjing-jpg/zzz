import http from 'node:http';
import worker,{hashPassword} from './dist/server/index.js';
import {localDatabase} from './local-db.mjs';
const env={DB:localDatabase('preview-v2.db'),ADMIN_PASSWORD_HASH:await hashPassword('PreviewOnlyPassword123')};
http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;const r=await worker.fetch(new Request('http://127.0.0.1:8094'+req.url,{method:req.method,headers:req.headers,...(body?{body}:{})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview unavailable');}}).listen(8094,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8094'));
