import test from 'node:test';import assert from 'node:assert/strict';
import {reviewDirectionalSignals,reviewResearchWithAI,scanQuotesOnly} from '../janggo-worker.mjs';
const watch={symbol:'NIFTY_TEST_CE',underlying:'NIFTY',side:'CE',referencePremium:100,hypotheticalSL:95,hypotheticalTarget:110,spotMovePct:.1,premiumMovePct:2,oiDelta:100};
test('structured and fenced AI responses pass the same symbol and side gates; invented trades stay rejected',async()=>{
 for(const response of [{response:{decisions:[{symbol:watch.symbol,action:'BUY_CE',reason:'Supplied observations are consistent'}]}},{result:{response:'```json\n{"decisions":[{"symbol":"NIFTY_TEST_CE","action":"BUY_PE","reason":"Wrong contract side must be blocked"}]}\n```'}}]){
  const r=await reviewDirectionalSignals({AI:{run:async()=>response}},[watch],{});assert.equal(r.status,'AI_REVIEWED');assert.equal(r.decisions[0].action,response.result?'WAIT':'BUY_CE');
 }
 const r=await reviewResearchWithAI({AI:{run:async()=>({response:{reviews:[{symbol:watch.symbol,assessment:'WATCH',reason:'Only supplied evidence'},{symbol:'INVENTED',assessment:'WATCH'}]}})}},[watch],{});
 assert.equal(r.status,'REVIEWED_RESEARCH_ONLY');assert.equal(r.reviews.length,1);
 assert.equal((await reviewDirectionalSignals({AI:{run:async()=>({response:'not JSON'})}},[watch],{})).status,'AI_REVIEW_FAILED');
});
test('read-only broker probe records actual selected quotes, timestamps and lot sizes without undefined variables',async t=>{
 const now=Date.now(),memory=new Map();const rows=['NIFTY','SENSEX'].flatMap((underlying,k)=>['CE','PE'].map((side,i)=>({underlying,exchange:k?'BFO':'NFO',token:String(100+k*10+i),symbol:underlying+side,side,expiry:'19NOV2026',strike:k?82000:25000,lotsize:65})));
 memory.set('master:cache',JSON.stringify({at:now,rows}));
 const env={SMART_API_KEY:'fake',SMART_CLIENT_CODE:'read-only-probe-test',SMART_PIN:'0000',SMART_TOTP_SEED:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',__verifiedCalendar:{source:'NSE_OFFICIAL_FO',years:['2026'],holidays:[]},STATE:{get:async key=>memory.get(key)||null,put:async(key,value)=>memory.set(key,value)}};
 const timer=setTimeout;t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>timer(fn,0,...args));
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.doesNotMatch(url,/placeOrder|modifyOrder/);
  if(url.endsWith('/loginByPassword'))return Response.json({status:true,data:{jwtToken:'fake'}});
  assert.ok(url.endsWith('/quote/'));const [exchange,tokens]=Object.entries(JSON.parse(init.body).exchangeTokens)[0];
  return Response.json({status:true,data:{fetched:tokens.map(token=>({exchange,symbolToken:token,ltp:exchange==='NSE'?25000:exchange==='BSE'?82000:100,opnInterest:10000,tradeVolume:1000,exchFeedTime:new Date().toISOString(),depth:{buy:[{price:99,quantity:65}],sell:[{price:100,quantity:65}]}}))}});
 });
 const r=await scanQuotesOnly(env);assert.equal(r.issues.length,0);assert.equal(r.allQuotesFresh,true);
 for(const index of ['NIFTY','SENSEX']){const snapshot=JSON.parse(memory.get('broker:snapshot:'+index));assert.equal(snapshot.quotes.length,2);assert.equal(snapshot.quotes[0].contract.lotSize,65);assert.ok(Number.isFinite(Date.parse(snapshot.at)));}
});
