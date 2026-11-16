export function paperSize(lotSize,lots=1){
 if(!Number.isSafeInteger(lotSize)||lotSize<=0||lotSize>1000000)throw Error('INVALID_EXCHANGE_LOT_SIZE');
 if(!Number.isSafeInteger(lots)||lots<1||lots>10)throw Error('INVALID_PAPER_LOTS');
 return {lotSize,lots,quantity:lotSize*lots};
}
