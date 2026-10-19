export function executionState(r){
 const f=r.frontier,pending=f.queued+f.working+f.waiting_agent+f.held+f.error+f.blocked+f.review,unresolved=f.held+f.error+f.blocked+f.review;
 const call=(action,parameters)=>({name:'groundscout',arguments:{action,parameters}}),job={job_id:r.job_id};
 let state,next;
 if(r.run_active){state='step_running';next=call('status',job);}
 else if(r.requires_normalization){state='normalization_required';next=call('repair',{...job,limit:40});}
 else if(r.status==='paused'){state='paused';next=call('control',{...job,action:'resume'});}
 else if(r.status==='budget_paused'&&f.queued){state='request_limit_reached';next=r.limits.max_requests<200000?call('control',{...job,action:'increase_limits',max_requests:Math.min(200000,Math.max(r.limits.max_requests+1000,r.requests_attempted+1000))}):call('tasks',{...job,status:'queued',limit:40});}
 else if(f.queued){state='queued_work';next=call('continue',{...job,request_budget:12,time_budget_ms:25000});}
 else if(f.working){state='interrupted_step_recovery';next=call('continue',{...job,request_budget:12,time_budget_ms:25000});}
 else if(f.waiting_agent){state='agent_research_pending';next=call('discovery',{...job,limit:4});}
 else if(f.held){state='limits_hold_work';next=call('tasks',{...job,status:'held',limit:40});}
 else if(f.error||f.blocked||f.review){state='unresolved_source_work';next=call('tasks',{...job,status:f.error?'error':f.blocked?'blocked':'review',limit:40});}
 else{state='known_work_exhausted';next=call('coverage',job);}
 return {state,search_work_complete:pending===0&&!r.run_active&&!r.requires_normalization,known_frontier_exhausted:pending===0,pending_tasks:pending,unresolved_tasks:unresolved,deferred_document_tasks:f.deferred,market_complete:false,next_call:next};
}
