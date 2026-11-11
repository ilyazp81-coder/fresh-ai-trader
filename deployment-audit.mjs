// One bounded deployment check, invoked only through the authenticated service binding.
export async function deploymentAudit({read,write,probe,status,send}) {
 const previous=await read();
 if(previous?.completedAt)return previous;
 const result={at:new Date().toISOString(),ordersEnabled:false,liveMarketSignalsVerified:false};
 result.chain=await status();
 result.history=[];
 for(const index of ['NIFTY','SENSEX']) {
  const p=await probe(index);
  result.history.push({index,status:p.status,candles:p.candles||0,diagnostic:p.diagnostic||null});
 }
 // Persist before sending: an uncertain transport outcome must not cause duplicate messages.
 result.completedAt=new Date().toISOString();result.telegram='ATTEMPTING';await write(result);
 try {
  await send('[DEPLOYMENT CHECK]\nOption-chain service: '+result.chain.version+
   '\nPaper alerts: '+(result.chain.enabled&&result.chain.paperAlertsEnabled?'ON — UNVALIDATED':'OFF')+
   '\nFree-plan gate: '+(result.chain.freePlanConfirmed?'enabled':'BLOCKED')+
   '\n'+result.history.map(p=>p.index+' history: '+p.status+' | candles '+p.candles+(p.diagnostic?' | '+p.diagnostic:'')).join('\n')+
   '\nLive market signal quality awaits an open-session check. No orders.');
  result.telegram='API_CONFIRMED';
 } catch {result.telegram='DELIVERY_UNCONFIRMED';}
 await write(result);return result;
}
