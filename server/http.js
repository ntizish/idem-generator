export function requestOrigin(req) {
  const protocol=req.headers['x-forwarded-proto']?.split(',')[0]??(req.socket?.encrypted?'https':'http');
  const host=req.headers.host;
  if(!host||!['http','https'].includes(protocol))throw new Error('Invalid request origin');
  return new URL(`${protocol}://${host}`).origin;
}

export function json(res,status,data) {
  res.statusCode=status;res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));
}

export async function requestBody(req) {
  if(req.body!==undefined) {
    const body=Buffer.isBuffer(req.body)?req.body.toString('utf8'):typeof req.body==='string'?req.body:JSON.stringify(req.body);
    if(Buffer.byteLength(body)>16_384)throw Object.assign(new Error('Request too large'),{status:413});
    return JSON.parse(body);
  }
  let body='';
  req.setEncoding('utf8');
  for await(const chunk of req) {
    body+=chunk.toString();
    if(Buffer.byteLength(body)>16_384)throw Object.assign(new Error('Request too large'),{status:413});
  }
  return JSON.parse(body);
}
