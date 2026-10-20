import {fetchPublic,publicURL} from './network.mjs';
import {parseDiscovery} from './discovery.mjs';
export function searchProvider(env={}){return env.LAND_SEARCH_PROVIDER==='brave'?'brave':'duckduckgo';}
export function providerURL(query,provider='duckduckgo',offset=0){if(provider==='brave')return 'https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(query)+'&country=de&search_lang=de&count=20&offset='+offset;return 'https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)+'&kl=de-de';}
export async function retrieveDiscovery(task,options,env={}){
 const provider=task.provider||'duckduckgo';
 if(provider==='brave'){
  if(!env.LAND_SEARCH_BRAVE_KEY)throw new Error('Brave-Suche ist gewählt, aber LAND_SEARCH_BRAVE_KEY fehlt in den Site-Secrets.');
  const r=await fetchPublic(task.url,{...options,headers:{accept:'application/json','X-Subscription-Token':env.LAND_SEARCH_BRAVE_KEY}}),d=JSON.parse(r.text||'{}'),links=[];
  if(!d.web||!Array.isArray(d.web.results))throw new Error('Such-API liefert keine lesbare Ergebnisliste.');
  for(const item of d.web.results)try{const u=publicURL(item.url);if(!/grundst|baupl|bauland|acker|grünland|wald|immobil|versteiger|landgesellschaft|liegenschaft|freifl|amtsblatt/i.test(item.title+' '+item.description+' '+u.href)||/ratgeber|lexikon|leitfaden|tipps|blog\//i.test(u.href))continue;links.push({url:u.href,title:item.title||u.hostname,snippet:item.description||'',discovered_via:r.url,discovery_kind:'retrieved_search_api',authority_verified:false});}catch{}
  const offset=Number(new URL(task.url).searchParams.get('offset'))||0,next=d.query?.more_results_available&&offset<9?[{kind:'discovery',url:providerURL(task.query,'brave',offset+1),query:task.query,provider:'brave'}]:[];
  return {...r,parsed:{links,next,total_results_on_page:d.web.results.length,provider:'brave',provider_result_limit_reached:!!d.query?.more_results_available&&offset>=9}};
 }
 const r=await fetchPublic(task.url,options);return {...r,parsed:parseDiscovery(r.text||'',r.url)};
}
export function discoveryCapabilities(env={}){return {provider:searchProvider(env),brave_key_configured:!!env.LAND_SEARCH_BRAVE_KEY,public_html_search_supported:true,public_html_search_may_be_blocked:true,provider_result_cap_is_not_market_completeness:true,credential_values_returned:false};}
