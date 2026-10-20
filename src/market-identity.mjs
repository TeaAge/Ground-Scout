import {publicURL} from './network.mjs';
import {textHash} from './evidence.mjs';
import {withMediation} from './intermediation.mjs';
export function canonicalURL(raw){
 const u=publicURL(raw);for(const k of [...u.searchParams.keys()])if(/^(?:utm_.*|ref|referrer|tracking|_ga|_gl|gclid|fbclid)$/i.test(k))u.searchParams.delete(k);if(/(?:^|\.)zvg-portal\.de$/.test(u.hostname)&&u.searchParams.get('button')==='showAnhang'&&['/','/index.php'].includes(u.pathname))u.pathname='/index.php';u.searchParams.sort();return u.href;
}
export async function recordKey(r){
 if(r.listing_identity==='dataset_feature')return textHash('feature|'+(r.source_dataset_namespace||canonicalURL(r.source_url))+'|'+r.property_key);
 const host=new URL(r.source_url).hostname,path=new URL(r.source_url).pathname;
 const ka=path.match(/\/s-anzeige\/[^/]+\/(\d+)(?:-|\/|$)/);if(/(?:^|\.)kleinanzeigen\.de$/.test(host)&&(ka||/^ka:\d+$/.test(r.id||'')))return textHash('ka:'+ (ka?.[1]||r.id.slice(3)));
 if(host==='www.kip.net'&&/_G\d+/.test(decodeURI(path)))return textHash('kip:'+decodeURI(path).match(/_G(\d+)/)[1]);
 if(host==='www.diia.de'&&new URL(r.source_url).searchParams.has('loadObjectId'))return textHash('diia:'+new URL(r.source_url).searchParams.get('loadObjectId'));
 if(host==='www.bahnliegenschaften.de'&&/\/detailseite\/\d+-/.test(path))return textHash('db:'+path.match(/\/detailseite\/(\d+)-/)[1]);
 if(/^zvg:/.test(r.id||''))return textHash(r.id);
 const u=new URL(canonicalURL(r.source_url)),fid=u.searchParams.get('FID')||u.searchParams.get('fid');
 if(fid&&/^\d+\.\d+\.\d+$/.test(fid))return textHash(u.hostname+'|FID='+fid);
 return textHash(u.href+(r.listing_identity==='object_url'?'':'|'+String(r.property_key||r.title).toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim()));
}
export function mergeListing(old,incoming){
 const r=withMediation(incoming);if(!old)return {...r,conflicts:r.conflicts||[],observed_source_urls:[r.provenance?.url||r.source_url]};
 const conflicts=[...(old.conflicts||[])];for(const field of ['price_eur','area_m2','valuation_eur','minimum_offer_eur'])if(old[field]!=null&&r[field]!=null&&old[field]!==r[field])conflicts.push({field,old_value:old[field],new_value:r[field],old_source:old.provenance?.url||old.source_url,new_source:r.provenance?.url||r.source_url,observed_at:r.fetched_at,status:'unresolved_source_difference'});
 const detail=old.extraction_stage==='detail'&&r.extraction_stage!=='detail'||old.source_capture_origin!=='user_submitted_browser_html'&&r.source_capture_origin==='user_submitted_browser_html';const merged=detail?{...r,...old,last_observed_at:r.fetched_at}:{...old,...r};
 for(const field of ['price_eur','area_m2','valuation_eur','minimum_offer_eur','reference_value_eur','case_number','auction_date'])if(merged[field]==null&&old[field]!=null&&!(['price_eur','area_m2'].includes(field)&&(r.object_selection_required||r.price_unit_ambiguous||r.price_review_required||['minimum','range','conflicting','selection_required'].includes(r.area_kind))))merged[field]=old[field];
 if(!detail&&(r.price_unit_ambiguous||r.price_review_required||r.price_kind&& !/^asking_price/.test(r.price_kind))){merged.previous_price_claim_eur=old.price_eur??old.previous_price_claim_eur??r.previous_price_claim_eur??null;merged.price_eur=null;}
 if(['minimum','range','conflicting','selection_required'].includes(r.area_kind))merged.area_m2=null;
 if(r.object_selection_required){merged.price_eur=null;merged.area_m2=null;}
 const newer=r.fetched_at&&old.fetched_at&&Date.parse(r.fetched_at)>Date.parse(old.fetched_at);
 if(detail&&newer&&r.source_capture_origin!=='user_submitted_browser_html'&&(r.price_eur!==old.price_eur||r.price_unit_ambiguous||r.price_review_required||r.price_kind&&!/^asking_price/.test(r.price_kind))){
  merged.previous_price_claim_eur=old.price_eur;merged.latest_index_price_claim_eur=r.price_eur??null;merged.price_eur=null;merged.price_kind='ambiguous';merged.price_refresh_required=true;merged.issues=[...new Set([...(merged.issues||[]),'Neuere Preisangabe weicht vom alten Detail ab: aktuellen Gesamtpreis nachladen'])];
 }
 if(!detail&&r.extraction_stage==='detail'&&!r.price_unit_ambiguous&&!r.price_review_required&&r.price_eur!=null){merged.price_refresh_required=false;merged.price_review_required=false;merged.latest_index_price_claim_eur=null;merged.issues=(merged.issues||[]).filter(s=>!/^Neuere Preisangabe/.test(s));}
 merged.documents=[...new Map([...(old.documents||[]),...(r.documents||[])].map(d=>[d.url,d])).values()];
 merged.conflicts=[...new Map(conflicts.map(c=>[c.field+'|'+c.old_value+'|'+c.new_value,c])).values()].slice(-30);
 merged.observed_source_urls=[...new Set([...(old.observed_source_urls||[]),r.provenance?.url||r.source_url])].slice(-30);
 merged.price_verified=false;merged.permission_verified=false;merged.confirmed_undervaluation=false;merged.intermediation=detail?withMediation(merged).intermediation:r.intermediation;
 return merged;
}
