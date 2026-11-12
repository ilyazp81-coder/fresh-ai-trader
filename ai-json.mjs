export function parseAiJson(result) {
  let value=result?.response ?? result?.result?.response;
  if (value && typeof value==='object' && !Array.isArray(value)) {
    if (JSON.stringify(value).length>16000) throw new Error('ai-json-too-large');
    return value;
  }
  if (typeof value!=='string' || value.length>16000) throw new Error('ai-json-invalid');
  value=value.trim();
  const fenced=/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i.exec(value);
  return JSON.parse(fenced?fenced[1]:value);
}

export function responseShape(result) {
  const value=result?.response ?? result?.result?.response;
  if (typeof value==='string') return 'text-'+value.length;
  if (value && typeof value==='object') return 'structured-object';
  return 'missing-response';
}
