import {unitPriceIndicated,areaEvidence,priceEvidence,monetaryObservations,areaUnitDivisor} from './prices.mjs';
import {parseHTML} from 'linkedom';
import {clean,classify,parseSales,STATES,isWantedOrRental,germanDate} from './core.mjs';
import {landCandidate,landArea,parsePublicPage} from './crawler.mjs';
import {mediation} from './intermediation.mjs';
import {publicURL} from './network.mjs';
export const BIMA_API='https://apis.bundesimmobilien.de/immo/real_estate_offers/search?q=*&page_size=100&offset=0';
const land=/grundst|bauland|bauplatz|acker|grünland|forst|wald|freifl|land_plot|landplot|land_property|commercial_land/i;
export function bimaPage(json,url,profile,now){
 if(!Array.isArray(json.data)||!Number.isFinite(json.meta?.total))throw new Error('BImA-Schnittstelle: Liste/Gesamtzahl fehlen.');
 const candidates=[];
  for(const item of json.data){const a=item.attributes||{},title=clean(a.title||a.offer_id),text=clean([title,a.property_type,a.description_note,a.location_note,a.other_note].filter(Boolean).join(' '));if((a.property_type?!['buy_site','business_site'].includes(a.property_type):!land.test(text))||/RENT|LEASE/.test(a.commercialization_type||''))continue;
   const source_url='https://apis.bundesimmobilien.de/immo/real_estate_offers/'+item.id,source_text=JSON.stringify(a),isPrice= /purchase|buy|sale|selling|price/i.test(a.display_price_attribute_name||'')&&!/rent/i.test(a.display_price_attribute_name||'');
   const rawPrice=typeof a.display_price==='number'?a.display_price:null,price_eur=isPrice&&!a.price_on_application&&rawPrice>=100?rawPrice:null;
   const area= /plot|land|grund|total_area/i.test(a.display_area_attribute_name||'')&&typeof a.display_area==='number'?a.display_area:null;
   const bimaEvidence=priceEvidence(text,area),bimaPremium=bimaEvidence.price_observations.filter(o=>o.kind==='auction_premium');
  const state=Object.keys(STATES).find(k=>STATES[k].toLowerCase().replaceAll('ü','ue').replaceAll('ä','ae').replaceAll('ö','oe')===String(a.federal_state).replaceAll('_','-').toLowerCase())||null;
  const related=[...(item.relationships?.downloads?.data||[]),...(item.relationships?.expose?.data?[item.relationships.expose.data]:[])].map(d=>(json.included||[]).find(v=>v.id===d.id&&v.type===d.type)?.attributes).filter(Boolean),documents=[];for(const d of related){try{const u=publicURL(d.url||d.download_url||d.file_url);documents.push({url:u.href,title:d.title||d.name||'BImA-Dokument'});}catch{}}
  candidates.push({id:'bima:'+item.id,title,source:'sale',provider:'BImA Immobilienportal',source_category:'public_seller',source_type_origin:'curated_catalog',source_url,listing_identity:'object_url',property_key:a.offer_id,location:clean((a.postcode||'')+' '+(a.city||'')),state,price_eur:price_eur&&/Kaufpreisvorstellung|wirtschaftlichsten Angebot|Bieterverfahren/i.test(text)?null:price_eur,reference_value_eur:price_eur&&/Kaufpreisvorstellung|wirtschaftlichsten Angebot|Bieterverfahren/i.test(text)?price_eur:null,price_kind:price_eur&&/Kaufpreisvorstellung|wirtschaftlichsten Angebot|Bieterverfahren/i.test(text)?'guide_value':price_eur?'asking_price':'unknown',price_verified:false,price_observations:[...(price_eur?[{kind:/Kaufpreisvorstellung|wirtschaftlichsten Angebot|Bieterverfahren/i.test(text)?'guide_value':'asking_price',amount:price_eur,currency:'EUR',unit:'object',json_pointer:'/attributes/'+a.display_price_attribute_name}]:[]),...bimaPremium],auction_premium_eur:bimaPremium.length&&!bimaPremium[0].premium_percent?bimaPremium[0].amount:null,auction_premium_percent:bimaPremium.length&&bimaPremium[0].premium_percent?bimaPremium[0].amount:null,auction_terms_verified:false,area_m2:area,valuation_eur:null,...classify(text),documents,intermediation:mediation(text+' '+(a.has_courtage?'Maklerprovision '+(a.courtage||'')+' '+(a.courtage_note||''):''),source_url),fetched_at:now,description:text.slice(0,700),source_text,source_text_complete:true,source_text_basis:'public_bima_json_attributes',price_on_application_claim:!!a.price_on_application,display_price_claim:rawPrice,extraction_stage:'detail',provenance:{url,fetched_at:now,extractor:'public_bima_json',json_pointer:'/data/'+json.data.indexOf(item)},expired:!!a.deleted_at||!!a.published_until&&Date.parse(a.published_until)<Date.parse(now),bima_commercialization:a.commercialization_type,coordinates_claim:a.latitude&&a.longitude?{latitude:a.latitude,longitude:a.longitude,verified:false}:null});
 }
 const offset=Number(json.meta.offset)||Number(new URL(url).searchParams.get('offset'))||0,nextOffset=offset+json.data.length,next=[];
 if(nextOffset<json.meta.total){if(!json.data.length)throw new Error('BImA meldet weitere Angebote, liefert aber eine leere Seite.');const u=new URL(url);u.searchParams.set('offset',String(nextOffset));next.push({url:u.href,kind:'bima',profile,priority:12});}
 return {candidates,next,links:[],documents:[],total_available_records:json.meta.total,scanned_records:json.data.length,non_land_or_rental_records:json.data.length-candidates.length,parser:'public_bima_json',text:null};
}
export function auctionDetail(html,old,url,now){
 const {document}=parseHTML(html),fields={};for(const tr of document.querySelectorAll('tr')){const cells=tr.querySelectorAll('td');if(cells.length===2){const k=clean(cells[0].textContent),v=clean(cells[1].textContent);if(k.length<70&&v&&/Beschreibung|Objekt|Lage|Grund|Akten|Termin|Verkehrswert|Amtsgericht|Abteilung|Gebot/i.test(k))fields[k]=v;}}
 if(!Object.keys(fields).length||/ERROR: Ungültiger|ungültige Anfrage/i.test(html))throw new Error('ZVG-Detailseite enthält keine lesbaren Objektfelder.');
  const parsed=parsePublicPage(html,url,{id:'zvg',name:'ZVG-Portal · Justiz',category:'court'},now),text=clean(Object.entries(fields).map(([k,v])=>k+': '+v).join(' ')),areaText=fields.Beschreibung||fields['Objekt/Lage']||'',area=landArea(areaText),valueText=Object.entries(fields).find(([k])=>/^Verkehrswert/i.test(k))?.[1],value=valueText?priceEvidence('Verkehrswert: '+valueText,area).reference_value_eur:null,title=fields['Objekt/Lage']?.split(':')[0]||old.title;
  const auctionDate=germanDate(fields.Termin||'')||old.auction_date||null;
  const bidEvidence=priceEvidence(text,area),minimumBid=bidEvidence.minimum_offer_eur??null;
  return {...old,title,...classify(title+' '+text),valuation_eur:value??old.valuation_eur??null,valuation_raw:valueText||old.valuation_raw||null,auction_date:auctionDate,auction_label:fields.Termin||old.auction_label||null,canceled:/aufgehoben|eingestellt|abgesetzt/i.test(fields.Termin||'')||!!old.canceled,expired:!!auctionDate&&auctionDate<new Date(now).toISOString().slice(0,10),area_m2:area||old.area_m2,minimum_offer_eur:minimumBid??old.minimum_offer_eur??null,price_observations:bidEvidence.price_observations.length?bidEvidence.price_observations:old.price_observations,documents:[...new Map([...(old.documents||[]),...parsed.documents].map(d=>[d.url,d])).values()],source_text:text,source_text_complete:text.length<=64000,description:areaText.slice(0,700),fetched_at:now,extraction_stage:'detail',provenance:{url,fetched_at:now,extractor:'official_zvg_detail_fields'},intermediation:mediation(text,url),parcel_mentions:[...text.matchAll(/Flurstück(?:e|snummer)?\s*[:\-]?\s*(\d+(?:\s*\/\s*\d+)?)/gi)].map(m=>m[1]),auction_terms_verified:false};
}
export function salesPage(html,url,profile,now){const candidates=parseSales(html,new Date(now)).map(r=>({...r,listing_identity:'object_url',extraction_stage:'index'}));const {document}=parseHTML(html),next=[];
 for(const a of document.querySelectorAll('a[href]'))if(/next/i.test(a.getAttribute('rel')||'')||/Nächste|Weiter|^\d+$/.test(clean(a.textContent))&&/seite:\d+/.test(a.getAttribute('href')||''))try{const u=publicURL(new URL(a.getAttribute('href'),url).href);if(u.hostname==='www.kleinanzeigen.de')next.push({url:u.href,kind:'classifieds',profile,priority:12});}catch{}
 if(!candidates.length&&!/keine (?:Anzeigen|Ergebnisse)|0 Ergebnisse|Noch keine Anzeigen/i.test(html))throw new Error('Kleinanzeigen-Seite nicht als lesbare Angebotsliste erkannt.');
 return {candidates,next,links:[],documents:[],parser:'classified_cards',total_available_records:Number(clean(document.querySelector('h1')?.textContent).match(/von\s+([\d.]+)/)?.[1]?.replaceAll('.',''))||null,scanned_records:document.querySelectorAll('article[data-adid]').length,text:null};}
export function classifiedDetail(html,url,profile,now){
 const {document}=parseHTML(html),h=document.querySelector('#viewad-title,h1'),title=clean(h?.textContent);
 const section=document.querySelector('#viewad-description-text,#viewad-description'),info=document.querySelector('#viewad-main-info'),priceNode=document.querySelector('#viewad-price,.ad-price'),address=document.querySelector('#viewad-locality');
 if(!h||!section||/^(?:suche|gesucht|gesuch|wir suchen|ich suche)\b|\bgesucht\b/i.test(title))return null;
 const sellerText=clean([...document.querySelectorAll('#viewad-contact,#viewad-imprint,#viewad-user-info,.userprofile-vip')].map(n=>n.textContent).join(' '));
 const text=clean([title,info?.textContent,section.textContent,document.querySelector('#viewad-details')?.textContent,sellerText].filter(Boolean).join(' '));
 const priceText=clean(priceNode?.textContent),amount=Number(priceText.match(/[\d.]+(?:,\d{1,2})?/)?.[0]?.replaceAll('.','').replace(',','.'))||null;
 const pricedUnit=monetaryObservations(priceText+' '+text).find(o=>o.unit!=='object'&&o.amount===amount)?.unit||(unitPriceIndicated(priceText,amount,text)?'m2':'object'),unit=pricedUnit!=='object';
 const structuredArea=landArea(clean(document.querySelector('#viewad-details')?.textContent||'')),areaFacts=areaEvidence(text,structuredArea),area=areaFacts.area_m2;
 const ambiguous=/Neubaugebiet|(?:neues?|freie)\s+(?:Baugebiet|Bauplätze)|freie Bauplätze/i.test(title)&&!unit;
 const placeholder=amount!==null&&amount<100&&/VB|verhandel|Symbol|Platzhalter/i.test(priceText+' '+text);
 const total=ambiguous||placeholder?null:unit?area&&amount?amount*area/areaUnitDivisor(pricedUnit):null:amount;
 const rental=isWantedOrRental(title)||/(?:Art|Angebotsart)\s*:?\s*(?:Mieten|Miete|Pacht)\b/i.test(clean(document.querySelector('#viewad-details')?.textContent));
 const priceObservation=monetaryObservations(text).find(o=>o.amount===amount&&o.unit===pricedUnit);
 const r=landCandidate(text+' Kaufangebot',rental?'Grundstück Angebot':title,url,profile,now,0,{source_text:text,price_eur:total,price_kind:placeholder||amount===null?'unknown':unit?'asking_price_per_'+pricedUnit:'asking_price',price_observations:priceObservation?[{...priceObservation,kind:'asking_price'}]:[],price_excerpt:priceText,area_m2:area,location:clean(address?.textContent)||null,extractor:'classified_detail_fields'});
 if(!r)return null;r.title=title;Object.assign(r,areaFacts);if(rental){r.price_eur=null;r.price_kind='not_for_sale';r.transaction_type='rental';}r.listing_identity='object_url';r.extraction_stage='detail';r.price_unit_ambiguous=ambiguous||areaFacts.area_conflict;r.display_price_eur_claim=amount;
 if(unit&&areaFacts.area_min_m2)r.minimum_total_price_claim_eur=amount*areaFacts.area_min_m2/areaUnitDivisor(pricedUnit);
 if(areaFacts.area_conflict)r.issues.push('Flächenwiderspruch: Portalfläche unterschreitet textliche Mindestfläche; Gesamtkaufpreis offen');
 if(ambiguous){r.price_eur=null;r.price_kind='unknown';r.issues.push('Preis-/Flächeneinheit eines Baugebietsangebots ungeklärt');}
 const seller=sellerText;r.seller_role_claim=/Privater (?:Anbieter|Nutzer)|Privatperson/i.test(seller)?'private':/Gewerblicher (?:Anbieter|Nutzer)|Immobilienmakler/i.test(seller)?'commercial':null;
 r.intermediation=mediation(text,url,r.seller_role_claim);
 return r;
}
export function offerBlocks(parsed,html,url,profile,now){
 const {document}=parseHTML(html);const extra=[];
 // These profiles have identifiable per-object cards; an enclosing category list is never a single object.
 for(const block of document.querySelectorAll('a.grundstueckTeaser,.property-item,.immobilie-teaser,.real-estate-item,.objekt-teaser')){const h=block.querySelector('h2,h3,h4'),a=block.matches('a[href]')?block:block.querySelector('a[href]');if(!h||!a)continue;try{const target=publicURL(new URL(a.getAttribute('href'),url).href),text=clean(block.textContent);const r=landCandidate(text,clean(h.textContent),target.href,profile,now);if(r){r.listing_identity='object_url';r.extraction_stage='index';r.provenance.url=url;extra.push(r);}}catch{}}
 return {...parsed,candidates:[...parsed.candidates,...extra]};
}
