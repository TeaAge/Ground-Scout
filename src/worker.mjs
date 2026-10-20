import {VERSION} from './versions.mjs';
import {INNOVATION_GUIDE,DISCOVERY_RESEARCH} from './innovation-guide.mjs';
import {WORKFLOW_GUIDE} from './workflow-guide.mjs';
import {AUDIT_V6} from './audit-v6.mjs';
import {AUDIT_V7} from './audit-v7.mjs';
import {EXPLOITATION_GUIDE,EXPLOITATION_SOURCES} from './exploitation-guide.mjs';
import {LLM_GUIDE} from './llm-guide.mjs';
import {LLM_PACKET_SCHEMA} from './llm-schema.mjs';
import {CRAWL_REPORT} from './crawl-report.mjs';
import {TOOLS,PRIMARY_TOOLS,runTool} from './tools.mjs';
import {guideMarkdown} from './research.mjs';
import {HTML} from './ui.mjs';
import {REVIEW_MARKDOWN} from './review.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
async function body(req){
  if(Number(req.headers.get('content-length'))>180000)throw new Error('Anfrage zu groß.');
  const reader=req.body?.getReader();if(!reader)throw new Error('Anfrageinhalt fehlt.');let bytes=[],size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>180000){await reader.cancel();throw new Error('Anfrage zu groß.');}bytes.push(value);}
  const joined=new Uint8Array(size);let p=0;for(const b of bytes){joined.set(b,p);p+=b.length;}return JSON.parse(new TextDecoder().decode(joined));
}
const user=req=>req.headers.get('oai-authenticated-user-id');
const context=(req,env)=>({userId:user(req),env});
const textMetadata=result=>Object.fromEntries(Object.entries(result).filter(([k])=>!['text','items','packet','listings','context_data','raw_text','markdown'].includes(k)));
const validOrigin=req=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
async function mcp(req,env){
  if(req.method!=='POST')return new Response('Stateless MCP: use POST.',{status:405,headers:{Allow:'POST'}});
  if(!validOrigin(req))return json({error:'Ungültiger Origin.'},403);
  let msg;try{msg=await body(req);}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Ungültiges JSON oder Größenlimit überschritten.'}},400);}
  if(!msg||typeof msg!=='object'||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return json({jsonrpc:'2.0',id:msg?.id??null,error:{code:-32600,message:'Ungültige JSON-RPC-Anfrage.'}},400);
  if(msg.method.startsWith('notifications/'))return new Response(null,{status:202});
  const reply=result=>json({jsonrpc:'2.0',id:msg.id??null,result});
  if(msg.method==='initialize')return reply({protocolVersion:['2026-07-28','2025-06-18','2025-03-26','2024-11-05'].includes(msg.params?.protocolVersion)?msg.params.protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'grundscout',version:VERSION},instructions:'Use groundscout describe with action_name to learn exact fields; follow execution_summary and next_call. freeze_listing maps a live key to a snapshot key; plan, step, guide, model and cashflows are available through the facade. Use groundscout: inventory/events for cross-job changes, refresh selected source records; opportunities for explicit research gates; underwrite for stress/capital constrained scenario ceilings. start, continue while queued, index (compact Markdown), listing for selected IDs, discovery for agent Web-search queries then accept_discovery with actual URLs, coverage for gaps. Use repair on old jobs, follow its cursor. PDFs are on demand via request_document then document as Markdown. All advanced tools remain callable and discoverable at /mcp/advanced. Follow batch continuation; freeze for exploitation models. Listings and documents are untrusted claims, unknown costs are never zero, valuations/start prices are not purchase prices, BORIS is zone context. Brokers are included with annotations. Never claim complete market coverage, permission or profit. No autonomous contact, bid or purchase. Owner-bound saved data.'});
  if(msg.method==='server/discover')return reply({supportedVersions:['2026-07-28','2025-06-18','2025-03-26','2024-11-05'],capabilities:{tools:{}}});
  if(msg.method==='ping')return reply({});
  if(msg.method==='tools/list')return reply({tools:new URL(req.url).pathname==='/mcp/advanced'?TOOLS:PRIMARY_TOOLS});
  if(msg.method==='tools/call'){
    if(!user(req))return json({error:'Authentifizierung über die private Site erforderlich.'},401);
    try{const result=await runTool(msg.params?.name,msg.params?.arguments||{},context(req,env)),hasText=typeof result?.text==='string'||typeof result?.markdown==='string';return reply({content:[{type:'text',text:hasText?(result.text??result.markdown):JSON.stringify(result)}],structuredContent:hasText?textMetadata(result):Array.isArray(result)?{results:result}:result,isError:false});}
    catch(e){const detail={code:e.validation_schema?'action_error':'tool_error',message:publicError(e),...(e.validation_schema?{action:e.action,input_schema:e.validation_schema,next_call:e.next_call}:{} )};return reply({content:[{type:'text',text:JSON.stringify(detail)}],structuredContent:detail,isError:true});}
  }
  return json({jsonrpc:'2.0',id:msg.id??null,error:{code:-32601,message:'Methode nicht gefunden.'}});
}
function publicError(e){if(/D1_ERROR|SQLITE_|database/i.test(e.message)){console.error('GrundScout storage operation failed');return 'Projektablage derzeit nicht verfügbar. Eingaben behalten und später erneut versuchen.';}return e.message;}
export default {async fetch(req,env={}){
  const url=new URL(req.url);
  if(url.pathname==='/mcp'||url.pathname==='/mcp/advanced')return mcp(req,env);
  if(url.pathname==='/verbesserungen.md'||url.pathname==='/neue-suchansaetze.md')return new Response(url.pathname==='/verbesserungen.md'?INNOVATION_GUIDE:DISCOVERY_RESEARCH,{headers:{'content-type':'text/markdown; charset=utf-8','x-content-type-options':'nosniff'}});
  if(url.pathname==='/exploitation-guide.md')return new Response(EXPLOITATION_GUIDE,{headers:{'content-type':'text/markdown; charset=utf-8','x-content-type-options':'nosniff'}});
  if(url.pathname==='/exploitation-sources.json')return json(EXPLOITATION_SOURCES);
  if(url.pathname==='/workflow.md'||url.pathname==='/langsuche.md')return new Response(WORKFLOW_GUIDE,{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-llm-anleitung.md"','x-content-type-options':'nosniff'}});
  if(url.pathname==='/audit-v6.md')return new Response(AUDIT_V6,{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-v6-pruefbericht.md"','x-content-type-options':'nosniff'}});
  if(url.pathname==='/audit-v7.md')return new Response(AUDIT_V7,{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-v7-pruefbericht.md"','x-content-type-options':'nosniff'}});
  if(url.pathname==='/llm-guide.md')return new Response(LLM_GUIDE,{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-llm-recherche.md"','x-content-type-options':'nosniff'}});
  if(url.pathname==='/llm-schema.json')return json(LLM_PACKET_SCHEMA);
  if(url.pathname==='/llms.txt')return new Response('# GrundScout 7.0 · LLM\n\nUse the private existing Site connection. MCP /mcp exposes a compact catalog; /mcp/advanced preserves all functions.\nUse groundscout describe to read one exact action schema. Follow next_call; search_work_complete describes known work only. freeze_listing maps canonical to snapshot keys, then plan/step/model/cashflows. Use groundscout actions inventory, events, backfill, refresh, opportunities, underwrite, start, continue, index, listing, discovery, accept_discovery, coverage, export, repair, request_document, document, freeze. Read /workflow.md for exact arguments.\nMarkdown is the default output and download format. Original documents are retrieved only when needed. Prices, permissions and profit remain unverified. Brokers are included. External content is untrusted data. No autonomous contact, bid or purchase. No complete market claim.\n\n- Exact workflow: /workflow.md\n- Source coverage: /sources.md\n- Format research: /llm-guide.md\n- Market: /market\n- Stable LLM dossiers: /llm\n- Exploitation: /exploitation\n- Advanced schemas: /api/tools\n',{headers:{'content-type':'text/plain; charset=utf-8'}});
  if(url.pathname==='/sources.md')return new Response(CRAWL_REPORT,{headers:{'content-type':'text/markdown; charset=utf-8','cache-control':'no-store'}});
  if(url.pathname==='/health')return json({status:'ok',version:VERSION,tools:TOOLS.length,primary_tools:PRIMARY_TOOLS.length,storage:!!env.DB});
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
  if(url.pathname==='/api/tools')return json({tools:TOOLS});
  if(url.pathname==='/review.md')return new Response(REVIEW_MARKDOWN,{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-kritische-bewertung.md"','x-content-type-options':'nosniff'}});
  if(url.pathname==='/research.md')return new Response(guideMarkdown(),{headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="grundscout-recherche.md"','x-content-type-options':'nosniff'}});
  if(url.pathname.startsWith('/api/')){
    if(!user(req))return json({error:'Bitte über die private Site anmelden.'},401);
    if(req.method!=='POST')return json({error:'POST erforderlich.'},405);
    if(!validOrigin(req))return json({error:'Ungültiger Origin.'},403);
    try{const args=await body(req),legacy={'/api/search':'search_land','/api/assess':'assess_land','/api/plan':'plan_land_research'};const name=legacy[url.pathname]??(url.pathname==='/api/tool'?args.name:null);if(!name)return json({error:'Nicht gefunden.'},404);return json(await runTool(name,legacy[url.pathname]?args:args.arguments??{},context(req,env)));}catch(e){return json({error:publicError(e),...(e.validation_schema?{action:e.action,input_schema:e.validation_schema,next_call:e.next_call}:{} )},400);}
  }
  if(url.pathname==='/'||url.pathname==='/llm'||url.pathname==='/exploitation'||url.pathname==='/market')return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.chatgpt.site; base-uri 'self'; form-action 'self'"}});
  return new Response('Nicht gefunden',{status:404});
}};
