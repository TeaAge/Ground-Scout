const NUMBER='(?:\d{1,3}(?:[. \u00a0]\d{3})+|\d+)(?:[,.]\d{1,2})?';
const DASH='(?:[,.]\s*[-–—])?';
const CURRENCY='(?:Euro\b|EUR\b|€)';
const AREA_UNIT='(?:m²|m2|qm|Quadratmeter)';
const PRICED_AREA_UNIT='(?:'+AREA_UNIT+'|ha\b|Hektar\b|Ar(?:e|i)?\b)';
export const areaUnitDivisor=unit=>unit==='ha'?10000:unit==='ar'?100:1;
const unitOf=s=>/ha|Hektar/i.test(s)?'ha':/\bAr(?:e|i)?\b/i.test(s)?'ar':'m2';
export function germanAmount(value){
 let s=String(value).trim().replace(/\s/g,'').replace(/[,.][-–—]$/,'');
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
 const n=Number(s);return Number.isFinite(n)&&n>0?n:null;
}
export function areaEvidence(text,structuredArea=null){
 const minimum=new RegExp('(?:\\bab|mindestens|Mindest(?:fläche|größe)\\s*:?)(?:(?:ca\\.\\s*)|circa|etwa|ungefähr)\\s*)?('+NUMBER+')\\s*'+AREA_UNIT,'i').exec(text);
 const min=minimum?germanAmount(minimum[1]):null;
 const range=new RegExp('('+NUMBER+')\\s*(?:'+AREA_UNIT+'\\s*)?(?:bis|–|-)\\s*('+NUMBER+')\\s*'+AREA_UNIT,'i').exec(text);
 const low=range?Math.min(germanAmount(range[1]),germanAmount(range[2])):null,high=range?Math.max(germanAmount(range[1]),germanAmount(range[2])):null;
 const observations=minimum?[{kind:'minimum',area_m2:min,quote:minimum[0],start:minimum.index}]:[];
 if(range)observations.push({kind:'range',min_m2:low,max_m2:high,quote:range[0],start:range.index});
 if(structuredArea!=null)observations.push({kind:'structured_area_claim',area_m2:structuredArea});
 const conflict=min!=null&&structuredArea!=null&&structuredArea<min;
 return {area_kind:conflict?'conflicting':minimum?'minimum':range?'range':structuredArea?'specific_claim':'unknown',area_conflict:conflict,area_min_m2:min??low,area_max_m2:high,area_observations:observations,area_m2:conflict||minimum||range?null:structuredArea};
}
export function monetaryObservations(text){return [...String(text).matchAll(new RegExp('('+NUMBER+')'+DASH+'\\s*'+CURRENCY+'(\\s*(?:/|pro|je)\\s*'+PRICED_AREA_UNIT+')?','gi'))].map(m=>{
 const suffix=String(text).slice(m.index+m[0].length,m.index+m[0].length+55),prefix=String(text).slice(Math.max(0,m.index-45),m.index),period=/^\s*(?:p\.?\s*a\.?|/\s*(?:Jahr|a\b)|pro\s+Jahr|je\s+Jahr|jährlich|im\s+Jahr)/i.test(suffix)||/(?:jährlicher?\s+(?:Erbbauzins|Erbpacht|Pacht)|Erbbauzins\s*(?:pro\s+Jahr)?\s*:)\s*$/i.test(prefix)?'year':/^\s*(?:/\s*Monat|pro\s+Monat|je\s+Monat|monatlich)/i.test(suffix)?'month':null;
 const before=new RegExp('(?:pro|je)\\s*('+PRICED_AREA_UNIT+')\\s*(?:(?:kostet|beträgt|:|=)\s*)?$','i').exec(prefix);
 return {amount:germanAmount(m[1]),currency:'EUR',unit:m[2]?unitOf(m[2]):before?unitOf(before[1]):'object',...(period?{period}:{}),quote:before?before[0]+m[0]:m[0],start:before?m.index-before[0].length:m.index,end:m.index+m[0].length};}).filter(o=>o.amount!==null);}
export function explicitTotalPrice(text,amount){
 const label=new RegExp('(?<![\p{L}])(?:Gesamt(?:kauf)?preis|Kaufpreis|Preis)\s*:?\s*(?:von\s*)?(?:VB\s*|ca\.?\s*)?('+NUMBER+')'+DASH+'\s*'+CURRENCY+'(?!\\s*(?:/|pro|je))','giu');
 return [...String(text).matchAll(label)].some(m=>germanAmount(m[1])===amount&&!/^\s*(?:p\.?\s*a\.?|jährlich|monatlich)/i.test(String(text).slice(m.index+m[0].length,m.index+m[0].length+25)));
}
export function unitPriceIndicated(display,amount,description=''){
 const direct=new RegExp(CURRENCY+'\\s*(?:/|pro|je)\\s*'+AREA_UNIT,'i');
 if(direct.test(display))return true;
 const observations=monetaryObservations(description),matching=observations.some(o=>o.unit==='m2'&&o.amount===amount);
 const statedTotal=new RegExp('(?:Gesamt(?:kauf)?preis|Kaufpreis|Preis)\\s*:?\\s*(?:von\\s*)?(?:VB\\s*|ca\\.?\\s*)?('+NUMBER+')'+DASH+'\\s*'+CURRENCY+'(?!\\s*(?:/|pro|je))','i').exec(description);
 if(statedTotal&&germanAmount(statedTotal[1])===amount)return false;
 if(matching)return true;
 if(observations.some(o=>o.unit==='m2'))return false;
 return new RegExp('(?:angezeigte[rn]?\s+Preis|Festpreis)\s+(?:bezieht\s+sich|gilt|ist)\s*(?:auf|pro|je|für)\s*'+AREA_UNIT+'|(?:Preis|Kaufpreis)\s+(?:pro|je)\s*'+AREA_UNIT,'i').test(description);
}
export function priceAreaSelection(text,areaM2){
 const multiple=/(?:\b(?:[2-9]|[1-9]\d+|zwei|drei|vier|mehrere)\s+(?:Flurstück|Grundstück|Bauparzell)|aufgeteilt\s+in)/i.test(text),partial=[...text.matchAll(/Teilkauf|Teilverkauf|einzelne[rsn]?\s+(?:Flurstück|Grundstück|Parzelle)|einzeln\s*(?:verkauf|kauf|möglich)/ig)].some(m=>!/(?:kein(?:e[rns]?)?|nicht|ohne)\s*$/i.test(text.slice(Math.max(0,m.index-20),m.index))&&!/^\s*(?:ist\s+)?(?:ausgeschlossen|nicht\s+möglich|unmöglich)/i.test(text.slice(m.index+m[0].length,m.index+m[0].length+35))),claims=monetaryObservations(text),totals=new Set(claims.filter(o=>o.unit==='object').map(o=>o.amount));
 const required=multiple&&partial&&(totals.size>1||areaM2!=null);
 return {object_selection_required:required,...(required?{object_selection_reason:'Mehrere Teilobjekte mit möglichem Einzelkauf: Preis und Fläche müssen einem konkreten Kaufgegenstand zugeordnet werden.',monetary_claims:claims.slice(0,20),area_kind:'selection_required'}:{})};
}
export function priceEvidence(text,areaM2){
 const regex=new RegExp('(?<![\p{L}])(?:Mindest(?:gebot|angebot|kaufpreis)|Geringst(?:es\s+)?(?:Bar)?gebot|Verkehrswert|Orientierungs(?:wert|preis)|Kaufpreisvorstellung|Auktionslimit|Startpreis|Gesamtkaufpreis|Gesamtpreis|Kaufpreis|Aufgeld|Preis|Kaufangebot)\s*(?:\([^)]*\))?\s*[:\-]?\s*(?:(?:in\s+Höhe\s+)?von\s*)?(?:VB\s*|ca\.?\s*)?('+NUMBER+')(?:\s*%|\s*Prozent)?'+DASH+'\s*'+CURRENCY+'(\s*(?:/|pro|je)\s*'+PRICED_AREA_UNIT+')?','giu');
 const observations=[...text.matchAll(regex)].filter(m=>!/(?:\bkein(?:e[rns]?)?|\bnicht)\s*$/i.test(text.slice(Math.max(0,m.index-35),m.index))).map(m=>{const label=m[0].slice(0,m[1].length),kind=/^(?:Mindest|Geringst|Auktionslimit|Startpreis)/i.test(m[0])?'minimum_offer':/^Verkehrswert/i.test(m[0])?'valuation_reference':/^(?:Orientierungs|Kaufpreisvorstellung)/i.test(m[0])?'guide_value':/^Aufgeld/i.test(m[0])?'auction_premium':'asking_price',unit=m[2]?unitOf(m[2]):'object',amount=germanAmount(m[1]),period=monetaryObservations(text).find(o=>o.start>=m.index&&o.end<=m.index+m[0].length)?.period;return {kind,amount,currency:'EUR',unit,...(/%|Prozent/.test(label)?{premium_percent:true}:{}),...(period?{period}:{}),quote:m[0],start:m.index,end:m.index+m[0].length};}).filter(o=>o.amount!==null);
 const premium=new RegExp('(?<![\p{L}])Aufgeld\s*(?:\([^)]*\))?\s*[:\-]?\s*(?:(?:in\s+Höhe\s+)?von\s*)?('+NUMBER+')\s*(?:%|Prozent)','giu');
 for(const m of text.matchAll(premium))observations.push({kind:'auction_premium',amount:germanAmount(m[1]),currency:'EUR',unit:'percent',premium_percent:true,quote:m[0],start:m.index,end:m.index+m[0].length});
 const floor=new RegExp('Gebote?(?:\s*,)?(?:\s+die)?\s+unter(?:\s+einem)?(?:\s+Betrag)?(?:\s+von)?\s*('+NUMBER+')'+DASH+'\s*'+CURRENCY+'[^.!?]{0,180}\bsind\s+(?:grundsätzlich\s+)?nicht\s+zuschlagsfähig','giu');
 for(const m of text.matchAll(floor))observations.push({kind:'minimum_offer',amount:germanAmount(m[1]),currency:'EUR',unit:'object',quote:m[0],start:m.index,end:m.index+m[0].length});
 const base={price_eur:null,price_kind:'unknown',price_excerpt:null,price_observations:observations};
 const unitFirst=new RegExp('(?:Kaufpreis|Preis)\s+(?:pro|je)\s*('+PRICED_AREA_UNIT+')\s*(?:beträgt\s*|:)?\s*('+NUMBER+')'+DASH+'\s*'+CURRENCY,'gi');
 for(const m of text.matchAll(unitFirst))observations.push({kind:'asking_price',amount:germanAmount(m[2]),currency:'EUR',unit:unitOf(m[1]),quote:m[0],start:m.index,end:m.index+m[0].length});
 const reversed=new RegExp('(?:pro|je)\s*('+PRICED_AREA_UNIT+')\s*(?:(?:kostet|beträgt|:|=)\s*)?('+NUMBER+')'+DASH+'\s*'+CURRENCY,'gi');
 for(const m of text.matchAll(reversed))if(!observations.some(o=>o.start<=m.index&&o.end>=m.index+m[0].length))observations.push({kind:'asking_price',amount:germanAmount(m[2]),currency:'EUR',unit:unitOf(m[1]),quote:m[0],start:m.index,end:m.index+m[0].length});
 if(!observations.length)return {...base,price_kind:/nach gebot|bieterverfahren|gegen gebot/i.test(text)?'offer_required':'unknown'};
 if(observations.every(o=>o.period))return {...base,price_kind:'periodic_payment'};
 const purchaseObservations=observations.filter(o=>!o.period&&o.kind!=='auction_premium');
 if(!purchaseObservations.length)return {...base,price_kind:'unknown'};
 const total=o=>o.unit==='object'?o.amount:areaM2?Math.round(o.amount*areaM2/areaUnitDivisor(o.unit)*100)/100:null;
 const rank={minimum_offer:3,guide_value:2,valuation_reference:1,asking_price:0},o=[...purchaseObservations].sort((a,b)=>rank[b.kind]-rank[a.kind])[0],sameKind=purchaseObservations.filter(x=>x.kind===o.kind);
 const different=new Set(sameKind.map(o=>total(o)??o.amount));if(different.size>1)return {...base,price_kind:'ambiguous',conflicting_price_kind:o.kind,price_excerpt:sameKind.map(o=>o.quote).join(' | ').slice(0,500)};
 if(o.kind!=='asking_price')return {...base,price_kind:o.kind,[o.kind==='minimum_offer'?'minimum_offer_eur':'reference_value_eur']:o.unit==='object'?o.amount:total(o),price_excerpt:o.quote};
 if(/bieterverfahren|gegen gebot|nach gebot/i.test(text))return {...base,price_kind:'offer_required',price_excerpt:o.quote};
 return {...base,price_eur:total(o),price_kind:o.unit==='ha'?'asking_price_per_ha':o.unit==='ar'?'asking_price_per_ar':o.unit==='m2'?'asking_price_per_m2':'asking_price',price_excerpt:o.quote,...(o.unit==='m2'?{price_per_m2:o.amount}:o.unit==='ha'?{price_per_ha_eur:o.amount}:o.unit==='ar'?{price_per_ar_eur:o.amount}:{})};
}
