import {LLM_PACKET_SCHEMA} from './llm-schema.mjs';
const { $schema,$id,...packet }=LLM_PACKET_SCHEMA;
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:true});
const str={type:'string'},integer={type:'integer',minimum:0},nullableInteger={type:['integer','null'],minimum:0},boolean={type:'boolean'},array=items=>({type:'array',items}),generic={type:'object'};
const common={schema_version:{const:'groundscout.listing.v1'}};
const source=obj({id:str,provider:{type:['string','null']},text_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},text_chars:integer,extraction_complete:boolean,legal_facts_verified:{const:false}});
const brief=obj({schema_version:common.schema_version,identity:packet.properties.identity,attention:array(str),summary:obj({listing_key:str,title:{type:['string','null']},asking_price_eur:{type:['number','null']},court_valuation_eur:{type:['number','null']},not_verified:{const:true}}),sources:array(source),next_reads:array(generic)});
const schemas={
 create_land_llm_snapshot:obj({...common,snapshot:obj({id:str,total_items:integer,raw_records:integer,market_complete:{const:false}}),index:generic,usage_rules:array(str)}),
 list_land_llm_snapshots:obj({...common,snapshots:array(obj({id:str,total_items:integer,created_at:str})),limit:integer}),
 list_land_llm_listings:obj({...common,snapshot_id:str,total_items:integer,offset:integer,returned:integer,next_offset:nullableInteger,items:array(generic),market_complete:{const:false}}),
 get_land_llm_listing:{...obj(common),oneOf:[obj({format:{const:'json'},packet:{oneOf:[packet,brief]},usage_rules:array(str)}),obj({format:{enum:['markdown','xml','jsonl']},text:str,context:generic})]},
 get_land_llm_source:obj({...common,snapshot_id:str,listing_key:str,source_ref:str,source,offset_chars:integer,end_chars:integer,total_chars:integer,text:str,next_offset_chars:nullableInteger,untrusted_content:{const:true},legal_facts_verified:{const:false}}),
 export_land_llm_context:obj({...common,format:{enum:['json','markdown','xml','jsonl']},text:str,manifest:obj({snapshot_id:str,total_matching:integer,included:integer,omitted_before:integer,omitted_after:integer,next_offset:nullableInteger}),budget:obj({max_chars:integer,used_chars:integer,next_item_exceeds_budget:boolean}),context:obj({characters:integer,estimated_token_range:array(integer),token_count_exact:{const:false}}),no_partial_listing_cut:{const:true}}),
 delete_land_llm_snapshot:obj({...common,snapshot_id:str,deleted:boolean}),
 get_land_llm_guide:obj({...common,researched_at:str,markdown:str}),
 get_land_llm_schema:obj({...common,schema:generic})
};
// MCP transports prose once in content. API callers may still receive text alongside metadata.
for(const name of ['get_land_llm_source','export_land_llm_context'])schemas[name].required=schemas[name].required.filter(k=>k!=='text');
schemas.get_land_llm_listing.oneOf[1].required=schemas.get_land_llm_listing.oneOf[1].required.filter(k=>k!=='text');
schemas.get_land_llm_guide.required=schemas.get_land_llm_guide.required.filter(k=>k!=='markdown');
export const LLM_OUTPUT_SCHEMAS=schemas;
