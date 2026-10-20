import {validate} from './finance.mjs';
import {clean} from './core.mjs';
import {CHECK_IDS} from './diligence.mjs';
import {readDocument} from './crawler.mjs';
export const DOCUMENT_IMPORT_SCHEMA={type:'object',properties:{name:{type:'string',maxLength:250},text:{type:'string',maxLength:64000},source_url:{type:'string',maxLength:2000}},required:['name','text'],additionalProperties:false};
export const DOCUMENT_CAPTURE_SCHEMA={type:'object',properties:{url:{type:'string',maxLength:2000},robots_policy:{type:'string',enum:['observe','respect'],default:'observe'},start_pdf_page:{type:'integer',minimum:1,maximum:10000,default:1},max_pdf_pages:{type:'integer',minimum:1,maximum:100,default:25}},required:['url'],additionalProperties:false};
export const DOCUMENT_ID_SCHEMA={type:'object',properties:{id:{type:'string',pattern:'^[A-Za-z0-9_-]{1,120}$'}},required:['id'],additionalProperties:false};
export const EVIDENCE_CLAIM_SCHEMA={type:'object',properties:{document_id:{type:'string',pattern:'^[A-Za-z0-9_-]{1,120}$'},check_id:{type:'string',pattern:'^[a-z_]{1,40}$'},statement:{type:'string',maxLength:2500},quote:{type:'string',maxLength:2000}},required:['document_id','check_id','statement','quote'],additionalProperties:false};
export function evidenceDB(context){if(!context?.userId)throw new Error('Anmeldung erforderlich.');if(!context.env?.DB)throw new Error('Nachweisablage derzeit nicht verfügbar.');return context.env.DB;}
export async function textHash(text){const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function https(value){if(!value)return null;let u;try{u=new URL(value);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password)throw new Error('Eine HTTPS-Quelle ohne Zugangsdaten angeben.');return u.href;}
async function storeDocument(data,context){
  const db=evidenceDB(context),id=crypto.randomUUID(),created=new Date().toISOString(),hash=await textHash(data.text);
  await db.prepare('INSERT INTO source_documents (id,owner_id,name,source_url,origin,text_content,text_hash,metadata,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,context.userId,data.name,data.source_url,data.origin,data.text,hash,data.metadata?JSON.stringify(data.metadata):null,created).run();
  return {id,name:data.name,source_url:data.source_url,origin:data.origin,metadata:data.metadata??null,text_sha256:hash,text_length:data.text.length,created_at:created,content_verified:false,legal_facts_verified:false,notice:data.origin==='server_retrieved'?'Text wurde vom Server abgerufen. Abruf und Zitatbezug sind nachvollziehbar; Richtigkeit, Zuständigkeit und Anwendung auf ein Flurstück sind nicht geprüft.':'Tatsächlich gespeicherter eingereichter Text. Quelle und Inhalt sind nicht unabhängig überprüft.'};
}
export async function importDocument(input,context){const o=validate(DOCUMENT_IMPORT_SCHEMA,input);if(!o.name.trim()||o.text.trim().length<20)throw new Error('Dokumentname und mindestens 20 Zeichen tatsächlicher Dokumenttext erforderlich.');return storeDocument({name:o.name.trim(),text:clean(o.text),source_url:https(o.source_url),origin:'user_submitted'},context);}
export async function captureDocument(input,context){
  const o=validate(DOCUMENT_CAPTURE_SCHEMA,input),url=https(o.url);evidenceDB(context);
  const d=await readDocument(url,{...o,reject_redirect:true});if(d.text.length<20)throw new Error('Kein ausreichender Dokumenttext abrufbar; bei gescannten PDF ist OCR nötig.');
  return storeDocument({name:clean(d.title||new URL(url).pathname).slice(0,250),text:d.text,source_url:d.url,origin:'server_retrieved',metadata:d.metadata},context);
}
export async function getDocument(input,context){const o=validate(DOCUMENT_ID_SCHEMA,input),d=await evidenceDB(context).prepare('SELECT id,name,source_url,origin,text_content,text_hash,metadata,created_at FROM source_documents WHERE id=? AND owner_id=?').bind(o.id,context.userId).first();if(!d)throw new Error('Dokument nicht gefunden.');return {...d,metadata:d.metadata?JSON.parse(d.metadata):null,text_sha256:d.text_hash,untrusted_content:true,content_verified:false,legal_facts_verified:false};}
export async function listDocuments(input={},context){if(Object.keys(input).length)throw new Error('Keine Parameter erwartet.');const r=await evidenceDB(context).prepare('SELECT id,name,source_url,origin,text_hash,created_at FROM source_documents WHERE owner_id=? ORDER BY created_at DESC LIMIT 100').bind(context.userId).all();return {documents:r.results,limit:100};}
export async function linkEvidence(input,context){
  const o=validate(EVIDENCE_CLAIM_SCHEMA,input);if(!CHECK_IDS.includes(o.check_id))throw new Error('Unbekannter Prüfpunkt.');const doc=await getDocument({id:o.document_id},context),quote=clean(o.quote),statement=clean(o.statement);
  if(!statement||quote.length<20||!doc.text_content.includes(quote))throw new Error('Mindestens 20 Zeichen wortgetreues Zitat aus dem tatsächlich gespeicherten Dokument erforderlich.');
  const id=crypto.randomUUID(),created=new Date().toISOString();await evidenceDB(context).prepare('INSERT INTO evidence_claims (id,owner_id,document_id,check_id,statement,quote,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,context.userId,doc.id,o.check_id,statement,quote,created).run();
  return {id,document_id:doc.id,check_id:o.check_id,statement,quote,document_hash:doc.text_hash,origin:doc.origin,document_metadata:doc.metadata,status:doc.origin==='server_retrieved'?'retrieved_excerpt_linked':'submitted_excerpt_linked',quote_presence_verified:true,statement_verified:false,property_applicability_verified:false,created_at:created};
}
export async function resolveEvidence(input,context){
  const ids=[...new Set((input.evidence||[]).map(e=>e.evidence_id).filter(Boolean))];if(!ids.length)return new Map();
  const r=await evidenceDB(context).prepare('SELECT c.id,c.check_id,c.statement,c.quote,d.id AS document_id,d.origin,d.source_url,d.metadata,d.text_content,d.text_hash,d.created_at FROM evidence_claims c JOIN source_documents d ON c.document_id=d.id AND c.owner_id=d.owner_id WHERE c.owner_id=? AND c.id IN ('+ids.map(()=>'?').join(',')+')').bind(context.userId,...ids).all();
  const verified=new Map();for(const claim of r.results)if(claim.text_content.includes(claim.quote)&&await textHash(claim.text_content)===claim.text_hash)verified.set(claim.id,{...claim,document_metadata:claim.metadata?JSON.parse(claim.metadata):null,metadata:undefined,text_content:undefined,quote_presence_verified:true,statement_verified:false,property_applicability_verified:false});return verified;
}
