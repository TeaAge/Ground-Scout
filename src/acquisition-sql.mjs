import {TAX} from './core.mjs';
// Same coarse acquisition assumptions as acquisitionEstimate; no development costs.
export function acquisitionSQL(filters){
 const stateCases=Object.entries(TAX).map(([state,rate])=>"WHEN '"+state+"' THEN "+rate).join(' ');
 return {sql:"CASE WHEN COALESCE(json_extract(payload,'$.cost_review_required'),0)=1 OR json_extract(payload,'$.acquisition_subject') IN ('leasehold','rental') OR json_extract(payload,'$.germany_scope_status')='outside_germany_claim' THEN NULL ELSE asking_price + CASE WHEN asking_price<=2500 THEN 0 ELSE asking_price * CASE state "+stateCases+" ELSE .065 END END + max(?,asking_price*.02) + max(asking_price*max(?,COALESCE(json_extract(payload,'$.intermediation.commission_percent_claim'),0))/100,COALESCE(json_extract(payload,'$.intermediation.commission_fixed_eur_claim'),0)) + ? END",args:[filters.purchase_fee_min_eur,filters.purchase_broker_percent,filters.reserve_eur]};
}
