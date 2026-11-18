// A separate scheduled Worker can detect a silent core scheduler without asking a model.
export async function watchCore({check,read,write,send,now=Date.now()}){
 const old=await read();let failure=false;try{await check();}catch{failure=true;}
 if(failure&&old?.failed||!failure&&!old?.failed)return {failed:failure,notified:false};
 const state={failed:failure,at:now,delivery:'PENDING'};if(!await write(state))return {failed:failure,notified:false,reason:'WATCH_STATE_NOT_SAVED'};
 try{const result=await send(failure?'JANGGO HEALTH ALERT: core service health check failed. Paper-entry/exit state is unverified; no order placed.':'JANGGO HEALTH RECOVERED: core service health requests respond again. This does not validate strategy performance.');state.delivery=result?.delivered?'DELIVERED':'UNCONFIRMED';}catch{state.delivery='UNCONFIRMED';}
 await write(state);return {failed:failure,notified:true,delivery:state.delivery};
}
