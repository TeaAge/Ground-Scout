import {brokerDomain} from './source-catalog.mjs';
import {germanAmount} from './prices.mjs';
const MARKETPLACES=['immobilienscout24.de','immowelt.de','immonet.de','kleinanzeigen.de'];
export function mediation(text='',url='',sellerRole=null){
 let host='';try{host=new URL(url).hostname;}catch{}
 const marketplace=MARKETPLACES.some(h=>host===h||host.endsWith('.'+h));
 const free=/(?:provisionsfrei|ohne\s+(?:Makler|Provision|Courtage)|kein(?:e|erlei)\s+(?:zusätzliche\s+)?(?:Käuferprovision|Maklerprovision|Courtage|Provision)|Courtage\s*[:\-]?\s*0)/i.test(text);
 const roleEvidence=[...text.matchAll(/(?:Immobilienmakler|Maklerunternehmen|Maklerbüro|(?:Haus[- ]?\s+und[- ]?\s*)?Grundbesitzvermittlung|Immobilienvermittlung|im Auftrag (?:des Eigentümers|Dritter))/ig)].find(m=>!/(?:kein(?:e[rns]?)?|nicht|ohne)\s*$/i.test(text.slice(Math.max(0,m.index-25),m.index))),feeEvidence=/(?:Maklerprovision|Vermittlungsprovision|Käuferprovision|Courtage)/ig;
 const positive=roleEvidence||[...text.matchAll(feeEvidence)].find(m=>!/(?:ohne|kein(?:e|erlei)|keine zusätzliche)\s*$/i.test(text.slice(Math.max(0,m.index-35),m.index)));
 const privateClaim=sellerRole==='private'||/\b(?:Privat(?:anbieter|verkäufer)|von privat|Privater Anbieter)\b/i.test(text);
 const knownBroker=brokerDomain(host)&&!marketplace;
 const status=sellerRole==='broker'||knownBroker||roleEvidence||positive&&!free?'indicated':privateClaim?'private_claim':free?'direct_or_commission_free_claim':'unknown';
 const percent=/(?:Maklerprovision|Käuferprovision|Courtage|Provision)\s*[:\-]?\s*(\d{1,2}(?:[,.]\d{1,3})?)\s*%/i.exec(text);
 const fixed=/(?:Maklerprovision|Käuferprovision|Courtage|Mindestprovision|Vermittlungsprovision|Provision)\s*(?:(?:beträgt|in Höhe von|i\.?\s*H\.?\s*v\.?|pauschal|mindestens|min\.?|:|-)\s*)*(\d{1,3}(?:[. ]\d{3})+|\d+)(?:,\d{1,2})?\s*(?:€|EUR|Euro)/i.exec(text);
 const commission=percent?Number(percent[1].replace(',','.')):free?0:null;
 const fixedAmount=fixed?germanAmount(fixed[0].match(/(\d[\d. ]*(?:,\d{1,2})?)\s*(?:€|EUR|Euro)/i)?.[1]):null,conflict=free&&(commission>0||fixedAmount>0),mixed=commission>0&&fixedAmount>0&&!/Mindestprovision|mindestens/i.test(fixed[0]);
 return {status,seller_role_claim:sellerRole||(roleEvidence?'broker':privateClaim?'private':null),broker_indicated:status==='indicated',marketplace,commission_free_claim:free,commission_percent_claim:commission,commission_fixed_eur_claim:fixedAmount,commission_fixed_quote:fixed?.[0]||null,commission_combination_unknown:mixed,commission_conflict:conflict,commission_verified:false,evidence:positive?.[0]||null,basis:sellerRole?'seller_metadata_claim':knownBroker?'known_intermediary_domain':positive?'listing_text':privateClaim?'private_seller_claim':marketplace?'marketplace_does_not_identify_seller':'not_observed',notice:conflict?'Widersprüchliche Provisionsangaben: provisionsfrei und positive Provision. Vor Kostenprüfung klären.':status==='indicated'?'Makler/Vermittlung erkennbar. Breitere Vermarktung kann die Chance auf einen unentdeckten Preisvorteil verringern; das belegt weder Marktwert noch fehlende Rentabilität. Provision und Auftrag prüfen.':marketplace&&!privateClaim?'Portalangebot: Privatverkäufer oder Makler erst anhand der Anzeige feststellen.':null,profitability_verified:false};
}
export const withMediation=r=>({...r,intermediation:mediation(r.source_text||r.description||r.title,r.source_url,r.seller_role_claim||(r.intermediation?.basis==='seller_metadata_claim'?r.intermediation.seller_role_claim:null))});
