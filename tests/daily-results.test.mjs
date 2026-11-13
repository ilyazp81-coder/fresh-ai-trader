import worker from '../janggo-worker.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {automaticResearchPaperAlerts,PaperAlertCoordinator} from '../janggo-worker.mjs';
import {researchDailySummary} from '../daily-results.mjs';import {signCommand} from '../router.mjs';
test('a confirmed BUY_PE alert starts one tracked paper position without a duplicate entry notification',async t=>{
 const RealDate=Date,now=Date.parse('2026-11-12T14:40:00+05:30');
 t.mock.method(globalThis,'Date',class extends RealDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}});t.mock.method(Date,'now',()=>now);
 const state=new Map(),env={__verifiedCalendar:{source:'NSE_OFFICIAL_FO',years:['2026'],holidays:[]},STATE:{get:async k=>state.get(k)||null,put:async(k,v)=>state.set(k,v)}};
 const watch={signalId:'sensex-episode-1',quotedAt:now,entryPolicy:'movement-research-v2',candleConfirmation:{ok:true},status:'RESEARCH_WATCH',underlying:'SENSEX',symbol:'SENSEX_TEST_PE',side:'PE',referencePremium:100,hypotheticalSL:95,hypotheticalTarget:110,spotMovePct:-.2,premiumMovePct:2,oiDelta:100};
 const scan={at:new Date(now).toISOString(),scanHealthy:true,scanSummarySaved:true,kvStateSaved:true,strategyWatches:[watch],directionalReview:{decisions:[{symbol:watch.symbol,action:'BUY_PE'}]},paperContractEvidence:{[watch.symbol]:{symbol:watch.symbol,token:'123',exchange:'BFO',side:'PE',expiry:'2026-11-19T10:00:00Z',lotSize:20}}};
 state.set('scan:last',JSON.stringify(scan));state.set('rolling:2026-11-12',JSON.stringify({'BFO:123':[{t:now,p:100}]}));state.set('directional-alerts:2026-11-12',JSON.stringify({[watch.signalId]:{state:'SENT',at:now}}));
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Confirmed entry must not notify twice'));
 state.set('calendar:nse:fo:verified',JSON.stringify({source:'NSE_OFFICIAL_FO',years:['2026'],holidays:['2026-01-26','2026-03-04','2026-08-15'],fetchedAt:new Date(now).toISOString()}));
 const durable=new Map(),coordinator=new PaperAlertCoordinator({storage:{get:async k=>durable.get(k),put:async(k,v)=>{if(typeof k==='string')durable.set(k,v);else for(const [key,value]of Object.entries(k))durable.set(key,value)}}},env);
 const opened=await (await coordinator.fetch(new Request('https://private/internal/paper-run'))).json();assert.equal(opened.entries.length,1,JSON.stringify(opened));let pos=JSON.parse(state.get('research:paper:position:2026-11-12:SENSEX'));assert.equal(pos.status,'OPEN');assert.equal(pos.entryDelivery,'DELIVERED');assert.equal(pos.quantity,20);
 state.set('rolling:2026-11-12',JSON.stringify({'BFO:123':[{t:now,p:94}]}));t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,result:{message_id:17}}));
 await coordinator.fetch(new Request('https://private/internal/paper-run'));pos=JSON.parse(state.get('research:paper:position:2026-11-12:SENSEX'));assert.equal(pos.status,'CLOSED');assert.equal(pos.points,-6);assert.equal(researchDailySummary('2026-11-12',[pos]).losses,1);
 const nextWatch={...watch,signalId:'sensex-episode-2'};scan.strategyWatches=[nextWatch];state.set('scan:last',JSON.stringify(scan));state.set('directional-alerts:2026-11-12',JSON.stringify({[watch.signalId]:{state:'SENT',at:now},[nextWatch.signalId]:{state:'SENT',at:now}}));state.set('rolling:2026-11-12',JSON.stringify({'BFO:123':[{t:now,p:100}]}));await coordinator.fetch(new Request('https://private/internal/paper-run'));pos=JSON.parse(state.get('research:paper:position:2026-11-12:SENSEX'));assert.equal(pos.status,'OPEN');assert.equal(pos.signalId,nextWatch.signalId);assert.ok([...durable.keys()].some(k=>k.startsWith('research:paper:closed:2026-11-12:')));
});
test('closing summary excludes unresolved and untracked alerts; authenticated report sends once',async t=>{
 const now=Date.now(),values=new Map(),claims={OLD:{state:'SENT'},NEW:{state:'SENT'},UNKNOWN:{state:'UNKNOWN'}};let sent=0;
 const positions=[{symbol:'NEW',status:'CLOSED',entryDelivery:'DELIVERED',delivery:'DELIVERED',points:4},{symbol:'OPEN',status:'OPEN',delivery:'DELIVERED'}];
 const r=researchDailySummary('2026-11-12',positions,claims);assert.equal(r.wins,1);assert.equal(r.losses,0);assert.equal(r.open,1);assert.equal(r.untrackedDirectionalAlerts,1);
 const env={TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',STATE:{get:async k=>k.startsWith('directional-alerts')?JSON.stringify(claims):null}};
 const storage={get:async k=>values.get(k),put:async x=>{for(const [k,v]of Object.entries(x))values.set(k,structuredClone(v))}};const co=new PaperAlertCoordinator({storage},env);
 assert.equal((await co.fetch(new Request('https://private/internal/daily-results',{method:'POST',body:'{}'}))).status,403);
 t.mock.method(globalThis,'fetch',async()=>{sent++;return Response.json({ok:true,result:{message_id:22}})});
 const body=JSON.stringify({command:'daily-results',at:now,day:'2026-11-12',closeAt:now-1000,chatId:'7'});const init={method:'POST',headers:{'x-janggo-signature':await signCommand('fake',body)},body};
 const a=await (await co.fetch(new Request('https://private/internal/daily-results',init))).json();assert.equal(a.delivery,'API_CONFIRMED');await co.fetch(new Request('https://private/internal/daily-results',init));assert.equal(sent,1);
});

test('public daily-results status uses the authenticated coordinator and never throws for missing imports',async()=>{
 const env={TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',STATE:{get:async()=>null,put:async()=>{}}};
 const coordinator=new PaperAlertCoordinator({storage:{get:async()=>({status:'RECORDED'}),put:async()=>{}}},env);
 env.PAPER_COORDINATOR={idFromName:x=>x,get:()=>({fetch:(url,init)=>coordinator.fetch(new Request(url,init))})};
 const response=await worker.fetch(new Request('https://fresh.example/daily-results-status'),env);assert.equal(response.status,200);assert.equal((await response.json()).status,'RECORDED');
});

test('daily results decode durable strings and count multiple closed movements without duplicating the current position',async t=>{
 const now=Date.now(),values=new Map(),day='2026-11-13';
 const one={index:'NIFTY',symbol:'NIFTYCE',signalId:'a',entryAt:1,status:'CLOSED',entryDelivery:'DELIVERED',delivery:'DELIVERED',points:-2};
 const two={...one,signalId:'b',entryAt:2,points:3};
 values.set('research:paper:closed:'+day+':NIFTY:1',JSON.stringify(one));values.set('research:paper:closed:'+day+':NIFTY:2',JSON.stringify(two));values.set('research:paper:position:'+day+':NIFTY',JSON.stringify(two));
 const storage={get:async k=>values.get(k),list:async({prefix})=>new Map([...values].filter(([k])=>k.startsWith(prefix))),put:async x=>{for(const [k,v]of Object.entries(x))values.set(k,structuredClone(v))}};
 const env={TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',STATE:{get:async k=>k.startsWith('directional-alerts')?JSON.stringify({a:{state:'SENT'},b:{state:'SENT'}}):null}};
 const co=new PaperAlertCoordinator({storage},env);t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,result:{message_id:30}}));
 const body=JSON.stringify({command:'daily-results',at:now,day,closeAt:now-1000,chatId:'7'});const r=await (await co.fetch(new Request('https://private/internal/daily-results',{method:'POST',headers:{'x-janggo-signature':await signCommand('fake',body)},body}))).json();
 assert.equal(r.wins,1);assert.equal(r.losses,1);assert.equal(r.untrackedDirectionalAlerts,0);assert.equal(r.delivery,'API_CONFIRMED');
});
