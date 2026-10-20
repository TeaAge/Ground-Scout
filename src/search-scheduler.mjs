// Deterministic acquisition utility; this is not a property or investment score.
export function taskRole(t){
 if(t.kind==='record_batch')return 'storage';
 if(['gov_catalogue','wfs_capabilities'].includes(t.kind))return 'catalogue';
 if(['geojson','gml_offer'].includes(t.kind))return 'feed';
 if(t.kind==='pdf')return 'document';
 if(['discovery','agent_discovery'].includes(t.kind))return 'discovery';
 if(t.kind==='sitemap')return 'directory';
 if(t.task_role)return t.task_role;
 const u=new URL(t.url);
 if(u.hostname==='www.kip.net'&&!/_G\d+|\/bauen\/grundstuecke/.test(u.pathname))return 'directory';
 if(t.kind==='zvg_detail'||t.stage==='detail'||t.parent_listing)return 'detail';
 return 'index';
}
export function rankTasks(rows,stats,requestNumber,mode='adaptive'){
 if(!rows.length)return [];
 const parsed=rows.map(r=>({...r,t:JSON.parse(r.payload)}));
 const cycle=['detail','detail','index','catalogue','index','detail','feed','directory','detail','discovery'],preferred=cycle[requestNumber%cycle.length];
 const exploration=mode==='breadth'||['directory','discovery','catalogue'].includes(preferred);
 const ranked=parsed.map(r=>{
  const s=stats.get(r.host)||{requests:0,unique:0,qualified:0},role=taskRole({...r.t,kind:r.kind}),novel=s.requests===0;
  const parent=r.t.parent_listing||{},amount=parent.price_eur,small=amount!=null&&amount<=20000;
  const uncertainBuilding=parent.building_status==='indicated'&&amount==null&&!(parent.minimum_total_price_claim_eur>20000);
  const utility=({detail:small?65:uncertainBuilding?61:14,feed:48,catalogue:40,index:35,discovery:30,directory:8,document:r.t.explicit_document_request?80:0})[role]||10;
  const yieldBonus=18*Math.log1p((s.unique+3*s.qualified)/(s.requests+1)),crowding=4*Math.log1p(s.requests);
  const score=(role==='document'&&r.t.explicit_document_request?10000:0)+(role===preferred?2000:0)+(exploration&&novel?200:0)+utility+yieldBonus-crowding-(r.priority||0)/8;
  return {...r,score,scheduling:{mode:exploration?'exploration':'yield_and_detail',preferred_role:preferred,role,observed_host_requests:s.requests,observed_unique_records:s.unique,observed_qualified_records:s.qualified,reason:role==='document'&&r.t.explicit_document_request?'explicit_document_request':novel?'unvisited_host':role==='detail'&&small?'check_small_price_claim':role==='detail'&&uncertainBuilding?'clarify_building_price_basis':role==='directory'?'regional_coverage':'observed_source_yield'}};
 });
 ranked.sort((a,b)=>b.score-a.score||a.created_at.localeCompare(b.created_at)||(a.rowid||0)-(b.rowid||0));
 return [...parsed.filter(r=>taskRole({...r.t,kind:r.kind})==='storage').map(r=>({...r,scheduling:{reason:'store_already_retrieved_records',network:false}})),...ranked.filter(r=>taskRole({...r.t,kind:r.kind})!=='storage')];
}
export const selectTask=(...args)=>rankTasks(...args)[0]||null;
