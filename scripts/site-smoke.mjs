// Checks deployed assets with a native Sites request credential. It never asserts a user identity.
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
if(process.stdin.isTTY)spawnSync('stty',['-echo'],{stdio:'inherit'});
console.log('Ready for Sites request credential JSON on stdin (input is hidden).');
const rl=createInterface({input:process.stdin});
const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();
if(process.stdin.isTTY)spawnSync('stty',['echo'],{stdio:'inherit'});
const {url,token}=JSON.parse(line),origin=new URL(url).origin;
if(!token||!origin.startsWith('https://')||!new URL(origin).hostname.endsWith('.chatgpt.site'))throw new Error('Sites origin and native request credential required.');
const checks=[],headers={'OAI-Sites-Authorization':'Bearer '+token};
try{
 const r=await fetch(origin+'/health',{redirect:'error',headers,signal:AbortSignal.timeout(25000)}),health=await r.json();checks.push({path:'/health',http_status:r.status,version:health.version,storage:health.storage});assert.equal(r.status,200);assert.equal(health.version,'7.0.0');assert.equal(health.storage,true);
 const catalog=await fetch(origin+'/api/tools',{redirect:'error',headers,signal:AbortSignal.timeout(25000)});assert.equal(catalog.status,200);const tools=(await catalog.json()).tools;assert.equal(tools.length,71);checks.push({path:'/api/tools',http_status:catalog.status,registered_tools:tools.length});
 for(const path of ['/workflow.md','/audit-v7.md']){const md=await fetch(origin+path,{redirect:'error',headers,signal:AbortSignal.timeout(25000)});assert.equal(md.status,200);assert.match(md.headers.get('content-type'),/text\/markdown/);assert.match(await md.text(),/GrundScout 7/);checks.push({path,http_status:md.status});}
 // This credential opens Site assets; it is not a browser sign-in or an MCP OAuth identity.
 // Rejection is required here. A real account tool check must use the connected Site plugin.
 const denied=await fetch(origin+'/api/tool',{method:'POST',redirect:'error',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({name:'list_land_search_jobs',arguments:{}}),signal:AbortSignal.timeout(25000)});checks.push({path:'/api/tool',http_status:denied.status,sites_test_credential_is_not_user_identity:true});assert.equal(denied.status,401);
}finally{
 const result={origin,scope:'Actual private Site asset checks using native Sites-issued request credential; no forged authenticated-user header and no production mutations. Account MCP tools require the existing connected Site plugin.',account_mcp_connection_verified:false,checks};if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
