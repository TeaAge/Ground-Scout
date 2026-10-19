// Credentials are supplied only through stdin and an ephemeral child environment.
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
if(process.stdin.isTTY)spawnSync('stty',['-echo'],{stdio:'inherit'});
console.log('Ready for source credential JSON on stdin (input is hidden).');
const rl=createInterface({input:process.stdin});
const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();
if(process.stdin.isTTY)spawnSync('stty',['echo'],{stdio:'inherit'});
const credential=JSON.parse(line);
if(!credential.remote_url?.startsWith('https://git.chatgpt-team.site/')||!credential.token||credential.auth_mode!=='http_extra_header')throw new Error('Unsupported repository credential.');
function git(args,auth=false){const env={...process.env};if(auth){env.GIT_CONFIG_COUNT='1';env.GIT_CONFIG_KEY_0='http.'+credential.remote_url+'.extraHeader';env.GIT_CONFIG_VALUE_0='Authorization: Bearer '+credential.token;}const r=spawnSync('git',args,{encoding:'utf8',env});if(r.status!==0)throw new Error((r.stderr||'Git failed').replaceAll(credential.token,'[redacted]'));return r.stdout.trim();}
git(['init','-b',credential.branch]);git(['config','user.name','Codex']);git(['config','user.email','codex@openai.com']);
if(git(['remote']).split('\n').includes('origin'))git(['remote','set-url','origin',credential.remote_url]);else git(['remote','add','origin',credential.remote_url]);
git(['add','package.json','package-lock.json','.gitignore','.openai/hosting.json','src','scripts','tests','README.md','db','drizzle','drizzle.config.ts','docs']);
const staged=git(['diff','--cached','--name-only']);if(staged)git(['commit','-m','Repair GroundScout 7 parsing, acquisition gates, source routing and repeatable full audits']);
git(['push','origin','HEAD:'+credential.branch],true);
console.log(JSON.stringify({commit_sha:git(['rev-parse','HEAD']),branch:credential.branch}));
