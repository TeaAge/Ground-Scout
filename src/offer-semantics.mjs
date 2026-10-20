import {monetaryObservations} from './prices.mjs';

const nonObject=/ratgeber|lexikon|rechts(?:grundlage|beratung)|gesetz(?:estext|gebung|buch)?|grundstücksverkehrsgesetz|häufige fragen|\bfaq\b|datenschutz|impressum|cookie|newsletter|karriere|pressemitteilung|photovoltaik.{0,30}(?:beratung|wissen|grundlagen)|(?:tipps|leitfaden|informationen)\s+(?:zum|zur|für|über)\s+(?:grundstück|kauf|verkauf|photovoltaik|zwangsversteiger)/i;
export function objectPageURL(raw){try{const u=new URL(raw);return /\/s-anzeige\/|\/objekt\/|\/expose\/|\/(?:detailseite|grundstueckdetailseite)\/|_G\d+/i.test(u.pathname)||u.searchParams.get('button')==='showZvg'||u.searchParams.has('loadObjectId');}catch{return false;}}
export function pageRole(title='',url='',text='',{objectEvidence=false}={}){
 let path='';try{path=decodeURIComponent(new URL(url).pathname);}catch{}
 if(nonObject.test(title)||/(?:^|\/)(?:ratgeber|lexikon|faq|impressum|datenschutz|newsletter|karriere|gesetze)(?:\/|$)/i.test(path))return 'information';
 if(!objectPageURL(url)&&(/\/(?:gegend|gegend-new)\//i.test(path)||/^(?:Baugrundstücke|Grundstücke|Bauplätze|Immobilien)\s+(?:kaufen|zum Kauf|in|zu verkaufen)\b/i.test(title)&&/Suchauftrag|Suche anpassen|Ergebnisse|Anzeigen/i.test(text)))return 'index';
 if(/\b(?:gesucht|gesuch)\b|^(?:suche|wir suchen|ich suche)\b/i.test(title))return 'wanted';
 if(/^(?:Grundstücke|Baugrundstücke|Immobilienangebote|Immobilien|Zwangsversteigerungen|Versteigerungstermine|Unsere Angebote)(?:\s*[–|\-].*)?$/i.test(title)&&!objectEvidence||/^(?:Baugrundstücke\s*(?:&|und)\s*Baugebiete|Grundstücksangebote\s*(?:im|in|der|für)|Übersicht\s+(?:der|aller)\s+(?:Grundstücke|Angebote))\b/i.test(title))return 'index';
 if(objectEvidence)return 'object';
 const land=/grundst[üu]ck|grundstueck|bauplatz|bauland|acker|wiese|flurstück|wald|freifläche/i.test(title);
 const offer=/verkauf|kaufpreis|mindestgebot|bieterverfahren|verkehrswert|zwangsversteiger|(?:zum|zu)\s+(?:kauf|verkauf)|angebot|objektnummer|objektbeschreibung/i.test(text);
 const concrete=/\d[\d., ]*\s*(?:m²|m2|qm|ha|\bAr\b|Ari\b)|\b\d{5}\s+[\p{L}]+|flurstück\s*\d|aktenzeichen\s*[:\w]|(?:Kaufpreis|Mindestgebot|Verkehrswert)\s*:?\s*\d/i.test(text);
 return land&&offer&&concrete?'object':'unclassified';
}
const FOREIGN=[['XK',/\b(?:Kosovo|Gjakov[aeë]|Prizren|Prishtin[aeë])\b/i],['AL',/\b(?:Albanien|Shkoder|Tirana)\b/i],['TR',/\b(?:Türkei|Türkiye|Antalya|Alanya)\b/i],['ES',/\b(?:Spanien|Mallorca|Teneriffa)\b/i],['PT',/\b(?:Portugal|Algarve)\b/i],['IT',/\b(?:Italien|Sizilien|Sardinien)\b/i],['GR',/\b(?:Griechenland|Kreta)\b/i],['BG',/\bBulgarien\b/i],['RO',/\bRumänien\b/i],['HR',/\bKroatien\b/i],['AT',/\bÖsterreich\b/i],['CH',/\bSchweiz\b/i],['FR',/\bFrankreich\b/i],['US',/\b(?:USA|Florida)\b/i]];
export function propertyGeography(r,text){
 // Publisher addresses are not parcel coordinates. Foreign names need an object-location context.
 for(const [country,re] of FOREIGN){const m=re.exec(text);if(!m)continue;const before=text.slice(Math.max(0,m.index-140),m.index);
  const noun='(?:Grundstück(?:e|s)?|Grundstueck|Land|Fläche(?:n)?|Parzelle(?:n)?|Objekt)',place='(?:in|bei|nahe|Nähe(?:\\s+von)?|von)';
  const locationMatch=new RegExp(noun+'\\s+(?:(?:liegt|liegen|befindet\\s+sich|befinden\\s+sich|ist\\s+gelegen|sind\\s+gelegen)\\s+[^.!?]{0,65})?'+place+'\\s*$','i').exec(before),located=!!locationMatch&&!/Käufer|Kunden|Besucher|Anbieter|Eigentümer|Verkäufer|Sprache/i.test(locationMatch[0]);
  const labelled=/(?:Lage|Standort|Objektadresse)\s*[:\-]\s*(?:[^.!?]{0,50},\s*)?$/i.test(before),selling=/\b(?:verkaufen|verkauft|Verkauf|kaufen|Kauf)\s+(?:in|bei)\s*$/i.test(before);
  if(located||labelled||selling)return {property_country_claim:country,property_location_claim:m[0],publisher_location_claim:r.publisher_location_claim||r.location||null,property_location_basis:'listing_location_statement',germany_scope_status:'outside_germany_claim',property_location_verified:false};
 }
 const derived=r.property_location_basis==='listing_location_statement',country=derived?null:r.property_country_claim||null;
 return {property_country_claim:country,property_location_claim:derived?null:r.property_location_claim||null,publisher_location_claim:r.publisher_location_claim||null,property_location_basis:derived?'publisher_or_listing_location_unverified':r.property_location_basis||'publisher_or_listing_location_unverified',germany_scope_status:country&&country!=='DE'?'outside_germany_claim':'not_independently_verified',property_location_verified:false};
}
export function transactionEvidence(r,text){
 const observations=monetaryObservations(text),periodic=observations.filter(o=>o.period),lease=[...text.matchAll(/\b(?:Erbpacht|Erbbau(?:recht|zins|grundstück)|Erbbaurechtsgrundstück)\b/ig)].find(m=>!/(?:kein(?:e[rns]?)?|nicht|ohne)\s*$/i.test(text.slice(Math.max(0,m.index-25),m.index)));
 const lump=/((?:Kaufpreis|Ablöse|Preis)\s+(?:für\s+)?(?:das\s+)?Erbbaurecht)\b/i.test(text);
 const rental=r.transaction_type==='rental'||/\b(?:verpachte|vermiete|zu vermieten|zur miete|zur pacht|zu verpachten|zum anpachten|mietgarten|pachtgarten)\b/i.test(r.title||'')||/(?:Art|Angebotsart|Transaktionsart)\s*:?\s*(?:Mieten|Miete|Pacht)\b|zur\s+(?:Pacht|Miete)\s+(?:steht|stehen)/i.test(text);
 return {acquisition_subject:lease?'leasehold':rental?'rental':r.acquisition_subject||'unverified_land_purchase',periodic_payment_claims:periodic,periodic_price_only:periodic.some(o=>o.amount===(r.display_price_eur_claim??r.periodic_payment_eur_claim??r.price_eur))&&!lump,leasehold_lump_sum_explicit:lump,transaction_type:lease?'leasehold':rental?'rental':r.transaction_type||'sale_claim',transaction_evidence:lease?.[0]||null,transaction_verified:false};
}
