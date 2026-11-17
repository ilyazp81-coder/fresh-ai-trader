export function eligibleExpiry(expiry,now=Date.now()){
 if(typeof expiry!=='string')return false;
 const match=expiry.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);let date;
 if(match)date=match[1];else {const normalized=expiry.replace(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/,'$1 $2 $3 00:00:00 GMT'),t=Date.parse(normalized);if(!Number.isFinite(t))return false;date=new Date(t).toISOString().slice(0,10);}
 return Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&date>new Date(now+19800000).toISOString().slice(0,10);
}
