import test from 'node:test';import assert from 'node:assert/strict';import {watchCore} from '../service-watch.mjs';
test('independent service watcher reserves once, never retries an uncertain alert and reports actual recovery',async()=>{
 let saved=null,failed=true,sends=0;const deps={check:async()=>{if(failed)throw Error('service-down');},read:async()=>saved,write:async x=>{saved=structuredClone(x);return true;},send:async()=>{sends++;throw Error('delivery-uncertain');}};
 await watchCore(deps);await watchCore(deps);assert.equal(sends,1);assert.equal(saved.delivery,'UNCONFIRMED');failed=false;await watchCore(deps);assert.equal(sends,2);await watchCore(deps);assert.equal(sends,2);
});
