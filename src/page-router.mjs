import {parseHTML} from 'linkedom';
import {parsePublicPage} from './crawler.mjs';
import {classifiedDetail,salesPage,auctionDetail,offerBlocks} from './adapters.mjs';
import {portalPage} from './portal-adapters.mjs';
import {normalizeOffer} from './offer-policy.mjs';
import {pageRole} from './offer-semantics.mjs';
import {clean,parseAuctions} from './core.mjs';

// Every entry point uses the same domain-specific parser. Related ads never become main-object facts.
export function parseOfferPage(html,url,profile={id:'inspection',name:'Öffentliche Quelle',category:'direct_seller'},now=new Date().toISOString(),{parent=null}={}){
 const u=new URL(url),{document}=parseHTML(html);let parsed;
 if(/(?:^|\.)kleinanzeigen\.de$/.test(u.hostname)){
  if(u.pathname.startsWith('/s-anzeige/')){const record=classifiedDetail(html,url,profile,now);parsed={candidates:record?[record]:[],links:[],documents:record?.documents||[],text:record?.source_text||'',title:record?.title||clean(document.querySelector('h1')?.textContent),parser:'classified_detail_fields',next:[]};}
  else if(document.querySelector('article[data-adid]')||/keine (?:Anzeigen|Ergebnisse)|0 Ergebnisse/i.test(html))parsed={...salesPage(html,url,profile,now),title:clean(document.querySelector('h1')?.textContent),text:''};
 }
 if(/(?:^|\.)zvg-portal\.de$/.test(u.hostname)&&u.searchParams.get('button')==='showZvg'){
  const state=u.searchParams.get('land_abk')||profile.state||parent?.state||'unknown',id=u.searchParams.get('zvg_id');
  const record=auctionDetail(html,parent||{id:'zvg:'+state+':'+id,title:'Grundstück Zwangsversteigerung',source:'auction',provider:'ZVG-Portal · Justiz',source_url:url,state,price_eur:null,price_kind:'court_valuation',documents:[]},url,now);
  parsed={candidates:[record],links:[],documents:record.documents,text:record.source_text,title:record.title,parser:'official_zvg_detail',next:[]};
 }else if(/(?:^|\.)zvg-portal\.de$/.test(u.hostname)&&/<!--Aktenzeichen-+>/i.test(html))parsed={candidates:parseAuctions(html,profile.state||u.searchParams.get('land_abk')||'unknown',new Date(now)),links:[],documents:[],text:'',title:'Amtliche Versteigerungstermine',parser:'official_zvg_state_list',next:[]};
 if(!parsed)parsed=portalPage(html,url,profile,now)||offerBlocks(parsePublicPage(html,url,profile,now),html,url,profile,now);
 const candidates=(parsed.candidates||[]).map(normalizeOffer),role=pageRole(parsed.title||clean(document.querySelector('h1')?.textContent),url,parsed.text||'',{objectEvidence:candidates.length===1});
 return {...parsed,title:parsed.title||clean(document.querySelector('h1,title')?.textContent),text:parsed.text??candidates.map(c=>c.source_text).join('\n\n'),candidates,links:parsed.links||[],documents:parsed.documents||[],next:parsed.next||[],parser:parsed.parser||'generic_html',page_role:role};
}
