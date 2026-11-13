// Engineering filters for fewer experimental alerts; no claim of validated accuracy.
export const RESEARCH_ENTRY_POLICY={version:'strong-research-v1',maximumAlertsPerDay:2,minimumSpotMovePct:0.2,minimumPremiumMovePct:3,maximumPremiumMovePct:6,maximumSpreadPct:0.75,minimumOiChangePct:1,minimumVolumeLots:10,cooldownMinutes:30};
const wait=reason=>({status:'WAIT',reason});
export function strongSnapshotEvidence({contract,history,spotHistory,quality,now=Date.now()}){
 const lot=Number(contract?.lotSize??contract?.lotsize),p=RESEARCH_ENTRY_POLICY;
 if(!contract||quality?.state!=='FRESH'||!Number.isFinite(quality.ageSeconds)||quality.ageSeconds<0||quality.ageSeconds>30||!quality.hasOi||!quality.hasSpread||!Number.isFinite(quality.spreadPct)||quality.spreadPct>p.maximumSpreadPct||!(lot>0)||!Number.isFinite(quality.bidQuantity)||!Number.isFinite(quality.askQuantity)||quality.bidQuantity<2*lot||quality.askQuantity<2*lot)return wait('strong liquidity/freshness gate');
 if(!Array.isArray(history)||history.length<4||!Array.isArray(spotHistory)||spotHistory.length<4)return wait('need four independent observations');
 const h=history.slice(-4),s=spotHistory.slice(-4),side=contract.side==='CE'?1:contract.side==='PE'?-1:0;
 if(!side||h.some((x,i)=>![x.p,x.oi,x.v,x.t].every(Number.isFinite)||x.p<=0||x.oi<=0||(i&&(x.t<=h[i-1].t||x.v<h[i-1].v)))||s.some((x,i)=>!Number.isFinite(x.p)||x.p<=0||!Number.isFinite(x.t)||(i&&x.t<=s[i-1].t)))return wait('invalid independent observations');
 if(now-h[3].t>60000||now-s[3].t>60000||h[3].t>now+2000||s[3].t>now+2000||h[3].t-h[0].t<8*60000||s[3].t-s[0].t<8*60000||h.slice(1).some((x,i)=>x.t-h[i].t>240000)||s.slice(1).some((x,i)=>x.t-s[i].t>240000))return wait('stale or gapped observation window');
 const premium=(h[3].p/h[0].p-1)*100,spot=(s[3].p/s[0].p-1)*100,oi=(h[3].oi/h[0].oi-1)*100,lastPremium=(h[3].p/h[2].p-1)*100,lastSpot=(s[3].p/s[2].p-1)*100*side;
 const volume=h[3].v-h[2].v,rate=volume/(h[3].t-h[2].t),baseline=(h[2].v-h[0].v)/(h[2].t-h[0].t);
 if(spot*side<p.minimumSpotMovePct||lastSpot<0.04)return wait('strong spot direction not established');
 if(premium<p.minimumPremiumMovePct||premium>p.maximumPremiumMovePct||lastPremium<0.5||lastPremium>2.5||h.slice(1).some((x,i)=>x.p<=h[i].p))return wait('strong sustained premium gate or late-entry cap');
 if(oi<p.minimumOiChangePct||h[3].oi<h[2].oi||volume<p.minimumVolumeLots*lot||baseline<=0||rate<1.5*baseline)return wait('strong OI/volume expansion missing');
 const round=x=>+x.toFixed(2);return {status:'RESEARCH_WATCH',entryPolicy:p.version,strategy:'strong_spot_premium_oi_candles',symbol:contract.symbol,underlying:contract.underlying,side:contract.side,spotMovePct:round(spot),premiumMovePct:round(premium),oiDelta:round(h[3].oi-h[0].oi),oiChangePct:round(oi),volumeRateExpansion:round(rate/baseline),quotedAt:now-quality.ageSeconds*1000,referencePremium:round(h[3].p),hypotheticalSL:round(h[3].p*.97),hypotheticalTarget:round(h[3].p*1.05),reason:'Sustained premium and spot momentum, OI expansion, accelerating volume and tight liquid book; experimental, not performance validated',executable:false};
}
export function researchCandleConfirmation(w,market,now=Date.now()){
 if(!market?.candleFresh||!Number.isFinite(market.at)||now-market.at>240000||market.at>now+2000)return {ok:false,reason:'fresh broker candle evidence unavailable'};
 const direction=w.side==='CE'?'UP':'DOWN';
 for(const [tf,maxAge]of [['1m',240000],['5m',600000]]){const f=market.frames?.find(x=>x.timeframe===tf),at=Date.parse(f?.lastCompleteCandle||'');if(f?.status!=='RESEARCH_ONLY'||f.trend!==direction||!Number.isFinite(at)||now-at>maxAge||at>now)return {ok:false,reason:tf+' closed-candle trend not aligned'};}
 return {ok:true,timeframes:['1m','5m'],direction,asOf:market.at};
}
export function researchAlertCapacity(claims,index,now){
 if(!claims||typeof claims!=='object'||Array.isArray(claims))return false;
 const entries=Object.entries(claims);if(entries.length>=2)return false;
 if(entries.some(([symbol,x])=>x?.underlying===index||symbol.startsWith(index)))return false;
 return !entries.some(([,x])=>!Number.isFinite(x?.at)||now-x.at<1800000);
}

export function confirmResearchQuote(w,contract,q,now=Date.now()){
 const lot=Number(contract?.lotSize??contract?.lotsize),entry=q?.ask;
 if(w?.entryPolicy!==RESEARCH_ENTRY_POLICY.version||!w.candleConfirmation?.ok||q?.state!=='FRESH'||!Number.isFinite(q.ageSeconds)||q.ageSeconds<0||q.ageSeconds>30||!Number.isFinite(q.spreadPct)||q.spreadPct>0.75||!q.hasOi||!q.hasSpread||!Number.isFinite(lot)||lot<=0||!Number.isFinite(q.bidQuantity)||!Number.isFinite(q.askQuantity)||q.bidQuantity<2*lot||q.askQuantity<2*lot||!Number.isFinite(entry)||entry<=0||Math.abs(entry-w.referencePremium)/w.referencePremium>0.005)return null;
 const risk=entry-w.hypotheticalSL,reward=w.hypotheticalTarget-entry;
 if(!Number.isFinite(risk)||risk<=0||!Number.isFinite(reward)||reward/risk<1.5)return null;
 return {referencePremium:entry,quotedAt:now-q.ageSeconds*1000,entryRecheckedAt:now};
}
