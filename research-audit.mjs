export async function researchAudit({index,read,write,analyse,benchmark,send}){
 const old=await read();if(old?.completedAt)return old;
 const result={index,at:new Date().toISOString(),status:'UNAVAILABLE',ordersEnabled:false,liveSignalsVerified:false};
 try{
  const intelligence=await analyse();
  result.minuteRows=intelligence.observations||0;
  result.frames=(intelligence.frames||[]).map(x=>({timeframe:x.timeframe,count:x.count,status:x.status}));
  if(!result.minuteRows)throw Error(intelligence.historicalError||intelligence.status||'NO_MINUTE_DATA');
  result.fiveMinuteQuality=await benchmark();
  result.status=result.fiveMinuteQuality.benchmarkEligible&&result.frames.every(x=>x.status==='RESEARCH_ONLY')?'HISTORY_AND_ANALYSIS_READY':'PARTIAL_RESEARCH_DATA';
 }catch(error){result.diagnostic=String(error?.message||error).slice(0,220);}
 result.completedAt=new Date().toISOString();result.telegram='ATTEMPTING';
 if(await write(result)===false)throw Error('AUDIT_SAVE_FAILED');
 try{
  await send('[HISTORICAL RESEARCH CHECK] '+index+'\n'+result.status+
   '\n1-minute broker candles: '+(result.minuteRows||0)+
   '\n'+(result.frames||[]).map(x=>x.timeframe+': '+x.count+' complete | '+x.status).join('\n')+
   '\n5-minute quality: '+(result.fiveMinuteQuality?result.fiveMinuteQuality.passed+'/10 | rows '+result.fiveMinuteQuality.rows:'not verified')+
   (result.diagnostic?'\n'+result.diagnostic:'')+
   '\nData/analysis check only; no strategy validation or orders.');
  result.telegram='API_CONFIRMED';
 }catch{result.telegram='DELIVERY_UNCONFIRMED';}
 await write(result);return result;
}
