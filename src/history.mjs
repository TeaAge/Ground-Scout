import {recordKey} from './market-identity.mjs';
import {validate} from './finance.mjs';
import {evidenceDB,textHash} from './evidence.mjs';
export const HISTORY_SCHEMA={type:'object',properties:{listing_id:{type:'string',maxLength:120},limit:{type:'integer',minimum:1,maximum:100,default:40}},additionalProperties:false};
export async function recordObservations(items,context){
  if(!context?.env?.DB||!context.userId)return {status:'unavailable',saved:0};
  const db=context.env.DB,statements=[],now=new Date().toISOString();
  for(const item of items.slice(0,250)){
    const canonical=await recordKey(item),payload={id:item.id,canonical_listing_key:canonical,title:item.title,location:item.location,source:item.source,source_url:item.source_url,price_eur:item.price_eur,valuation_eur:item.valuation_eur,area_m2:item.area_m2,fetched_at:item.fetched_at};
    const fingerprint=await textHash(JSON.stringify({...payload,fetched_at:undefined}));
    const id=await textHash(context.userId+'|'+canonical+'|'+fingerprint+'|'+String(item.fetched_at||now));
    statements.push(db.prepare('INSERT OR IGNORE INTO market_observations (id,owner_id,listing_id,source_url,fingerprint,payload,observed_at) VALUES (?,?,?,?,?,?,?)').bind(id,context.userId,canonical,item.source_url,fingerprint,JSON.stringify(payload),now));
  }
  const results=statements.length?await db.batch(statements):[];return {status:'saved',attempted:Math.min(items.length,250),omitted_by_limit:Math.max(0,items.length-250),saved:results.reduce((n,r)=>n+(r.meta?.changes||0),0),scope:'Beobachtete Quellenstichprobe für dein Konto. Erste Sichtung ist kein Veröffentlichungsdatum; fehlendes Angebot bedeutet keinen Verkauf.'};
}
export async function marketHistory(input={},context){
  const o=validate(HISTORY_SCHEMA,input),db=evidenceDB(context),query=o.listing_id?"SELECT * FROM market_observations WHERE owner_id=? AND (listing_id=? OR json_extract(payload,'$.id')=?) ORDER BY observed_at DESC, rowid DESC LIMIT ?":"SELECT * FROM market_observations WHERE owner_id=? ORDER BY observed_at DESC, rowid DESC LIMIT ?";
  const r=await db.prepare(query).bind(...(o.listing_id?[context.userId,o.listing_id,o.listing_id,o.limit]:[context.userId,o.limit])).all(),rows=r.results.map(x=>({observation_id:x.id,listing_id:x.listing_id,observed_at:x.observed_at,...JSON.parse(x.payload)}));
  if(o.listing_id)rows.reverse();const earliest=o.listing_id?await db.prepare("SELECT MIN(observed_at) AS first_at FROM market_observations WHERE owner_id=? AND (listing_id=? OR json_extract(payload,'$.id')=?)").bind(context.userId,o.listing_id,o.listing_id).first():null;
  const changes=[];if(o.listing_id)for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(a.price_eur!==b.price_eur||a.valuation_eur!==b.valuation_eur)changes.push({observed_at:b.observed_at,old_asking_price_eur:a.price_eur,new_asking_price_eur:b.price_eur,old_valuation_eur:a.valuation_eur,new_valuation_eur:b.valuation_eur});}
  return {observations:rows,price_changes:changes,first_observed_at:earliest?.first_at??null,scope:'Beobachtete Stichprobe, keine vollständige Markt- oder Transaktionshistorie.',sale_confirmed:false};
}
