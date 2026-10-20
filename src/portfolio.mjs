import {validateSearch} from './core.mjs';
import {validate} from './finance.mjs';
const id={type:'string',pattern:'^[A-Za-z0-9:_-]{1,120}$'};
export const PROJECT_SCHEMA={type:'object',properties:{id,title:{type:'string',maxLength:250},status:{type:'string',enum:['researching','reviewing','ready','rejected','purchased','sold'],default:'researching'},revision:{type:'integer',minimum:1,maximum:100000000},data:{type:'object',description:'Projektakte: Angebot, Notizen, Nachweise, Kalkulationen. JSON ohne Dateiinhalte.'}},required:['title','data'],additionalProperties:false};
export const SEARCH_SAVE_SCHEMA={type:'object',properties:{id,title:{type:'string',maxLength:250},filters:{type:'object'}},required:['title','filters'],additionalProperties:false};
export const ID_SCHEMA={type:'object',properties:{id},required:['id'],additionalProperties:false};
export const LIST_SCHEMA={type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100,default:50},offset:{type:'integer',minimum:0,maximum:100000,default:0}},additionalProperties:false};
function db(context){if(!context?.userId)throw new Error('Anmeldung erforderlich.');if(!context.env?.DB)throw new Error('Projektablage derzeit nicht verfügbar. Deine Eingaben bleiben erhalten; versuche es später erneut.');return context.env.DB;}
function project(r){const {owner_id,payload,...publicFields}=r;return {...publicFields,data:JSON.parse(payload),data_origin:'user_saved_unverified',untrusted_content:true,investment_verified:false};}
export async function saveProject(input,context){
  const o=validate(PROJECT_SCHEMA,input),binding=db(context);if(!o.title.trim())throw new Error('Projekttitel fehlt.');
  const payload=JSON.stringify(o.data);if(payload.length>100000)throw new Error('Projektakte überschreitet 100 kB.');
  const now=new Date().toISOString();let savedId=o.id;
  if(o.id){
    if(!o.revision)throw new Error('Für Änderungen ist die aktuelle revision erforderlich.');
    const result=await binding.prepare('UPDATE projects SET title=?, status=?, payload=?, revision=revision+1, updated_at=? WHERE id=? AND owner_id=? AND revision=?').bind(o.title.trim(),o.status,payload,now,o.id,context.userId,o.revision).run();
    if(!result.meta?.changes)throw new Error('Projekt nicht gefunden oder inzwischen geändert. Lade die aktuelle Akte vor erneutem Speichern.');
  }else{
    savedId=crypto.randomUUID();
    await binding.prepare('INSERT INTO projects (id,owner_id,title,status,payload,revision,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)').bind(savedId,context.userId,o.title.trim(),o.status,payload,now,now).run();
  }
  return getProject({id:savedId},context);
}
export async function getProject(input,context){const o=validate(ID_SCHEMA,input),r=await db(context).prepare('SELECT * FROM projects WHERE id=? AND owner_id=?').bind(o.id,context.userId).first();if(!r)throw new Error('Projekt nicht gefunden.');return project(r);}
export async function listProjects(input,context){const o=validate(LIST_SCHEMA,input),b=db(context);const r=await b.prepare('SELECT id,title,status,revision,created_at,updated_at FROM projects WHERE owner_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?').bind(context.userId,o.limit,o.offset).all();return {projects:r.results,limit:o.limit,offset:o.offset,status_origin:'user_managed_unverified',investment_verified:false};}
export async function deleteProject(input,context){const o=validate(ID_SCHEMA,input);const r=await db(context).prepare('DELETE FROM projects WHERE id=? AND owner_id=?').bind(o.id,context.userId).run();return {deleted:!!r.meta?.changes,id:o.id};}
export async function saveSearch(input,context){const o=validate(SEARCH_SAVE_SCHEMA,input),filters=validateSearch(o.filters),b=db(context);if(!o.title.trim())throw new Error('Suchname fehlt.');const now=new Date().toISOString(),searchId=o.id??crypto.randomUUID();if(o.id){const r=await b.prepare('UPDATE saved_searches SET title=?, filters=?, updated_at=? WHERE id=? AND owner_id=?').bind(o.title.trim(),JSON.stringify(filters),now,o.id,context.userId).run();if(!r.meta?.changes)throw new Error('Gespeicherte Suche nicht gefunden.');}else await b.prepare('INSERT INTO saved_searches (id,owner_id,title,filters,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(searchId,context.userId,o.title.trim(),JSON.stringify(filters),now,now).run();return {id:searchId,title:o.title.trim(),filters,updated_at:now};}
export async function listSearches(input,context){const o=validate(LIST_SCHEMA,input);const r=await db(context).prepare('SELECT id,title,filters,created_at,updated_at FROM saved_searches WHERE owner_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?').bind(context.userId,o.limit,o.offset).all();return {searches:r.results.map(x=>({...x,filters:JSON.parse(x.filters)})),limit:o.limit,offset:o.offset};}
export async function deleteSearch(input,context){const o=validate(ID_SCHEMA,input);const r=await db(context).prepare('DELETE FROM saved_searches WHERE id=? AND owner_id=?').bind(o.id,context.userId).run();return {deleted:!!r.meta?.changes,id:o.id};}
