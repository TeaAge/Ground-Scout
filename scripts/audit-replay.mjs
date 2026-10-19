import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import {normalizeOffer} from '../src/offer-policy.mjs';
import {prepareListing,renderContext} from '../src/llm-context.mjs';
import {LLM_PACKET_SCHEMA} from '../src/llm-schema.mjs';
import {validateSearch,acquisitionEstimate} from '../src/core.mjs';
const input=process.argv[2],output=process.argv[3];if(!input||!output)throw new Error('Usage: audit-replay.mjs RECORDS_JSON OUTPUT_JSON');
const rows=JSON.parse(readFileSync(input,'utf8')),filters=validateSearch({budget_eur:20000,reserve_eur:3000}),validate=new Ajv({strict:false,allErrors:true}).compile(LLM_PACKET_SCHEMA),failures=[],kinds={};let quotes=0,packets=0,mdChars=0,jsonChars=0;
for(const raw of rows){try{
 const r=normalizeOffer(raw);assert.deepEqual(normalizeOffer(r),r,'Normalisation must be idempotent');kinds[r.offer_quality.kind]=(kinds[r.offer_quality.kind]||0)+1;
 if(r.offer_quality.excluded_from_sale_views||r.periodic_price_only){assert.equal(r.price_eur,null);assert.equal(acquisitionEstimate(r,filters).screening_total_eur,null);}
 if(['information','index'].includes(r.page_role))assert.equal(r.offer_quality.excluded_from_sale_views,true);
 if(r.germany_scope_status==='outside_germany_claim'){assert.equal(r.geo,null);assert.equal(r.state,null);}
 const {packet:p,source_text}=await prepareListing(r,{filters});packets++;assert.ok(validate(p),JSON.stringify(validate.errors));assert.equal(p.processing.investment_verified,false);
 for(const e of p.evidence){assert.equal(source_text.slice(e.start,e.end),e.quote);assert.equal(e.statement_verified,false);quotes++;}
 mdChars+=renderContext([p]).length;jsonChars+=renderContext([p],{format:'json'}).length;
 }catch(e){failures.push({id:raw.id,url:raw.source_url,title:raw.title,error:e.message});}}
const result={records:rows.length,packets_checked:packets,exact_quotes_checked:quotes,failures,kinds,markdown_characters:mdChars,json_characters:jsonChars,character_reduction_percent:jsonChars?Math.round((1-mdChars/jsonChars)*100):null,character_count_not_token_benchmark:true,profit_verified:false,market_complete:false};writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
