import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function localDatabase(path=':memory:'){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const sqlite=new DatabaseSync(path);
 sqlite.exec('PRAGMA busy_timeout=5000');
 if(path!==':memory:')sqlite.exec('PRAGMA journal_mode=WAL');
 sqlite.exec('BEGIN IMMEDIATE');
 try{sqlite.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())if(!sqlite.prepare('SELECT name FROM _local_migrations WHERE name=?').get(name)){sqlite.exec(readFileSync('drizzle/'+name,'utf8'));sqlite.prepare('INSERT INTO _local_migrations(name) VALUES (?)').run(name);}
  sqlite.exec('COMMIT');
 }catch(e){sqlite.exec('ROLLBACK');sqlite.close();throw e;}
 const prepare=(sql,values=[])=>{const statement=sqlite.prepare(sql);const bound={bind(...args){return prepare(sql,args);},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){return bound._run();},_run(){const r=statement.run(...values);return {meta:{changes:Number(r.changes)}};}};return bound;};
 // All writes in a batch run synchronously: awaiting each statement would allow another
 // request to interleave and accidentally join the transaction on this same connection.
 return {prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s._run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};
}
