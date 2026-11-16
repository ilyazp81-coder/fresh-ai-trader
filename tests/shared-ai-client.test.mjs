import test from 'node:test';import assert from 'node:assert/strict';
import {sharedResearchEnvironment,researchAi} from '../shared-ai-client.mjs';
test('production research cannot bypass the shared coordinator or use its local AI binding',async()=>{
 let raw=0,remote=0;const env={AI_SHARED_BUDGET:'yes',TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_CHAT_ID:'7',AI:{run:async()=>{raw++;throw Error('bypass');}},OPTION_CHAIN:{fetch:async(url,init)=>{remote++;const d=JSON.parse(init.body);assert.equal(d.command,'ai-run');assert.equal(d.purpose,'directional');assert.equal(d.evidenceKey,'episode');return Response.json({result:{response:'{"decisions":[]}'}});}}};
 const wrapped=sharedResearchEnvironment(env);await assert.rejects(wrapped.AI.run('@cf/anything',{messages:[]}),/NONTRADING_DISABLED/);assert.equal(remote,0);const response=await researchAi(wrapped,'directional',{messages:[{role:'user',content:'evidence'}]},'episode');assert.equal(response.response,'{"decisions":[]}');assert.equal(raw,0);assert.equal(remote,1);
 await assert.rejects(researchAi({...env,OPTION_CHAIN:null},'directional',{}),/COORDINATOR_UNAVAILABLE/);assert.equal(raw,0);
});
