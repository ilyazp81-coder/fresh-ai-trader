export class BrokerDataError extends Error {constructor(code){super('BROKER_'+code);this.code=code;}}
export function normalizeBrokerCandles(data,{intervalMs=60000,now=Date.now(),closedOnly=true}={}){
 if(!Array.isArray(data))throw new BrokerDataError('INVALID_CANDLE_ARRAY');
 const parsed=data.map(row=>{
  if(!Array.isArray(row)||row.length<6)return null;
  // Broker timestamps without an offset represent exchange-local IST.
  // Date.parse() otherwise interprets them as UTC in Workers, shifting candles 5h30m.
  const rawTime=String(row[0]??'').trim();
  const match=rawTime.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
  const t=Date.parse(match?`${match[1]}T${match[2]}+05:30`:rawTime);
  const [o,h,l,c,v]=row.slice(1,6).map(Number);
  if(!Number.isFinite(t)||![o,h,l,c,v].every(Number.isFinite)||[o,h,l,c].some(x=>x<=0)||h<Math.max(o,c,l)||l>Math.min(o,c,h)||v<0)return null;
  return {t,o,h,l,c,v};
 }).filter(Boolean).sort((a,b)=>a.t-b.t);
 const unique=new Map();for(const candle of parsed){if(closedOnly&&candle.t+intervalMs>now)continue;unique.set(candle.t,candle);}
 return [...unique.values()];
}
