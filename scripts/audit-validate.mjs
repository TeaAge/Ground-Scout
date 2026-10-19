import {readFileSync,writeFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {TOOLS} from '../src/tools.mjs';
import {ACTION_SCHEMAS} from '../src/scout.mjs';
const dir=process.argv[2];if(!dir)throw new Error('Usage: audit-validate.mjs ARTIFACT_DIRECTORY');
const report=JSON.parse(readFileSync(dir+'/function-coverage.json','utf8')),ajv=new Ajv({strict:false,allErrors:true}),validators=new Map(TOOLS.filter(t=>t.outputSchema).map(t=>[t.name,ajv.compile(t.outputSchema)]));
let checked=0;const failures=[],semanticFailures=[],successful=new Set(),actions=new Set();
for(const entry of report.calls){
 if(entry.is_error||!entry.file)continue;const call=JSON.parse(readFileSync(dir+'/'+entry.file)),result=call.response?.result?.structuredContent;successful.add(entry.name);if(entry.action)actions.add(entry.action);
 if(validators.has(entry.name)){checked++;const validate=validators.get(entry.name);if(!validate(result))failures.push({id:entry.id,name:entry.name,errors:validate.errors});}
 if(entry.name==='underwrite_land_scenario'||entry.action==='underwrite'){
  if(result.price_satisfies_scenario===false&&result.status==='scenario_feasible')semanticFailures.push({id:entry.id,reason:'Overpriced entered scenario labelled feasible'});
  if('stress_loss_eur' in result||'capital_eur' in result)semanticFailures.push({id:entry.id,reason:'Ambiguous old ceiling names'});
 }
 if(result.investment_ready===true||result.investment_verified===true)semanticFailures.push({id:entry.id,reason:'Unverified test data promoted to investment readiness'});
}
const result={registered_tools:TOOLS.length,successfully_invoked:successful.size,missing_tools:TOOLS.filter(t=>!successful.has(t.name)).map(t=>t.name),missing_facade_actions:Object.keys(ACTION_SCHEMAS).filter(a=>!actions.has(a)),call_count:report.calls.length,technical_errors:report.calls.filter(c=>c.is_error),output_schema_checked_calls:checked,output_schema_failures:failures,semantic_failures:semanticFailures,scope:'Actual local worker JSON-RPC; public HTTP and labelled explicit hypothetical examples. Production account transport not impersonated.',market_complete:false};
writeFileSync(dir+'/validation.json',JSON.stringify(result,null,2));
writeFileSync(dir+'/FUNKTIONSMATRIX.md','# Tatsächlich ausgeführte Funktionen\n\n'+result.scope+'\n\n| Funktion | Aufrufe | Fehlerantworten |\n|---|---:|---:|\n'+TOOLS.map(t=>{const calls=report.calls.filter(c=>c.name===t.name);return '| '+t.name+' | '+calls.length+' | '+calls.filter(c=>c.is_error).length+' |';}).join('\n')+'\n');
console.log(JSON.stringify(result,null,2));
if(result.missing_tools.length||result.missing_facade_actions.length||result.technical_errors.length||failures.length||semanticFailures.length)process.exitCode=1;
