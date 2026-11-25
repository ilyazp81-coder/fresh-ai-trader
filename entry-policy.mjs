export const niftyOnly=()=>true;
export function entryUniverse(){return ['NIFTY'];}
export const underlyingForVenue=venue=>venue==='NFO'?'NIFTY':undefined;
export const entryAllowed=(env,index)=>entryUniverse(env).includes(index);
export function futureExpiry(expiry,day){return typeof expiry==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(expiry)&&Number.isFinite(Date.parse(expiry+'T00:00:00Z'))&&new Date(expiry+'T00:00:00Z').toISOString().slice(0,10)===expiry&&expiry>day;}
export const expiryDay=now=>new Date(now+19800000).toISOString().slice(0,10);
export const tradePreferences={premiumPointsAim:20,trendRunnerObjectivePoints:100,targetsMandatory:false,holding:'EVIDENCE_BASED_UP_TO_SESSION_LIMIT',trailing:'RISK_BASED_NEVER_LOOSEN',noTradeAllowed:true,performanceValidated:false};
