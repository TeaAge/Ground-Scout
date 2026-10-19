// Public-source adapter audit. This does not connect to or mutate the deployed Site.
import {mkdirSync,writeFileSync} from 'node:fs';
import {localDatabase} from './local-db.mjs';
import {createSearchJob,runSearchJob,getSearchJob,getSearchTasks,listSearchResults,exportSearchContext,controlSearchJob} from '../src/search-jobs.mjs';
import {coverageSearch} from '../src/search-maintenance.mjs';
import {prepareListing,renderContext} from '../src/llm-context.mjs';
import {TOOLS,PRIMARY_TOOLS} from '../src/tools.mjs';
const steps=Number(process.argv[2]||12),dir=process.argv[3]||'/tmp/grundscout-v7-audit',resume=process.argv.find(v=>v.startsWith('--resume='))?.slice(9),allSources=!process.argv.includes('--selected-sources');
if(!Number.isInteger(steps)||steps<1||steps>500)throw new Error('1–500 begrenzte Schritte angeben; weitere Sitzung per --resume=JOB_ID.');
mkdirSync(dir,{recursive:true});const DB=localDatabase(dir+'/audit.sqlite'),ctx={userId:'local-audit',env:{DB}};
const job=resume?await getSearchJob({job_id:resume},ctx):await createSearchJob({title:'V7 · begrenzter öffentlicher Adaptertest',include_catalog:true,source_ids:allSources?[]:['bima','diia','kip','bahn','bvvg','lgsa'],include_discovery:allSources,include_auctions:true,include_classifieds:true,discover_sitemaps:allSources,read_pdfs:false,filters:{budget_eur:20000,reserve_eur:3000},scheduler:'adaptive',max_requests:steps*12},ctx);
if(resume&&job.limits.max_requests<job.requests_attempted+steps*12)await controlSearchJob({job_id:job.job_id,action:'increase_limits',max_requests:Math.min(200000,job.requests_attempted+steps*12)},ctx);
console.log(JSON.stringify({scope:'bounded_local_public_adapter_test',production_site_used:false,complete_run:false,all_catalog_sources_enabled:allSources,job_id:job.job_id,steps,document_policy:job.document_policy}));
try{
 const execution=[];let lastRequests=job.requests_attempted,busySince=null,zeroSteps=0;
 for(let i=0,attempt=0;i<steps;attempt++){
  const r=await runSearchJob({job_id:job.job_id,request_budget:12,time_budget_ms:25000},ctx),entry={attempt:attempt+1,completed_step:i+1,processed:r.step.processed,reason:r.step.reason||null,requests:r.requests_attempted,records:r.records.total,queued:r.frontier.queued,pdfs:r.document_windows,reports:r.step.reports};execution.push(entry);console.log(JSON.stringify(entry));
  writeFileSync(dir+'/steps.json',JSON.stringify(execution,null,2));
  if(r.step.reason==='another_step_running'){
   busySince??=Date.now();if(Date.now()-busySince>155000)throw new Error('Active lease prevented progress for155seconds; no fake completed steps counted.');
   await new Promise(resolve=>setTimeout(resolve,1000));continue;
  }
  busySince=null;if(r.step.processed>0||r.requests_attempted>lastRequests){i++;zeroSteps=0;}else zeroSteps++;
  lastRequests=r.requests_attempted;if(!r.frontier.queued||['budget_paused','paused'].includes(r.status))break;
  if(zeroSteps>=3)throw new Error('Three steps without progress despite queued work. Inspect steps.json and frontier.');
 }
 const status=await getSearchJob({job_id:job.job_id},ctx),coverage=await coverageSearch({job_id:job.job_id},ctx);
 writeFileSync(dir+'/status.json',JSON.stringify(status,null,2));writeFileSync(dir+'/coverage.json',JSON.stringify(coverage,null,2));
 const rows=[];let offset=0;do{const r=await listSearchResults({job_id:job.job_id,offset,limit:100,format:'raw',include_expired:true,include_non_sales:true},ctx);rows.push(...r.items);offset=r.next_offset;}while(offset!==null);
 writeFileSync(dir+'/records.json',JSON.stringify(rows,null,2));
 const md=[];offset=0;do{const r=await exportSearchContext({job_id:job.job_id,offset,limit:100,format:'markdown',detail:'brief',max_chars:100000,include_expired:true,include_non_sales:true,sort:'price'},ctx);md.push(r.text);if(!r.manifest.included&&r.manifest.next_offset!==null)throw new Error('Export budget blocked.');offset=r.manifest.next_offset;}while(offset!==null);writeFileSync(dir+'/angebote.md',md.join('\n'));
 const tasks=[];offset=0;do{const r=await getSearchTasks({job_id:job.job_id,offset,limit:100},ctx);tasks.push(...r.tasks);offset=r.next_offset;}while(offset!==null);writeFileSync(dir+'/tasks.json',JSON.stringify(tasks,null,2));
 let mdChars=0,jsonChars=0;for(const r of rows.slice(0,50)){const p=(await prepareListing(r)).packet;mdChars+=renderContext([p]).length;jsonChars+=renderContext([p],{format:'json'}).length;}
 const result={scope:'bounded_local_public_adapter_test',production_site_used:false,complete_run:status.search_work_complete,step_limit:steps,all_catalog_sources_enabled:allSources,observed_records:rows.length,non_sales_quarantined:status.records.non_sales_quarantined,quality_funnel:coverage.funnel,source_yield:coverage.source_yield,shared_source_url_records:rows.length-new Set(rows.map(r=>r.source_url)).size,shared_url_note:'Amtliche Feeds können mehrere getrennte Grundstücke unter derselben URL enthalten. Keine bewiesenen Grundstücksdubletten.',pdf_windows:status.document_windows,queued:status.frontier.queued,queued_by_role:status.queued_by_role,failed_or_review:status.unresolved_tasks,execution_summary:status.execution_summary,next_call:status.next_call,markdown_characters:mdChars,verbose_json_characters:jsonChars,markdown_character_reduction_percent:jsonChars?Math.round((1-mdChars/jsonChars)*100):null,character_measure_is_not_llm_quality_benchmark:true,primary_catalog_chars:JSON.stringify(PRIMARY_TOOLS).length,advanced_catalog_chars:JSON.stringify(TOOLS).length,market_complete:false};
 writeFileSync(dir+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({final:result,artifacts:dir}));
}finally{DB.close();}
