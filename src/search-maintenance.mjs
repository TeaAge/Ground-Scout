import {NORMALIZATION_VERSION} from './versions.mjs';
import {acquisitionSQL} from './acquisition-sql.mjs';
import {validate} from './finance.mjs';
import {evidenceDB} from './evidence.mjs';
import {canonicalURL,recordKey} from './market-identity.mjs';
import {documentPurpose,normalizeOffer} from './offer-policy.mjs';
import {reprojectInventory} from './market-inventory.mjs';
import {getSearchJob,saveRecords,enqueueTasks,importSearchURLs,JOB_IMPORT_SCHEMA,JOB_ID_SCHEMA} from './search-jobs.mjs';
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,120}$'};
async function own(jobId,ctx){await getSearchJob({job_id:jobId},ctx);return evidenceDB(ctx);}
export const REPAIR_SCHEMA=object({job_id:id,upgrade_document_policy:{type:'boolean',default:true},after_rowid:{type:'integer',minimum:0,default:0},through_rowid:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100,default:40}},['job_id']);
export async function repairSearch(input,ctx){
 const o=validate(REPAIR_SCHEMA,input),db=await own(o.job_id,ctx),status=await getSearchJob({job_id:o.job_id},ctx);if(status.run_active)throw new Error('Erst den laufenden Suchschritt abschließen; Normalisierung danach fortsetzen.');
 const lease=crypto.randomUUID(),stamp=new Date().toISOString(),until=new Date(Date.now()+150000).toISOString();const claim=await db.prepare('UPDATE search_jobs SET lease_token=?,lease_until=? WHERE id=? AND owner_id=? AND (lease_token IS NULL OR lease_until<?)').bind(lease,until,o.job_id,ctx.userId,stamp).run();if(!claim.meta.changes)throw new Error('Ein Such-/Normalisierungsschritt läuft bereits.');
 try{
 if(o.upgrade_document_policy){
 const row=await db.prepare('SELECT config FROM search_jobs WHERE id=? AND owner_id=?').bind(o.job_id,ctx.userId).first(),config={...JSON.parse(row.config),read_pdfs:false};
 await db.prepare('UPDATE search_jobs SET config=? WHERE id=? AND owner_id=?').bind(JSON.stringify(config),o.job_id,ctx.userId).run();
 await db.prepare("UPDATE search_tasks SET status='deferred',report=? WHERE job_id=? AND owner_id=? AND kind='pdf' AND status='queued' AND COALESCE(json_extract(payload,'$.explicit_document_request'),0)=0").bind(JSON.stringify({status:'deferred',reason:'document_on_demand',notice:'Gezielt per request_document lesen.'}),o.job_id,ctx.userId).run();
}
 const ceiling=o.through_rowid??(await db.prepare('SELECT max(rowid) AS n FROM search_listings WHERE job_id=? AND owner_id=?').bind(o.job_id,ctx.userId).first()).n??0;
 const rows=(await db.prepare('SELECT rowid,listing_key,payload,first_seen,last_seen FROM search_listings WHERE job_id=? AND owner_id=? AND rowid>? AND rowid<=? ORDER BY rowid LIMIT ?').bind(o.job_id,ctx.userId,o.after_rowid,ceiling,o.limit).all()).results;
 let merged=0,excluded=0,symbolic=0;
 for(const row of rows){const r=normalizeOffer(JSON.parse(row.payload)),key=await recordKey(r);excluded+=r.offer_quality.excluded_from_sale_views?1:0;symbolic+=r.offer_quality.symbolic_price?1:0;
  await saveRecords(o.job_id,[r],ctx,false);
  await reprojectInventory(r,ctx);
  // Upsert precedes removal. Original observations/snapshots are untouched; source URLs and conflicts survive merging.
  if(key!==row.listing_key){await db.prepare('UPDATE search_listings SET first_seen=min(first_seen,?),last_seen=max(last_seen,?) WHERE job_id=? AND owner_id=? AND listing_key=?').bind(row.first_seen,row.last_seen,o.job_id,ctx.userId,key).run();await db.prepare('DELETE FROM search_listings WHERE job_id=? AND owner_id=? AND listing_key=?').bind(o.job_id,ctx.userId,row.listing_key).run();merged++;}
 }
 const cursor=rows.at(-1)?.rowid??o.after_rowid,more=await db.prepare('SELECT count(*) AS n FROM search_listings WHERE job_id=? AND owner_id=? AND rowid>? AND rowid<=?').bind(o.job_id,ctx.userId,cursor,ceiling).first();
 if(!more.n){const r=await db.prepare('SELECT config FROM search_jobs WHERE id=? AND owner_id=?').bind(o.job_id,ctx.userId).first();const config={...JSON.parse(r.config),normalization_version:NORMALIZATION_VERSION};await db.prepare('UPDATE search_jobs SET config=? WHERE id=? AND owner_id=?').bind(JSON.stringify(config),o.job_id,ctx.userId).run();}
 return {job_id:o.job_id,processed:rows.length,rekeyed_or_merged:merged,non_sales_quarantined:excluded,symbolic_prices_opened:symbolic,through_rowid:ceiling,next_after_rowid:more.n?cursor:null,history_preserved:true};
 }finally{await db.prepare('UPDATE search_jobs SET lease_token=NULL,lease_until=NULL WHERE id=? AND owner_id=? AND lease_token=?').bind(o.job_id,ctx.userId,lease).run();}
}
export const AGENT_SCHEMA=object({job_id:id,task_key:{type:'string',pattern:'^[a-f0-9]{64}$'},urls:{...JOB_IMPORT_SCHEMA.properties.urls,minItems:0},exhausted_query:{type:'boolean',default:false}},['job_id','task_key','urls']);
export async function acceptDiscovery(input,ctx){
 const o=validate(AGENT_SCHEMA,input),db=await own(o.job_id,ctx),task=await db.prepare('SELECT status,payload FROM search_tasks WHERE job_id=? AND owner_id=? AND task_key=? AND kind=?').bind(o.job_id,ctx.userId,o.task_key,'agent_discovery').first();if(!task)throw new Error('Eigene LLM-Suchaufgabe nicht gefunden.');
 const links=o.urls.length?await importSearchURLs({job_id:o.job_id,urls:o.urls},ctx):{added:0};
 const payload=JSON.parse(task.payload),report={query:payload.query,status:'provided',links_added:links.added,exhausted_query_claim:o.exhausted_query,origin:'agent_search_results',independent_query_verification:false,market_complete:false};
 await db.prepare('UPDATE search_tasks SET status=?,report=?,updated_at=? WHERE job_id=? AND owner_id=? AND task_key=?').bind(o.exhausted_query?'done':'waiting_agent',JSON.stringify(report),new Date().toISOString(),o.job_id,ctx.userId,o.task_key).run();
 return {job_id:o.job_id,...report,next_action:links.added?'continue':'Nächste Suchanfrage oder weitere Ergebnisse ergänzen'};
}
export async function coverageSearch(input,ctx){
 input=validate(JOB_ID_SCHEMA,input);const db=await own(input.job_id,ctx),args=[input.job_id,ctx.userId],jobStatus=await getSearchJob(input,ctx);
 if(jobStatus.requires_normalization)return {job_id:input.job_id,status:'needs_repair',requires_normalization:true,funnel:null,queued_by_role:jobStatus.queued_by_role,execution_summary:jobStatus.execution_summary,next_call:jobStatus.next_call,market_complete:false,investment_verified:false,notice:'Alte numerische Filter/Funnel erst nach vollständiger Normalisierung erneut berechnen.'};
 const records=(await db.prepare("SELECT json_extract(payload,'$.provider') AS provider,count(*) AS observations,sum(COALESCE(json_extract(payload,'$.offer_quality.excluded_from_sale_views'),0)) AS non_sales,sum(CASE WHEN asking_price IS NULL THEN 1 ELSE 0 END) AS price_open FROM search_listings WHERE job_id=? AND owner_id=? GROUP BY provider ORDER BY observations DESC").bind(...args).all()).results;
 const tasks=(await db.prepare("SELECT host,kind,status,count(*) AS tasks,sum(COALESCE(json_extract(report,'$.scanned_records'),0)) AS records_scanned,max(json_extract(report,'$.total_available_records')) AS largest_reported_source_result_count FROM search_tasks WHERE job_id=? AND owner_id=? GROUP BY host,kind,status ORDER BY host,kind,status").bind(...args).all()).results;
 const config=JSON.parse((await db.prepare('SELECT config FROM search_jobs WHERE id=? AND owner_id=?').bind(...args).first()).config),model=acquisitionSQL(config.filters),costs=model.sql;
 const sale="COALESCE(json_extract(payload,'$.offer_quality.excluded_from_sale_views'),0)=0 AND expired=0 AND COALESCE(json_extract(payload,'$.reserved'),0)=0",valid="source='sale' AND asking_price IS NOT NULL AND COALESCE(json_extract(payload,'$.price_unit_ambiguous'),0)=0 AND COALESCE(json_extract(payload,'$.price_review_required'),0)=0 AND COALESCE(json_extract(payload,'$.price_refresh_required'),0)=0 AND COALESCE(json_extract(payload,'$.object_selection_required'),0)=0";
 const funnel=await db.prepare("SELECT count(*) AS total_stored,sum(CASE WHEN "+sale+" THEN 1 ELSE 0 END) AS active_sale_candidates,sum(CASE WHEN "+sale+" AND "+valid+" THEN 1 ELSE 0 END) AS coherent_price_claims,sum(CASE WHEN "+sale+" AND "+valid+" AND ("+costs+")<=? THEN 1 ELSE 0 END) AS capital_model_candidates,sum(CASE WHEN "+sale+" AND "+valid+" AND ("+costs+")<=? AND json_extract(payload,'$.extraction_stage')='detail' AND COALESCE(json_extract(payload,'$.source_stale'),0)=0 AND COALESCE(json_extract(payload,'$.reserved'),0)=0 THEN 1 ELSE 0 END) AS detail_backed_capital_model_candidates,sum(CASE WHEN json_extract(payload,'$.area_conflict')=1 THEN 1 ELSE 0 END) AS area_conflicts,sum(CASE WHEN json_extract(payload,'$.source_stale')=1 THEN 1 ELSE 0 END) AS source_stale FROM search_listings WHERE job_id=? AND owner_id=?").bind(...model.args,config.filters.budget_eur,...model.args,config.filters.budget_eur,...args).first();
 const yieldStats=(await db.prepare("SELECT host,sum(CASE WHEN kind='record_batch' THEN 0 ELSE 1 END) AS logical_read_tasks,sum(COALESCE(json_extract(report,'$.new_unique_records'),0)) AS new_job_records,sum(COALESCE(json_extract(report,'$.new_market_records'),0)) AS new_cross_job_records,sum(COALESCE(json_extract(report,'$.changed_market_records'),0)) AS source_change_claims,sum(COALESCE(json_extract(report,'$.qualified_detail_records'),0)) AS detail_quality_gains FROM search_tasks WHERE job_id=? AND owner_id=? AND attempts>0 GROUP BY host ORDER BY new_job_records DESC").bind(...args).all()).results;
 return {job_id:input.job_id,providers:records,tasks,funnel,source_yield:yieldStats,queued_by_role:jobStatus.queued_by_role,execution_summary:jobStatus.execution_summary,next_call:jobStatus.next_call,investment_verified:false,market_complete:false,notice:'Quell-Gesamtzahlen können sich über Regionen/Seiten überschneiden und dürfen nicht summiert werden. Verzeichnisaufgaben sind keine bekannten Angebote. Aktive Kandidaten schließen Reservierungen und abgelaufene Anzeigen aus. Leere, blockierte und unlesbare Quellen bleiben getrennt.'};
}
export const DOCUMENT_REQUEST_SCHEMA=object({job_id:id,url:{type:'string',maxLength:2000},title:{type:'string',maxLength:250,default:''},listing_key:{type:'string',pattern:'^[a-f0-9]{64}$'},page_start:{type:'integer',minimum:1,maximum:10000,default:1}},['job_id','url']);
export async function requestDocument(input,ctx){
 const o=validate(DOCUMENT_REQUEST_SCHEMA,input);const db=await own(o.job_id,ctx);
 if(o.listing_key&&!await db.prepare('SELECT listing_key FROM search_listings WHERE job_id=? AND owner_id=? AND listing_key=?').bind(o.job_id,ctx.userId,o.listing_key).first())throw new Error('Eigene Anzeige nicht gefunden.');
 const result=await enqueueTasks(o.job_id,[{kind:'pdf',url:canonicalURL(o.url),page_start:o.page_start,parent_key:o.listing_key||null,profile:{id:'requested_document',name:'Gezielt angeforderte Quelle'},priority:5,explicit_document_request:true}],ctx);
 await db.prepare("UPDATE search_tasks SET status='queued',priority=5 WHERE job_id=? AND owner_id=? AND kind='pdf' AND url=? AND COALESCE(json_extract(payload,'$.page_start'),1)=? AND status='deferred'").bind(o.job_id,ctx.userId,canonicalURL(o.url),o.page_start).run();
 return {job_id:o.job_id,...result,document:documentPurpose(o),next_action:'continue',format_after_read:'markdown',verified:false};
}
