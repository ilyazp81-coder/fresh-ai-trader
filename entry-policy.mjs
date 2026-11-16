export function entryUniverse(env={}){const value=env.TRADE_UNDERLYINGS??'NIFTY,SENSEX';return [...new Set(String(value).split(',').map(x=>x.trim().toUpperCase()).filter(x=>['NIFTY','SENSEX'].includes(x)))];}
export const entryAllowed=(env,index)=>entryUniverse(env).includes(index);
export const tradePreferences={premiumPointsAim:20,trendRunnerObjectivePoints:100,targetsMandatory:false,holding:'EVIDENCE_BASED_UP_TO_SESSION_LIMIT',trailing:'RISK_BASED_NEVER_LOOSEN',noTradeAllowed:true,performanceValidated:false};
