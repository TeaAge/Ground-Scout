import {landCandidate} from './crawler.mjs';
// Deliberately conservative: ordinary valuation reports and generic bidding forms are not new offers.
export function pdfOfferCandidates(document,profile={id:'pdf',name:'PDF-Quelle',category:'discovered_source'}){
 const text=document.text||'',starts=[...text.matchAll(/(?:Öffentliche\s+Ausschreibung\s+(?:zum\s+)?Verkauf|Verkauf\s+(?:eines|von|der)\s+(?:gemeindeeigenen?\s+|gemeindlichen?\s+|unbebauten?\s+)?(?:Baugrundstücks?|Grundstücks?|Bauplätzen?)|(?:Gemeinde|Stadt)\s+[\p{L}-]+\s+(?:bietet|schreibt)[^.]{0,80}(?:Grundstück|Bauplatz))/giu)];
 if(!starts.length)return [];
 const candidates=[];
 for(let i=0;i<starts.length;i++){
  const begin=starts[i].index,end=starts[i+1]?.index??text.length,section=text.slice(begin,end),parcel=section.match(/Flurstück(?:snummer)?\s*(?:Nr\.?|[:\-])?\s*(\d+(?:\s*\/\s*\d+)?)/i)?.[1];
  if(!parcel&&!/(?:Grundstücksfläche|Grundstücksgröße)\s*[:\-]?\s*\d/i.test(section))continue;
  const title=section.slice(0,Math.min(180,section.indexOf('.')>15?section.indexOf('.'):180));
  const r=landCandidate(section,title,document.url,profile,document.fetched_at,0,{property_key:parcel?'pdf-parcel:'+parcel:'pdf-section:'+begin});
  if(!r)continue;r.property_key=parcel?'pdf-parcel:'+parcel:'pdf-section:'+begin;r.record_kind='pdf_notice_candidate';r.source_text_basis='retrieved_pdf_notice_section';r.source_text_complete=document.metadata.complete===true;r.extraction_stage='document_notice';r.provenance={url:document.url,fetched_at:document.fetched_at,extractor:'bounded_pdf_offer_section',bytes_sha256:document.metadata.bytes_sha256,page_start:document.metadata.page_start,page_end:document.metadata.page_end,section_start:begin};
  r.issues=[...r.issues,'PDF-Ausschreibung: Objektabgrenzung und aktueller Verkaufsstatus prüfen'];candidates.push(r);
 }
 return candidates;
}
