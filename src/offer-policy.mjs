import {unitPriceIndicated,areaEvidence,priceAreaSelection,monetaryObservations,areaUnitDivisor,explicitTotalPrice} from './prices.mjs';
import {classify} from './core.mjs';
import {withMediation} from './intermediation.mjs';
import {postalLocation} from './geography.mjs';
import {NORMALIZATION_VERSION} from './versions.mjs';
import {pageRole,transactionEvidence,propertyGeography,objectPageURL} from './offer-semantics.mjs';
// Retrieval policy, not investment or legal verification.
export function offerQuality(r){
 const title=String(r.title||''),text=String(r.source_text||r.description||'');
 const wanted=/\b(?:gesucht|gesuch)\b|^(?:suche|wir suchen|ich suche)\b/i.test(title);
 const tx=transactionEvidence(r,text),rental=tx.transaction_type==='rental',geography=propertyGeography(r,text),role=pageRole(title,r.source_url,text,{objectEvidence:r.listing_identity==='dataset_feature'||r.source_text_basis==='public_bima_json_attributes'||objectPageURL(r.source_url)});
 const symbolicAmount=r.price_eur??r.display_price_eur_claim;
 const symbolic=symbolicAmount!=null&&symbolicAmount<100&&!/per_m2|per_ha|per_ar/.test(r.price_kind||'')&&!monetaryObservations(text).some(o=>o.unit!=='object'&&o.amount===symbolicAmount);
 const reason=wanted?'Kaufgesuch':rental?'Miete/Pachtangebot':tx.acquisition_subject==='leasehold'?'Erbbaurecht / Erbpacht, kein Grundstückseigentum':geography.germany_scope_status==='outside_germany_claim'?'Objektlage laut Text außerhalb Deutschlands':role==='information'?'Informationsseite ohne Grundstücksangebot':role==='index'?'Angebotsübersicht, kein eigenständiges Grundstück':null;
 return {version:NORMALIZATION_VERSION,kind:wanted?'wanted':rental?'rental':tx.acquisition_subject==='leasehold'?'leasehold':geography.germany_scope_status==='outside_germany_claim'?'foreign_object':role==='information'?'information':role==='index'?'index':'candidate',excluded_from_sale_views:!!reason,reason,symbolic_price:symbolic};
}
export function normalizeOffer(r){
 const quality=offerQuality(r),text=r.source_text||r.title||'',facts=areaEvidence(text,r.advertised_area_m2_claim??r.area_m2),selection=priceAreaSelection(text,r.advertised_area_m2_claim??r.area_m2),reclassified=classify(text),tx=transactionEvidence(r,text),geography=propertyGeography(r,text),out={...withMediation(r),...reclassified,...tx,...geography,page_role:pageRole(r.title,r.source_url,text,{objectEvidence:r.listing_identity==='dataset_feature'||r.source_text_basis==='public_bima_json_attributes'||objectPageURL(r.source_url)}),issues:[...new Set([...(r.issues||[]).filter(i=>i!=='Wald / Forst'),...reclassified.issues])],offer_quality:quality,...(['minimum','range','conflicting'].includes(facts.area_kind)?facts:{}),...selection};
 if(['minimum','range','conflicting'].includes(facts.area_kind)&&r.area_m2!=null)out.advertised_area_m2_claim=r.advertised_area_m2_claim??r.area_m2;
 if(r.listing_identity==='dataset_feature'&&!r.source_feed?.profile?.layer_name){const u=new URL(r.source_url),layer=[...u.searchParams].find(([k])=>/^typenames?$/i.test(k))?.[1];if(layer){out.legacy_layer_binding_unverified=true;out.location='Ort ungeklärt · '+layer;out.location_basis='legacy_layer_binding_requires_refresh';out.provider='Amtlicher Verkaufsdatensatz · '+layer;out.issues=[...new Set([...out.issues,'Alte Kommune/Layer-Zuordnung ungeprüft: ursprünglichen Feed mit aktuellem Katalogprofil neu lesen'])];}}
 if(/(?:^|\.)kleinanzeigen\.de$/.test(new URL(r.source_url).hostname)&&/^asking_price/.test(r.price_kind||'')&&r.display_price_eur_claim>0&&!r.price_unit_ambiguous){const obs=explicitTotalPrice(text,r.display_price_eur_claim)?null:monetaryObservations(text).find(o=>o.unit!=='object'&&o.amount===r.display_price_eur_claim),unit=explicitTotalPrice(text,r.display_price_eur_claim)?'object':obs?.unit||(r.price_kind==='asking_price_per_ha'?'ha':r.price_kind==='asking_price_per_ar'?'ar':unitPriceIndicated('',r.display_price_eur_claim,text)?'m2':'object'),per=unit!=='object',divisor=areaUnitDivisor(unit),total=per?(out.area_m2?r.display_price_eur_claim*out.area_m2/divisor:null):r.display_price_eur_claim;out.price_eur=total;out.price_kind=per?'asking_price_per_'+unit:'asking_price';if(per&&facts.area_min_m2)out.minimum_total_price_claim_eur=r.display_price_eur_claim*facts.area_min_m2/divisor;}
 if(facts.area_conflict||r.area_conflict){out.price_eur=null;out.price_unit_ambiguous=true;out.issues=[...new Set([...(r.issues||[]),'Flächenwiderspruch: Gesamtkaufpreis ungeklärt'])];}
 if(selection.object_selection_required){out.advertised_price_eur_claim=r.display_price_eur_claim??r.advertised_price_eur_claim??r.price_eur;out.advertised_area_m2_claim=r.advertised_area_m2_claim??r.area_m2;out.price_eur=null;out.area_m2=null;out.price_unit_ambiguous=true;out.issues=[...new Set([...(out.issues||[]),selection.object_selection_reason])];}
 if((out.area_m2===1||r.advertised_area_m2_claim===1)&&/mehrere|\b(?:[2-9]|zwei|drei|vier|fünf|sechs)\s+(?:(?:verfügbar\w*|verschieden\w*|attraktiv\w*)\s*)?(?:Baugrundstücke|Bauparzellen|Grundstücke)?/i.test(text)){out.advertised_area_m2_claim=1;out.area_m2=null;out.price_eur=null;out.price_review_required=true;out.area_kind='selection_required';out.object_selection_required=true;out.issues=[...new Set([...(out.issues||[]),'Mehrere Bauplätze mit 1-m²-Platzhalter: Kaufgegenstand, Fläche und Gesamtpreis ungeklärt'])];}
 if(['minimum','range'].includes(facts.area_kind)&&out.price_eur!=null&&!/Gesamt(?:kauf)?preis\s*:?\s*[\d. ,]+\s*(?:€|EUR|Euro)/i.test(text)&&out.building_status==='indicated'){out.advertised_price_eur_claim=out.price_eur;out.price_eur=null;out.price_review_required=true;out.issues=[...new Set([...(out.issues||[]),'Bauplatzangebot mit Mindestfläche/Spanne: individueller Gesamtkaufpreis ungeklärt'])];}
 if(out.extraction_stage!=='detail'&&out.building_status==='indicated'&&out.price_eur&&out.area_m2&&out.price_eur/out.area_m2<1){out.previous_price_claim_eur=out.price_eur;out.price_eur=null;out.price_review_required=true;out.price_kind='unknown';out.issues=[...new Set([...(out.issues||[]),'Sehr niedrige Bauland-Preisangabe: Gesamtkaufpreis und Einheit auf Detailseite klären'])];}
 if(out.price_eur!==null&&out.price_eur<100&&!/per_m2|per_ha/.test(out.price_kind||'')){out.display_price_eur_claim=r.price_eur;out.price_eur=null;out.price_kind='unknown';out.issues=[...new Set([...(r.issues||[]),'Symbolischer Preis unter 100 EUR: Gesamtkaufpreis ungeklärt'])];}
 out.price_per_m2=out.price_eur!=null&&out.area_m2>0?Math.round(out.price_eur/out.area_m2*100)/100:null;
 if(geography.germany_scope_status==='outside_germany_claim'){out.publisher_location_claim=r.publisher_location_claim||r.location;out.location=geography.property_location_claim+' · '+geography.property_country_claim;out.state=null;out.geo=null;out.issues=[...new Set([...out.issues,'Objektlage außerhalb Deutschlands laut Quelltext; Anbieterort ist keine Grundstückslage'])];}
 else if(r.property_location_basis==='listing_location_statement'&&r.germany_scope_status==='outside_germany_claim'){
  out.location=r.publisher_location_claim||'Objektlage ungeklärt';out.geo=postalLocation(out.location);out.state=out.geo?.state??null;
  out.issues=out.issues.filter(i=>i!=='Objektlage außerhalb Deutschlands laut Quelltext; Anbieterort ist keine Grundstückslage');
  out.price_kind='unknown';out.price_review_required=true;out.issues.push('Frühere Auslandsableitung nicht reproduzierbar: Originalobjektlage und Preis erneut lesen');
 }
 if(tx.periodic_price_only){out.periodic_payment_eur_claim=r.periodic_payment_eur_claim??r.display_price_eur_claim??r.price_eur;out.price_eur=null;out.price_kind='periodic_payment';}
 out.cost_review_required=!!(out.intermediation.commission_conflict||out.intermediation.commission_combination_unknown);
 if(out.cost_review_required){out.issues=[...new Set([...out.issues,'Provision widersprüchlich oder Kombination aus Festbetrag und Prozent ungeklärt'])];}else out.issues=out.issues.filter(i=>i!=='Provision widersprüchlich oder Kombination aus Festbetrag und Prozent ungeklärt');
 if(quality.excluded_from_sale_views){if(['rental','leasehold'].includes(quality.kind))out.rental_price_eur_claim=r.rental_price_eur_claim??out.price_eur;else out.advertised_price_eur_claim=r.advertised_price_eur_claim??out.price_eur;out.price_eur=null;out.price_per_m2=null;out.price_kind=tx.periodic_price_only?'periodic_payment':quality.kind==='foreign_object'?'outside_germany':quality.kind==='leasehold'?'leasehold_terms_required':'not_for_sale';}
 if(out.price_eur==null){out.costs=null;out.acquisition_costs=null;out.budget_fit=null;}
 const postal=String(out.location||'').match(/\b\d{5}\b/)?.[0];
 out.possible_offer_family=postal&&out.area_m2&&out.price_eur?{signature:[postal,out.area_m2,out.price_eur,out.building_status].join(':'),basis:'matching_postal_area_price_use_claims',parcel_identity_verified:false,match_verified:false,notice:'Gleiche Signatur kann dasselbe Portalangebot oder verschiedene Grundstücke bezeichnen. Vor Vergleichspreisen Quellenüberschneidung prüfen; keine automatische Grundstücksvereinigung.'}:null;
 out.issues.sort();out.normalization_version=NORMALIZATION_VERSION;return out;
}
export function documentPurpose(d){
 const s=(d.title||'')+' '+d.url;
 const kind=/bietermerk|merkblatt|datenschutz|privacy|agb|formular|vordruck|steuer|information.{0,12}(?:mieter|eigentümer)|teilnahmebeding/i.test(s)?'general_information':/gutachten|verkehrswert|appraisal/i.test(s)?'appraisal':/expos[ée]|objektbeschreibung/i.test(s)?'expose':/bebauungsplan|bauvorbescheid|baugenehmigung|lageplan|flurkarte/i.test(s)?'planning_document':'unclassified';
 return {...d,purpose:kind,content_read:false,automatic_read_recommended:false,next_action:kind==='general_information'?'Nur bei passender Fachfrage lesen':'Für einen konkreten Kandidaten gezielt nachladen'};
}
export function followOfferLink(l){
 const u=new URL(l.url),s=u.pathname+' '+u.search+' '+(l.title||'');
 if(/(?:^|\.)?(?:wa\.me|whatsapp\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|xing\.com|pinterest\.(?:com|de))$/i.test(u.hostname))return false;
 if(/\.(?:jpg|png|svg|webp|css|js|zip|mp4|woff2?)(?:$|\?)/i.test(u.pathname))return false;
 if(/(?:^|\.)?(?:landesrecht-bw\.de|gesetze-im-internet\.de)$/i.test(u.hostname)||/\/(?:Verwaltung-A-Z|adressverzeichnis|mitarbeiter)(?:\/|$)/i.test(u.pathname)||/^(?:Ansprechpartner|Kontaktperson|Visitenkarte)(?:\s|$)/i.test(l.title||''))return false;
 if(/(?:ratgeber|lexikon|newsletter|karriere|pressemitteil|aktuelles\/archiv|objectListEnded|mustergrundst|datenschutz|impressum|cookie|login|logout|\/reader(?:\/|\?|$)|\/gesetz(?:e|estext)?(?:\/|\?|$)|(?:anwalt|rechtsberatung).{0,20}(?:grundstück|kauf))/i.test(s))return false;
 return true;
}
