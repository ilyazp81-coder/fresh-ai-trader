import test from 'node:test';import assert from 'node:assert/strict';
import {deploymentAudit} from '../deployment-audit.mjs';
test('deployment audit checks both histories once and does not fabricate delivery or retry uncertain sends',async()=>{
 let saved=null,probes=0,sends=0;
 const deps={read:async()=>saved,write:async x=>{saved=structuredClone(x);},status:async()=>({version:'test',enabled:true,paperAlertsEnabled:true,freePlanConfirmed:true}),probe:async index=>{probes++;return index==='NIFTY'?{status:'CANDLES_RETURNED',candles:5}:{status:'UNAVAILABLE',diagnostic:'ACCESS_DENIED'};},send:async text=>{sends++;assert.match(text,/UNVALIDATED/);throw Error('uncertain');}};
 const result=await deploymentAudit(deps);assert.equal(result.telegram,'DELIVERY_UNCONFIRMED');assert.equal(result.history[0].candles,5);assert.equal(result.history[1].status,'UNAVAILABLE');
 await deploymentAudit(deps);assert.equal(probes,2);assert.equal(sends,1);
});
