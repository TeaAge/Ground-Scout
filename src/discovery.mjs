import {parseHTML} from 'linkedom';
import {publicURL} from './network.mjs';
import {STATES,clean} from './core.mjs';
export const DISCOVERY_TEMPLATES=[
 'Gemeinde {region} Grundstücksverkauf Ausschreibung Bauplatz',
 'Stadt {region} Immobilienangebote Grundstück Verkauf',
 'Amtsgericht {region} Zwangsversteigerung Grundstück Gutachten',
 'Landgesellschaft {region} Grundstücke Kauf Angebote',
 'Grundstück {region} Restfläche Teilfläche Mindestgebot',
 'Baugrundstück {region} günstig kaufen 10000 20000',
 'Acker Grünland Wald {region} Grundstück Verkauf',
 'Amtsblatt {region} Grundstück Verkauf Ausschreibung pdf',
 'Grundstück {region} Immobilienauktion Internetauktion',
 'Gewerbegrundstück {region} Freifläche Photovoltaik Verkauf',
 'Grundstück {region} Insolvenz Nachlass Abbruchgrundstück',
 'Bauplatz {region} privat provisionsfrei Grundstück kaufen'
];
export function discoveryQueries(state='all',extra=[]){const regions=state==='all'?Object.values(STATES):[STATES[state]];return [...new Set([...regions.flatMap(region=>DISCOVERY_TEMPLATES.map(t=>t.replace('{region}',region))),...extra])];}
export function discoveryURL(query){return 'https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)+'&kl=de-de';}
export function parseDiscovery(html,url){
 const {document}=parseHTML(html),links=[];
 if(/anomaly|challenge-form|duckduckgo.*captcha/i.test(html))throw new Error('Suchmaschine zeigt eine technische Zugriffssperre; Suchaufgabe bleibt als blockiert sichtbar.');
 for(const a of document.querySelectorAll('.result__a')){
  try{const u=new URL(a.getAttribute('href'),url),raw=u.searchParams.get('uddg')||u.href,target=publicURL(raw).href;
   const block=a.closest('.result');const title=clean(a.textContent),snippet=clean(block?.querySelector('.result__snippet')?.textContent);
   if(!/grundst|baupl|bauland|acker|grünland|wald|immobil|versteiger|landgesellschaft|liegenschaft|freifl|amtsblatt/i.test(title+' '+snippet+' '+target))continue;
   if(/ratgeber|lexikon|wiki|leitfaden|tipps|blog\//i.test(target))continue;
   links.push({url:target,title,snippet,discovered_via:url,discovery_kind:'retrieved_search_result',authority_verified:false});
  }catch{}
 }
 const next=[];
 for(const form of document.querySelectorAll('form'))if(/Next|Weiter|Nächste/i.test(form.textContent)||form.querySelector('input[value="Next"]')){
  const params=new URLSearchParams();for(const input of form.querySelectorAll('input[name]'))if(input.getAttribute('type')!=='submit')params.append(input.getAttribute('name'),input.getAttribute('value')||'');
  if(!params.has('q')||!params.has('s'))continue;const u=publicURL(new URL(form.getAttribute('action')||'/html/',url).href);if(u.hostname!=='html.duckduckgo.com')continue;
  next.push({url:u.origin+u.pathname+'?'+params.toString(),kind:'discovery',query:params.get('q')});
 }
 if(!document.querySelector('.result__a')&&!/No results|Keine Ergebnisse/i.test(html))throw new Error('Suchergebnisse nicht extrahierbar; kein Nachweis einer leeren Suche.');
 return {links,next,total_results_on_page:document.querySelectorAll('.result__a').length,accepted_source_links:links.length,market_complete:false};
}
export function sitemapEntries(xml,base){
 const {document}=parseHTML(xml),index=/sitemapindex/i.test(xml),entries=[];
 for(const e of document.querySelectorAll('loc'))try{const url=publicURL(new URL(e.textContent.trim(),base).href).href;if(index||/grundst|baupl|bauland|acker|gruenland|wald|immobil|objekt|verkauf|angebot|ausschreib|versteiger|expose|amtsblatt/i.test(url))entries.push({url,kind:index?'sitemap':/\.pdf(?:$|\?)/i.test(url)?'pdf':'page'});}catch{}
 return {entries,index,total_locations:document.querySelectorAll('loc').length,scope:'Sitemap-URLs nach Grundstücks-/Angebotshinweisen; nicht die gesamte Website.'};
}
