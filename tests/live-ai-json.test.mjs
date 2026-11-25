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

