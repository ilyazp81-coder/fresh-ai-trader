export function combinedNiftyEnabled(env){return env.NIFTY_COMBINED_DECISION==='yes';}
// Existing genuine closed-candle research only; no broker or model calls here.
export function buildNiftyContext(market,position,now=Date.now()){
 const frames=(Array.isArray(market?.frames)?market.frames:[]).filter(x=>['1m','3m','5m','15m'].includes(x.timeframe)).map(x=>{
  const t=Date.parse(x.lastCompleteCandle),minutes=Number.parseInt(x.timeframe),age=now-t;
  const usable=x.status==='RESEARCH_ONLY'&&Number.isFinite(age)&&age>=minutes*60000&&age<=Math.max(5,minutes+4)*60000&&Number.isFinite(x.close)&&x.close>0;
  return {timeframe:x.timeframe,status:usable?'AVAILABLE':'STALE_OR_INCOMPLETE',lastCompleteCandle:x.lastCompleteCandle??null,close:usable?x.close:null,trend:usable?x.trend:null,ema9:usable?x.ema9:null,ema21:usable?x.ema21:null,ema50:usable?x.ema50:null,rsi14:usable?x.rsi14:null,atr14:usable?x.atr14:null,candle:usable?x.candle:null};
 });
 return {underlying:'NIFTY',combinedDecision:true,status:frames.some(x=>x.status==='AVAILABLE')?'AVAILABLE':'UNAVAILABLE',source:'BROKER_CLOSED_INDEX_CANDLES',frames,legacyPositionOpen:position?.status==='OPEN',legacyPositionUncertain:false,notes:'Index context only; missing option candles, Greeks and news are not inferred. Stale frames must not be used.'};
}
