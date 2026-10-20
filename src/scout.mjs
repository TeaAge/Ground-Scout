import {opportunities,underwrite,OPPORTUNITY_SCHEMA,UNDERWRITE_SCHEMA,explicitModelSchema} from './opportunities.mjs';
import {inventoryRows,inventoryEvents,backfillInventory,inventoryRefreshTasks,repairInventory,INVENTORY_REPAIR_SCHEMA,INVENTORY_SCHEMA,EVENTS_SCHEMA,BACKFILL_SCHEMA,REFRESH_SCHEMA} from './market-inventory.mjs';
import {validate,RESALE_SCHEMA,DEVELOPMENT_SCHEMA,AUCTION_SCHEMA,USE_SCHEMA} from './finance.mjs';
import {PLAN_SCHEMA,STEP_SCHEMA,EXPLOITATION_GUIDE_SCHEMA,planExploitation,exploitationStep,exploitationGuide} from './exploitation.mjs';
import {MODEL_SCHEMA,CASHFLOW_SCHEMA,runExploitationModel,calculateCashflows} from './exploitation-finance.mjs';
import {enqueueTasks,createSearchJob,runSearchJob,getSearchJob,listSearchJobs,getSearchTasks,getSearchListing,exportSearchContext,controlSearchJob,retrySearchJob,snapshotSearchJob,importSearchURLs,listSearchDocuments,getSearchDocument,freezeSearchListing,JOB_FREEZE_LISTING_SCHEMA,JOB_ID_SCHEMA,JOB_TASK_SCHEMA,JOB_LIST_SCHEMA,JOB_GET_LISTING_SCHEMA,JOB_CONTROL_SCHEMA,JOB_RETRY_SCHEMA,JOB_DOCUMENT_SCHEMA,JOB_SNAPSHOT_SCHEMA,JOB_IMPORT_SCHEMA,JOB_EXPORT_SCHEMA,JOB_CREATE_SCHEMA,JOB_RUN_SCHEMA} from './search-jobs.mjs';
import {acceptDiscovery,repairSearch,coverageSearch,requestDocument,REPAIR_SCHEMA,AGENT_SCHEMA,DOCUMENT_REQUEST_SCHEMA} from './search-maintenance.mjs';
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
export const ACTION_SCHEMAS={
 repair_inventory:INVENTORY_REPAIR_SCHEMA,inventory:INVENTORY_SCHEMA,events:EVENTS_SCHEMA,backfill:BACKFILL_SCHEMA,refresh:REFRESH_SCHEMA,
 opportunities:OPPORTUNITY_SCHEMA,underwrite:UNDERWRITE_SCHEMA,start:JOB_CREATE_SCHEMA,continue:JOB_RUN_SCHEMA,status:JOB_ID_SCHEMA,jobs:JOB_LIST_SCHEMA,
 control:JOB_CONTROL_SCHEMA,retry:JOB_RETRY_SCHEMA,tasks:JOB_TASK_SCHEMA,index:JOB_EXPORT_SCHEMA,listing:JOB_GET_LISTING_SCHEMA,export:JOB_EXPORT_SCHEMA,coverage:JOB_ID_SCHEMA,
 discovery:object({job_id:JOB_ID_SCHEMA.properties.job_id,offset:{type:'integer',minimum:0,default:0},limit:{type:'integer',minimum:1,maximum:100,default:4}},['job_id']),
 accept_discovery:AGENT_SCHEMA,import_urls:JOB_IMPORT_SCHEMA,repair:REPAIR_SCHEMA,documents:JOB_ID_SCHEMA,request_document:DOCUMENT_REQUEST_SCHEMA,document:JOB_DOCUMENT_SCHEMA,freeze:JOB_SNAPSHOT_SCHEMA,
 freeze_listing:JOB_FREEZE_LISTING_SCHEMA,plan:PLAN_SCHEMA,step:STEP_SCHEMA,guide:EXPLOITATION_GUIDE_SCHEMA,model:MODEL_SCHEMA,cashflows:CASHFLOW_SCHEMA
};
ACTION_SCHEMAS.documents=JOB_TASK_SCHEMA;
const modelSchemas={resale:RESALE_SCHEMA,development:DEVELOPMENT_SCHEMA,auction:AUCTION_SCHEMA,use:USE_SCHEMA};
const DESCRIBE_SCHEMA=object({action_name:{type:'string',enum:['all',...Object.keys(ACTION_SCHEMAS),'describe'],default:'all'},model:{type:'string',enum:Object.keys(modelSchemas)}});
ACTION_SCHEMAS.describe=DESCRIBE_SCHEMA;
export const SCOUT_SCHEMA=object({action:{type:'string',enum:Object.keys(ACTION_SCHEMAS)},parameters:{type:'object',default:{},additionalProperties:true,description:'Action-specific fields: call describe with action_name first. Validation errors include the exact schema. No invented field aliases.'}},['action']);
export function describeAction(input={}){
 const o=validate(DESCRIBE_SCHEMA,input);if(o.action_name==='all')return {actions:Object.keys(ACTION_SCHEMAS),next_call:{name:'groundscout',arguments:{action:'describe',parameters:{action_name:'start'}}},instruction:'Request one action schema as needed; full catalog is not repeated.'};
 return {action:o.action_name,input_schema:ACTION_SCHEMAS[o.action_name],...(o.model?{model:o.model,explicit_parameter_schema:explicitModelSchema(modelSchemas[o.model])}:{}),unknown_means:null,automatic_default_model_assumptions:false};
}
const instructions='Quellenbehauptungen bleiben unbestätigt; unbekannt ist nicht null Euro. Makler sind enthalten. PDFs nur bei konkretem Bedarf. Für Gewinnprüfung eingefrorenen Bestand und Verwertungs-/Vollkostenmodelle verwenden.';
export async function scout(input,ctx){try{return await executeScout(input,ctx);}catch(e){const action=input?.action;if(ACTION_SCHEMAS[action]){e.action=action;e.validation_schema=ACTION_SCHEMAS[action];e.next_call={name:'groundscout',arguments:{action:'describe',parameters:{action_name:action}}};}throw e;}}
async function executeScout(input,ctx){
 const o=validate(SCOUT_SCHEMA,input);let p;
 try{p=validate(ACTION_SCHEMAS[o.action],o.parameters);}catch(e){e.action=o.action;e.validation_schema=ACTION_SCHEMAS[o.action];e.next_call={name:'groundscout',arguments:{action:'describe',parameters:{action_name:o.action}}};throw e;}
 if(o.action==='describe')return describeAction(p);
 if(o.action==='freeze_listing')return freezeSearchListing(p,ctx);
 if(o.action==='plan')return planExploitation(p,ctx);
 if(o.action==='step')return exploitationStep(p,ctx);
 if(o.action==='guide')return exploitationGuide(p);
 if(o.action==='model')return runExploitationModel(p);
 if(o.action==='cashflows')return calculateCashflows(p);
 if(o.action==='repair_inventory')return repairInventory(p,ctx);
 if(o.action==='inventory')return inventoryRows(p,ctx);
 if(o.action==='events')return inventoryEvents(p,ctx);
 if(o.action==='backfill')return backfillInventory(p,ctx);
 if(o.action==='opportunities')return opportunities(p,ctx);
 if(o.action==='underwrite')return underwrite(p);
 if(o.action==='refresh'){const r=await inventoryRefreshTasks(p,ctx),added=await enqueueTasks(r.job_id,r.tasks,ctx);return {job_id:r.job_id,...added,notice:r.notice,next_action:'continue';}
 if(o.action==='start'){const r=await createSearchJob(validate(JOB_CREATE_SCHEMA,p),ctx);return compactStatus(r);}
 if(o.action==='continue'){const r=await runSearchJob(validate(JOB_RUN_SCHEMA,p),ctx);return {...compactStatus(r),step:r.step};}
 if(o.action==='status')return compactStatus(await getSearchJob(p,ctx));
 if(o.action==='control')return compactStatus(await controlSearchJob(p,ctx));
 if(o.action==='retry')return retrySearchJob(p,ctx);
 if(o.action==='tasks')return getSearchTasks(p,ctx);
 if(o.action==='jobs')return listSearchJobs(p,ctx);
 if(['index','export'].includes(o.action))return exportSearchContext({sort:'price',detail:o.action==='index'?'brief':'dossier',...p,format:'markdown'},ctx);
 if(o.action==='listing')return getSearchListing({...p,format:'markdown'},ctx);
 if(o.action==='coverage')return coverageSearch(p,ctx);
 if(o.action==='discovery'){const r=await getSearchTasks({...p,status:'waiting_agent',kind:'agent_discovery',limit:p.limit||4},ctx);return {...r,instruction:'Mit deiner verfügbaren Websuche diese Queries abarbeiten; relevante HTTPS-Angebots-/Quellenlinks mit accept_discovery übergeben. Weitere Ergebnisse verfolgen. Danach continue liest die Seiten tatsächlich. Ergebnislinks/Quellensnippets sind kein Eigentums-, Preis- oder Baurechtsnachweis.',tasks:r.tasks.map(t=>({task_key:t.task_key,query:t.query||t.report?.query||null,url:t.url,status:t.status}))};}
 if(o.action==='accept_discovery')return acceptDiscovery(p,ctx);
 if(o.action==='import_urls')return importSearchURLs(p,ctx);
 if(o.action==='repair')return repairSearch(p,ctx);
 if(o.action==='documents')return listSearchDocuments(p,ctx);
 if(o.action==='request_document')return requestDocument(p,ctx);
 if(o.action==='document'){
  const d=await getSearchDocument(p,ctx),start=d.offset_chars,end=start+d.text.length;
  const spans=(d.metadata.page_spans||[{page:d.metadata.page_start,start:0,end:d.total_chars}]).filter(s=>s.end>start&&s.start<end);
  const quote=s=>s.split('\n').map(v=>'> '+v.replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/`/g,'\\`')).join('\n');
  const pages=spans.map(s=>'## Originalseite '+s.page+'\n\n'+quote(d.text.slice(Math.max(0,s.start-start),Math.min(d.text.length,s.end-start))));
  const text='# Quellendokument · unverifiziert\n\nQuelle: '+d.url+'\nGelesene Seiten: '+d.metadata.page_start+'–'+d.metadata.page_end+' / '+d.metadata.total_pages+'\nSHA-256: '+d.metadata.bytes_sha256+'\nTextcursor: '+start+'–'+end+'\n\n'+pages.join('\n\n');
  const {text:rawText,...metadata}=d;return {...metadata,text,format:'markdown',raw_text_next_tool:'get_land_search_document'};
 }
 if(o.action==='freeze')return snapshotSearchJob(p,ctx);
}
function compactStatus(r){return {job_id:r.job_id,title:r.title,status:r.status,requests:r.requests_attempted,records:r.records,frontier:r.frontier,queued_by_role:r.queued_by_role,requires_normalization:r.requires_normalization,limits:r.limits,document_policy:r.document_policy,market_complete:false,search_work_complete:r.search_work_complete,execution_summary:r.execution_summary,next_call:r.next_call,next_action:r.next_call?.arguments.action,rules:instructions};}
