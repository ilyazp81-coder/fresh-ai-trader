import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {signCommand} from '../router.mjs';
import {deskSessionRequest,beginDesk,approvedDesk,deskRpc} from '../platform-auth.mjs';
import {platformFetch} from '../platform.mjs';
import {deskTrade,deskTotals} from '../platform-data.mjs';
import {deskJs,deskHtml} from '../platform-page.mjs';
import {PaperAlertCoordinator,reviewDirectionalSignals,reviewResearchWithAI,researchEntriesPaused,handleBotUpdate} from '../janggo-worker.mjs';
function storage(){const values=new Map();return {values,get:async k=>values.get(k),put:async(k,v)=>{for(const [key,value]of typeof k==='object'?Object.entries(k):[[k,v]])values.set(key,structuredClone(value));},delete:async k=>values.delete(k),list:async({prefix='',limit=1000}={})=>new Map([...values].filter(([k])=>k.startsWith(prefix)).slice(0,limit))};}
function environment(){const env={TELEGRAM_BOT_TOKEN:'test-token-not-for-browser',TELEGRAM_CHAT_ID:'123',MARKET_DATA_PROVIDER:'KOTAK_NEO'},st=storage();env.PAPER_COORDINATOR={idFromName:n=>n,get:()=>({fetch:async(url,init)=>deskSessionRequest(new Request(url,init),env,st)})};return {env,st};}
async function signed(env,data){const body=JSON.stringify({command:'platform-session',chatId:'123',at:Date.now(),...data});return new Request('https://desk.internal/internal/platform-session',{method:'POST',headers:{'x-janggo-signature':await signCommand(env.TELEGRAM_BOT_TOKEN,body)},body});}
const deps={date:'2026-11-16',session:{valid:true,open:'09:15',close:'15:30'},marketOpen:false,read:async()=>null};
test('owner-signed, expiring, one-use approval is required and nonce alone is never a browser session',async t=>{
 let now=Date.parse('2026-11-16T12:00:00Z');t.mock.method(Date,'now',()=>now);const {env,st}=environment(),hash='a'.repeat(64),challenge='b'.repeat(32);
 assert.equal((await deskSessionRequest(new Request('https://desk.internal/internal/platform-session',{method:'POST',body:'{}'}),env,st)).status,403);
 await deskSessionRequest(await signed(env,{action:'begin',hash,challenge}),env,st);
 let r=await deskSessionRequest(await signed(env,{action:'check',hash}),env,st);assert.equal((await r.json()).approved,false);
 r=await deskSessionRequest(await signed(env,{action:'approve',challenge}),env,st);assert.equal((await r.json()).approved,true);
 r=await deskSessionRequest(await signed(env,{action:'approve',challenge}),env,st);assert.equal((await r.json()).approved,false);
 now+=28800001;r=await deskSessionRequest(await signed(env,{action:'check',hash}),env,st);assert.equal((await r.json()).approved,false);
 const wrong=await signed(env,{action:'approve',challenge,chatId:'456'});assert.equal((await deskSessionRequest(wrong,env,st)).status,403);
});
test('browser login keeps the broker/bot secret off the page, sets a secure cookie and rejects cross-site login',async t=>{
 const {env}=environment();let calls=0;t.mock.method(globalThis,'fetch',async url=>{calls++;assert.ok(url.endsWith('/getMe'));return Response.json({ok:true,result:{username:'janggo_test_bot'}});});
 let r=await beginDesk(new Request('https://example.test/platform/auth',{method:'POST',headers:{origin:'https://attacker.test'}}),env);assert.equal(r.status,403);assert.equal(calls,0);
 r=await beginDesk(new Request('https://example.test/platform/auth',{method:'POST',headers:{origin:'https://example.test'}}),env);const data=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.match(data.loginUrl,/https:\/\/t.me\/janggo_test_bot\?start=desk_[a-f0-9]{32}$/);assert.ok(!JSON.stringify(data).includes(env.TELEGRAM_BOT_TOKEN));
 const request=new Request('https://example.test/platform/data',{headers:{cookie}});assert.equal(await approvedDesk(request,env),false);
 const challenge=new URL(data.loginUrl).searchParams.get('start').slice(5);await deskRpc(env,'approve',{challenge});assert.equal(await approvedDesk(request,env),true);
 const page=await platformFetch(new Request('https://example.test/platform'),env,deps);assert.equal(page.status,200);assert.ok(!deskHtml.includes(env.TELEGRAM_BOT_TOKEN));assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const denied=await platformFetch(new Request('https://example.test/platform/data'),env,deps);assert.equal(denied.status,401);
 const attack=await platformFetch(new Request('https://example.test/platform/control',{method:'POST',headers:{cookie,origin:'https://attacker.test'},body:'{"project":"chain","action":"pause"}'}),env,deps);assert.equal(attack.status,403);
 const realOrder=await platformFetch(new Request('https://example.test/platform/control',{method:'POST',headers:{cookie,origin:'https://example.test'},body:'{"project":"chain","action":"placeOrder"}'}),env,deps);assert.equal(realOrder.status,400);
});
test('research paper archive is private and retains multiple closed movements plus the current position',async()=>{
 const st=storage(),env={TELEGRAM_BOT_TOKEN:'test',TELEGRAM_CHAT_ID:'123',STATE:{get:async()=>null}};
 await st.put({'research:paper:closed:2026-11-16:first':JSON.stringify({index:'NIFTY',entryAt:1,status:'CLOSED'}),'research:paper:position:2026-11-16:NIFTY':JSON.stringify({index:'NIFTY',entryAt:2,status:'OPEN'})});
 const c=new PaperAlertCoordinator({storage:st},env),url='https://paper.internal/internal/platform-journal';assert.equal((await c.fetch(new Request(url,{method:'POST',body:'{}'}))).status,403);
 const body=JSON.stringify({command:'platform-journal',chatId:'123',at:Date.now(),day:'2026-11-16'}),r=await c.fetch(new Request(url,{method:'POST',headers:{'x-janggo-signature':await signCommand('test',body)},body}));assert.equal((await r.json()).trades.length,2);
});
test('unknown exit prices and uncertain deliveries cannot become wins or profit in platform totals',()=>{
 const good=deskTrade({symbol:'NIFTYCE',entryPremium:100,exitPremium:110,quantity:65,entryDelivery:'DELIVERED'},'research','CLOSED');
 const uncertain=deskTrade({symbol:'NIFTYPE',entryPremium:100,exitPremium:150,quantity:65,entryDelivery:'UNCONFIRMED'},'research','CLOSED');
 const unpriced=deskTrade({symbol:'NIFTYCE',entry:100,lot:65},'chain','PAPER_CLOSED');
 const totals=deskTotals([good,uncertain,unpriced]);assert.equal(totals.wins,1);assert.equal(totals.grossPnl,650);assert.equal(totals.uncertain,1);assert.equal(totals.unpriced,1);assert.equal(unpriced.exit,null);
});
test('research pause blocks both AI reviews without requiring a model call',async()=>{
 let calls=0;const env={STATE:{get:async key=>key==='platform:research-paused'?'true':null},AI:{run:async()=>{calls++;throw Error('must not run')}}};assert.equal(await researchEntriesPaused(env),true);
 assert.equal((await reviewDirectionalSignals(env,[{}],{})).status,'ENTRIES_PAUSED');assert.equal((await reviewResearchWithAI(env,[{}],{})).status,'ENTRIES_PAUSED');assert.equal(calls,0);
});
test('a different Telegram sender cannot approve a desk session even in the registered chat',async t=>{
 const {env,st}=environment(),hash='c'.repeat(64),challenge='d'.repeat(32);await deskRpc(env,'begin',{hash,challenge});let messages=0;
 t.mock.method(globalThis,'fetch',async url=>{assert.ok(url.endsWith('/sendMessage'));messages++;return Response.json({ok:true,result:{message_id:1}});});
 await handleBotUpdate(env,{message:{chat:{id:123},from:{id:456},text:'/start desk_'+challenge}});assert.equal(messages,0);assert.equal((await st.get('desk:session:'+hash)).approved,false);
 await handleBotUpdate(env,{message:{chat:{id:123},from:{id:123},text:'/start desk_'+challenge}});assert.equal(messages,1);assert.equal((await st.get('desk:session:'+hash)).approved,true);
});
test('browser script parses and chart aggregation excludes incomplete or missing candles',()=>{
 new vm.Script(deskJs);const start=deskJs.indexOf('function aggregate('),end=deskJs.indexOf('function drawChart',start),source=deskJs.slice(start,end);
 const rows=Array.from({length:5},(_,i)=>({at:new Date(Date.parse('2026-11-16T03:45:00Z')+i*60000).toISOString(),open:100+i,high:102+i,low:99+i,close:101+i,volume:10}));
 const run=rows=>vm.runInNewContext(source+';aggregate(rows,5)',{rows,Date,Map});assert.equal(run(rows).length,1);assert.equal(run(rows).at(0).close,105);assert.equal(run(rows.filter((_,i)=>i!==2)).length,0);
});

test('paper sizing starts with one actual exchange lot and stores adjusted quantities without changing past trades',async()=>{const {paperSize}=await import('../paper-sizing.mjs');assert.deepEqual(paperSize(65),{lotSize:65,lots:1,quantity:65});assert.equal(paperSize(65,3).quantity,195);for(const x of [0,-1,1.5,11])assert.throws(()=>paperSize(65,x),/INVALID_PAPER_LOTS/);const trade=deskTrade({entry:100,lot:65,quantity:195,lots:3},'chain','PAPER_CLOSED',{exitPrice:110});assert.equal(trade.grossPnl,1950);assert.equal(trade.quantity,195);});
test('an approved browser initializes against the actual page IDs and loads the dashboard without removed controls',async()=>{
 const nodes=new Map([...deskHtml.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{id,hidden:false,disabled:true,value:id==='chart-series'?'index':id==='journal-filter'?'all':'',textContent:'',innerHTML:'',style:{},dataset:{},options:[{value:'index'}],classList:{toggle(){}},addEventListener(){}}]));
 const calls=[],at=new Date().toISOString(),data={at,day:'2026-11-16',marketOpen:false,trades:[],totals:{complete:true,grossPnl:null,open:0,wins:0,losses:0,flat:0,unpriced:0,uncertain:0},budget:{chainCalls:18,chainCap:80},chain:{connected:true,enabled:true,lots:1,provider:'KOTAK_NEO'},research:{connected:true,enabled:true,lots:1,provider:'KOTAK_NEO'},issues:[]};
 const context={document:{getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[],addEventListener(){},hidden:false},fetch:async path=>{calls.push(path);return Response.json(path.endsWith('/session')?{approved:true}:path.endsWith('/data')?data:{candles:[]});},setInterval:()=>1,clearInterval(){},setTimeout,URL,Blob,Date,Map,console};
 await vm.runInNewContext(deskJs,context);
 assert.equal(nodes.get('login-panel').hidden,true);assert.equal(nodes.get('logout').hidden,false);assert.equal(nodes.get('market-state').textContent,'Market closed');assert.equal(nodes.get('notice').hidden,true,nodes.get('notice').textContent);
 for(const id of ['refresh','export','chart-series','chain-lots','research-lots','save-chain','save-research'])assert.equal(nodes.get(id).disabled,false,id);
 assert.ok(calls.some(p=>p.endsWith('/data')));assert.ok(calls.some(p=>p.includes('/chart?')));assert.match(nodes.get('chain-size').textContent,/1 lot/);
});
