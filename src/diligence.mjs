import {validate,money} from './finance.mjs';
import {SOURCES} from './research.mjs';

const CHECKS=[
  {id:'ownership',title:'Kaufgegenstand und vollständiges Eigentum',critical:true,authority:'Verkäufer / Notar / Gericht',document:'Aktueller Grundbuchauszug, Kataster, Flurstück und Eigentumsumfang',source:'notary'},
  {id:'rights',title:'Grundbuchrechte und Nutzungsverträge',critical:true,authority:'Notar / Gericht / Vertragsparteien',document:'Abteilungen II/III, Löschungsregeln, bestehende Miet-/Pachtverträge',source:'notary'},
  {id:'permission',title:'Zulässigkeit der geplanten Nutzung',critical:true,authority:'Gemeinde / Bauaufsicht',document:'Bebauungsplan mit Textteil oder konkrete behördliche Auskunft / Bauvorbescheid',source:'planning30'},
  {id:'access',title:'Rechtlich gesicherte Zufahrt',critical:true,authority:'Notar / Bauaufsicht',document:'Öffentliche Anbindung oder belastbares Wegerecht, tatsächliche Zufahrt',source:'notary'},
  {id:'infrastructure',title:'Erschließung, Beiträge und Anschlüsse',critical:true,authority:'Gemeinde / Versorger',document:'Beitragsauskunft, Anschlussangebote, offene Herstellungs- und Vermessungskosten',source:'infrastructure'},
  {id:'soil',title:'Altlasten und Bodenrisiken',critical:true,authority:'Untere Umweltbehörde / Sachverständiger',document:'Altlasten-/Verdachtsflächenauskunft, frühere Nutzung, bei Bedarf Bodengutachten',source:'soil'},
  {id:'restrictions',title:'Baulasten, Hochwasser und Schutzgebiete',critical:true,authority:'Bauaufsicht / Umwelt- und Wasserbehörde',document:'Landesspezifische Baulastenauskunft, amtliche Karten und örtliche Einschränkungen',source:'flood'},
  {id:'costs',title:'Vollkosten und ausreichende Liquidität',critical:true,authority:'Eigene Kalkulation / Kostenträger',document:'Erwerb, Herstellung, Halten, Ausstieg, Reserve und Stressszenario',source:'transfer'},
  {id:'exit',title:'Käufer oder Pächter und realistische Nachfrage',critical:true,authority:'Lokale Käufer / Pächter / Gutachterausschuss',document:'Konkreter Käuferkreis, nachvollziehbare Preise, Vertragsangebot oder plausible Alternative',source:'borisinfo'},
  {id:'valuation',title:'Passende datierte Wertreferenz',critical:false,authority:'Gutachterausschuss / Gutachter',document:'Referenz mit Stichtag, Nutzungs-/Entwicklungszustand, Erschließung und Anpassungen',source:'immowert'},
  {id:'inspection',title:'Besichtigung und Grenzen',critical:false,authority:'Eigene Besichtigung / Vermesser',document:'Fotos, Grenz-/Zufahrtsabgleich, Nutzung, Gelände und Nachbarn',source:'notary'},
  {id:'tax',title:'Steuerliche Einordnung und Wiederverkaufsbindungen',critical:true,authority:'Steuerberater / Notar / Gemeinde',document:'Privat-/Gewerbeeinordnung, Steuerpuffer, Vorkaufs-/Wiederkaufsrechte, Baupflichten',source:'tax23'},
  {id:'auction',title:'Versteigerungsbedingungen und Rechte',critical:true,only:['auction'],authority:'Zuständiges Vollstreckungsgericht',document:'Aktueller Termin, Gutachten, geringstes Gebot, Wertgrenzen, Rechte, Sicherheit, Zahlung',source:'limit50'},
  {id:'farmland',title:'Grundstückverkehrsrechtliche Genehmigung',critical:true,only:['agriculture'],authority:'Zuständige Grundstückverkehrsbehörde',document:'Genehmigungspflicht und landesspezifische Freigrenze für dieses Flurstück',source:'farmland'},
  {id:'solarplanning',title:'Solarplanung und Projektpartner',critical:true,only:['solar_lease','solar_operation'],authority:'Gemeinde / Bauaufsicht / Entwickler',document:'Konkrete PV-Nutzungszulässigkeit, Projektumfang und belastbare Entwicklungszusage',source:'planning35'},
  {id:'grid',title:'Netzanschluss und Anschlusskosten',critical:true,only:['solar_lease','solar_operation'],authority:'Netzbetreiber',document:'Schriftliche Anschlussprüfung, Kosten, Zeit und Bedingungen',source:'pvgrid'},
  {id:'solarcontract',title:'Pacht, Laufzeit, Rückbau und Sicherheit',critical:true,only:['solar_lease'],authority:'Entwickler / Fachanwalt',document:'Zahlungsbeginn, Reservierung, Indexierung, Beendigung, Rechte, Rückbauabsicherung',source:'pvlease'},
  {id:'eeg',title:'EEG oder sonstige Vermarktung',critical:true,only:['solar_operation'],authority:'Netzbetreiber / Fachplaner',document:'Förderfähigkeit, Inbetriebnahmestichtag, Tarif-/Vermarktungsvoraussetzungen',source:'eeg48'}
];
export const CHECK_IDS=CHECKS.map(c=>c.id);
export const DILIGENCE_SCHEMA={type:'object',properties:{strategy:{type:'string',enum:['resale','agriculture','solar_lease','solar_operation','parking_storage'],default:'resale'},auction:{type:'boolean',default:false},evidence:{type:'array',maxItems:30,default:[],items:{type:'object',properties:{evidence_id:{type:'string',pattern:'^[A-Za-z0-9_-]{1,120}$'},check_id:{type:'string',enum:CHECKS.map(x=>x.id)},status:{type:'string',enum:['missing','claimed','documented','blocked','not_applicable']},note:{type:'string',maxLength:2500},source_url:{type:'string',maxLength:2000},document_name:{type:'string',maxLength:250},checked_at:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['check_id','status'],additionalProperties:false}}},additionalProperties:false};
export function diligence(input={},resolved=new Map()){
  const o=validate(DILIGENCE_SCHEMA,input),evidence=new Map();
  for(const item of o.evidence){
    const e=validate(DILIGENCE_SCHEMA.properties.evidence.items,item);
    if(evidence.has(e.check_id))throw new Error('Prüfpunkt doppelt: '+e.check_id);
    if(e.source_url){let u;try{u=new URL(e.source_url);}catch{}if(!u||u.protocol!=='https:')throw new Error('Nachweislinks müssen HTTPS verwenden.');}
    if(e.checked_at&&!validDate(e.checked_at))throw new Error('Ungültiges Nachweisdatum.');
    evidence.set(e.check_id,e);
  }
  const selected=CHECKS.filter(c=>!c.only||c.only.includes(o.strategy)||o.auction&&c.only.includes('auction'));
  const checks=selected.map(c=>{
    const e=evidence.get(c.id)||{check_id:c.id,status:'missing'};
    let effective=e.status,reason=null;
    if(e.status==='documented'){effective='claimed';reason='Ein eingetragener Dokumentname, Datum oder Link bestätigt keinen vorhandenen oder inhaltlich geprüften Nachweis.';}
    const claim=e.evidence_id?resolved.get(e.evidence_id):null;
    if(e.evidence_id&&(!claim||claim.check_id!==c.id))reason='Nachweis-ID fehlt, gehört nicht zu deinem Konto oder passt nicht zu diesem Prüfpunkt.';
    if(claim&&claim.check_id===c.id&&e.status!=='blocked'){effective=claim.origin==='server_retrieved'?'source_excerpt_linked':'submitted_excerpt_linked';reason='Das Zitat ist mit gespeichertem Text verbunden; Aussage und Anwendung auf dieses Grundstück sind nicht fachlich verifiziert.';}
    if(e.status==='not_applicable'&&(c.critical||!e.note||!e.checked_at)){effective='missing';reason=c.critical?'Kritischer Prüfpunkt kann nicht pauschal als irrelevant übersprungen werden.':'Begründung und Datum für nicht anwendbar fehlen.';}
    return {...c,evidence:e,effective_status:effective,linked_evidence:claim&&claim.check_id===c.id?{id:claim.id,document_id:claim.document_id,origin:claim.origin,quote:claim.quote,document_hash:claim.text_hash,statement_verified:false,property_applicability_verified:false}:null,evidence_issue:reason,source_url:SOURCES.find(s=>s.id===c.source)?.url};
  });
  const blocked=checks.filter(c=>c.effective_status==='blocked'),gates=checks.filter(c=>c.critical&&!['documented','not_applicable'].includes(c.effective_status));
  return {strategy:o.strategy,auction:o.auction,readiness:blocked.length?'blocked':'needs_independent_review',verified_check_count:0,source_linked_count:checks.filter(c=>c.effective_status==='source_excerpt_linked').length,submitted_material_count:checks.filter(c=>c.effective_status==='submitted_excerpt_linked').length,critical_open_count:gates.length,documented_count:checks.filter(c=>c.effective_status==='documented').length,total_checks:checks.length,blockers:blocked.map(c=>c.title),next_actions:gates.slice(0,6).map(c=>({check_id:c.id,action:c.document,contact:c.authority})),checks,notes:['Kein LLM-Aufruf kann einen Prüfpunkt als fachlich verifiziert markieren. Dateinamen und URLs bleiben Behauptungen. Gespeicherter Text und wortgetreue Zitate belegen nur die Herkunft der Aussage.','Kritische Punkte bleiben bis zur unabhängigen fachlichen Prüfung offen; Dokumentabruf und Zitatbezug bestätigen weder Baurecht noch die Anwendung auf das Flurstück.']};
}
function validDate(d){const n=Date.parse(d+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===d&&d<=new Date().toISOString().slice(0,10);}
const refProperties={id:{type:'string',maxLength:120},property_key:{type:'string',maxLength:300},price_eur:{type:'number',minimum:1,maximum:1000000000},area_m2:{type:'number',minimum:1,maximum:100000000},postal_code:{type:'string',pattern:'^\\d{5}$'},use:{type:'string',enum:['building','agriculture','solar','forest','other']},development:{type:'string',enum:['ready','expected','raw','agriculture','unknown']},servicing:{type:'string',enum:['paid','unpaid','none','unknown']},source_url:{type:'string',maxLength:2000},date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},price_kind:{type:'string',enum:['asking_price','transaction','appraisal','boris','court_valuation','bid_scenario']}};
export const COMPARE_SCHEMA={type:'object',properties:{target:{type:'object',properties:refProperties,required:['price_eur','area_m2','postal_code','use','development','servicing','price_kind'],additionalProperties:false},references:{type:'array',minItems:1,maxItems:100,items:{type:'object',properties:refProperties,required:['price_eur','area_m2','postal_code','use','development','servicing','price_kind','source_url','date','property_key'],additionalProperties:false}},max_age_months:{type:'integer',minimum:1,maximum:120,default:24},adjustment_percent:{type:'number',minimum:-80,maximum:100,default:0},adjustment_reason:{type:'string',maxLength:2000,default:''}},required:['target','references'],additionalProperties:false};
export function compareLand(input){
  const o=validate(COMPARE_SCHEMA,input),target=validate(COMPARE_SCHEMA.properties.target,o.target),seen=new Set(),accepted=[],rejected=[];
  if(o.adjustment_percent&&!o.adjustment_reason.trim())throw new Error('Wertanpassung begründen.');
  for(const raw of o.references){
    const r=validate(COMPARE_SCHEMA.properties.references.items,raw),reasons=[];
    let u;try{u=new URL(r.source_url);}catch{}if(!u||u.protocol!=='https:')reasons.push('HTTPS-Quelle fehlt');
    if(!validDate(r.date))reasons.push('Stichtag ungültig oder zukünftig');
    const age=(Date.now()-Date.parse(r.date+'T00:00:00Z'))/(365.25/12*86400000);if(age>o.max_age_months)reasons.push('Referenz zu alt');
    for(const k of ['postal_code','use','development','servicing'])if(r[k]!==target[k])reasons.push('Abweichendes Merkmal: '+k);
    if(r.development==='unknown'||r.servicing==='unknown')reasons.push('Entwicklung oder Erschließung ungeklärt');
    if(r.area_m2<target.area_m2*.5||r.area_m2>target.area_m2*2)reasons.push('Fläche nicht ähnlich');
    const key=r.property_key.trim().toLowerCase();if(!key||seen.has(key)||target.property_key?.trim().toLowerCase()===key)reasons.push('Doppelte oder eigene Grundstücksreferenz');
    if(['court_valuation','bid_scenario'].includes(r.price_kind))reasons.push('Verkehrswert/Gebot kein passender Marktvergleich');
    if(reasons.length)rejected.push({id:r.id??key,reasons});else{seen.add(key);accepted.push({...r,unit_price_eur:r.price_eur/r.area_m2});}
  }
  const classes={asking_price:accepted.filter(r=>r.price_kind==='asking_price'),transaction:accepted.filter(r=>r.price_kind==='transaction'),appraisal:accepted.filter(r=>r.price_kind==='appraisal'),boris_context:accepted.filter(r=>r.price_kind==='boris')};
  const quantile=(v,q)=>{const a=v.map(x=>x.unit_price_eur).sort((a,b)=>a-b),p=(a.length-1)*q,l=Math.floor(p);return a[l]+(a[Math.ceil(p)]-a[l])*(p-l);};
  const groups=Object.entries(classes).filter(([,v])=>v.length).map(([kind,refs])=>{
    const sufficient=kind==='boris_context'?false:kind==='appraisal'?true:refs.length>=3;
    const median=quantile(refs,.5)*(1+o.adjustment_percent/100),low=quantile(refs,.25)*(1+o.adjustment_percent/100);
    return {kind,source_content_verified:false,market_value_verified:false,reference_role:kind==='boris_context'?'zone_context_only':'unverified_input_comparison',count:refs.length,sufficient,median_unit_eur:money(median),lower_quartile_unit_eur:money(low),adjusted_reference_eur:money(median*target.area_m2),discount_percent:sufficient&&['asking_price','transaction'].includes(target.price_kind)?money((1-target.price_eur/(median*target.area_m2))*100):null,sources:refs.map(r=>({url:r.source_url,date:r.date,property_key:r.property_key}))};
  });
  return {target,groups,accepted_count:accepted.length,rejected,adjustment_percent:o.adjustment_percent,adjustment_reason:o.adjustment_reason,confirmed_undervaluation:false,notes:['Angebotspreise, Transaktionen und Dokumentenwerte werden getrennt ausgewertet. Quelleninhalt und vom Nutzer eingegebene Grundstücksmerkmale sind nicht automatisch verifiziert.','Mindestens drei unabhängige Fälle für Angebots- oder Transaktionsstichproben. BORIS-Werte werden nur als Zonen-Kontext ohne Discount ausgewiesen. Gutachten bleiben eine eigene, inhaltlich nicht automatisch geprüfte Gruppe.','Vergleichbarkeit erfordert gleiche PLZ, Nutzung, Entwicklung und Erschließung sowie ähnliche Fläche und passende Stichtage. Manuelle Anpassungen sind begründungspflichtig.']};
}
