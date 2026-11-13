import test from 'node:test';import assert from 'node:assert/strict';
import {strongSnapshotEvidence,researchCandleConfirmation,researchAlertCapacity,confirmResearchQuote} from '../strong-entry.mjs';
import {sendDirectionalAlerts} from '../janggo-worker.mjs';
const now=Date.parse('2026-11-13T13:00:00+05:30');
const contract={symbol:'NIFTY_TEST_CE',underlying:'NIFTY',side:'CE',lotsize:20,token:'123',exchange:'NFO'};
const h=[100,101,102,104].map((p,i)=>({p,t:now-(3-i)*180000,oi:[10000,10010,10050,10200][i],v:[1000,1200,1400,1900][i]}));
const spot=[25000,25010,25030,25065].map((p,i)=>({p,t:now-(3-i)*180000}));
const quality={state:'FRESH',ageSeconds:1,hasOi:true,hasSpread:true,spreadPct:.5,bidQuantity:40,askQuantity:40};
const input={contract,history:h,spotHistory:spot,quality,now};
const market={candleFresh:true,at:now,frames:['1m','5m'].map((timeframe,i)=>({timeframe,status:'RESEARCH_ONLY',trend:'UP',lastCompleteCandle:new Date(now-(i?300000:60000)).toISOString()}))};
test('only sustained, liquid, expanding and non-chased evidence reaches AI eligibility',()=>{
 assert.equal(strongSnapshotEvidence(input).status,'RESEARCH_WATCH');
 for(const q of [{ageSeconds:31},{spreadPct:1},{bidQuantity:NaN},{askQuantity:0}])assert.equal(strongSnapshotEvidence({...input,quality:{...quality,...q}}).status,'WAIT');
 for(const history of [h.map((x,i)=>({...x,p:100+i*.2})),h.map((x,i)=>({...x,p:[100,102,104,110][i]})),h.map(x=>({...x,oi:10000})),h.map((x,i)=>({...x,v:1000+i*100})),h.map((x,i)=>({...x,t:x.t-(i===0?300000:0)}))])assert.equal(strongSnapshotEvidence({...input,history}).status,'WAIT');
 const w=strongSnapshotEvidence(input);assert.equal(researchCandleConfirmation(w,market,now).ok,true);assert.equal(researchCandleConfirmation({...w,side:'PE'},market,now).ok,false);assert.equal(researchCandleConfirmation(w,{...market,candleFresh:false},now).ok,false);assert.equal(researchCandleConfirmation(w,{...market,at:now-300000},now).ok,false);
 assert.equal(researchAlertCapacity({},'NIFTY',now),true);assert.equal(researchAlertCapacity({NIFTY_X:{state:'SENT',at:now-3600000}},'NIFTY',now),false);assert.equal(researchAlertCapacity({a:{at:now-1000}},'NIFTY',now),false);assert.equal(researchAlertCapacity({a:{at:0},b:{at:0}},'NIFTY',now),false);
});
test('latest ask, depth and reward/risk are rechecked before Telegram; daily limits prevent repeat delivery',async t=>{
 const RealDate=Date;t.mock.method(globalThis,'Date',class extends RealDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}});t.mock.method(Date,'now',()=>now);
 let ask=106,sent=0,quotes=0;const memory=new Map([['directional-alerts:2026-11-13','{}']]);
 const env={__verifiedCalendar:{source:'NSE_OFFICIAL_FO',years:['2026'],holidays:[]},SMART_API_KEY:'fake',SMART_CLIENT_CODE:'strong-entry-test',SMART_PIN:'0000',SMART_TOTP_SEED:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',STATE:{get:async k=>memory.get(k)||null,put:async(k,v)=>memory.set(k,v)}};
 const timer=setTimeout;t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>timer(fn,0,...args));
 t.mock.method(globalThis,'fetch',async(url,init)=>{assert.doesNotMatch(url,/placeOrder|modifyOrder/);if(url.endsWith('/loginByPassword'))return Response.json({status:true,data:{jwtToken:'fake'}});if(url.endsWith('/quote/')){quotes++;return Response.json({status:true,data:{fetched:[{symbolToken:'123',ltp:ask,opnInterest:10000,tradeVolume:2000,exchFeedTime:new Date(now).toISOString(),depth:{buy:[{price:ask-.2,quantity:40}],sell:[{price:ask,quantity:40}]}}]}})}if(url.includes('/sendMessage')){sent++;return Response.json({ok:true,result:{message_id:27}})}throw Error('Unexpected request')});
 const w={...strongSnapshotEvidence(input),candleConfirmation:researchCandleConfirmation(strongSnapshotEvidence(input),market,now)};
 const result={scanHealthy:true,kvStateSaved:true,scanSummarySaved:true,indices:{NIFTY:{}},strategyWatches:[w],directionalReview:{decisions:[{symbol:w.symbol,action:'BUY_CE',reason:'Synthetic strong evidence test'}]},paperContractEvidence:{[w.symbol]:{...contract,lotSize:20}},issues:[]};
 await sendDirectionalAlerts(env,result,now);assert.equal(sent,0);assert.equal(quotes,1);
 ask=104.1;await sendDirectionalAlerts(env,result,now);assert.equal(sent,1);assert.equal(result.directionalAlertsSent,1);assert.equal(JSON.parse(memory.get('directional-alerts:2026-11-13'))[w.symbol].state,'SENT');
 await sendDirectionalAlerts(env,result,now);assert.equal(sent,1);assert.equal(quotes,2);
});
