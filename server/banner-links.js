import {createHmac,timingSafeEqual} from 'node:crypto';
import {bannerRecipeSchema} from './banner-options.js';

export function tokensEqual(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length&&timingSafeEqual(left,right);
}

function signature(recipe,token) {
  return createHmac('sha256',token).update(recipe).digest('base64url');
}

export function bannerDownloadUrl(recipe,origin,token=process.env.MCP_AUTH_TOKEN) {
  const encoded=Buffer.from(JSON.stringify(bannerRecipeSchema.parse(recipe))).toString('base64url');
  const url=new URL('/api/banner',origin);
  url.searchParams.set('recipe',encoded);
  if(token)url.searchParams.set('signature',signature(encoded,token));
  return url.href;
}

export function recipeFromUrl(url,token=process.env.MCP_AUTH_TOKEN) {
  const encoded=url.searchParams.get('recipe');
  if(!encoded||encoded.length>8192||!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error('Invalid banner recipe');
  if(token&&!tokensEqual(url.searchParams.get('signature'),signature(encoded,token))) {
    const error=new Error('Invalid download signature');error.status=401;throw error;
  }
  return bannerRecipeSchema.parse(JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')));
}
