import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function localDatabase(filename=':memory:'){
 const db=new DatabaseSync(filename);db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY)');
 for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())if(!db.prepare('SELECT 1 FROM _local_migrations WHERE name=?').get(file)){db.exec(readFileSync('drizzle/'+file,'utf8'));db.prepare('INSERT INTO _local_migrations VALUES(?)').run(file);}
 function prepared(sql,args=[]){const st=db.prepare(sql);return {bind:(...a)=>prepared(sql,a),first:async()=>st.get(...args)||null,all:async()=>({results:st.all(...args)}),run:async()=>{const r=st.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}},execute:()=>st.run(...args)};}
 return {raw:db,prepare:prepared,batch:async statements=>{db.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>{const r=s.execute();return {meta:{changes:Number(r.changes)}}});db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
