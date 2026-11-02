import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {recipeFromUrl} from '../server/banner-links.js';
import {bannerFilename} from '../server/banner-options.js';
import {renderBanner} from '../server/banner-renderer.js';
import {json,requestOrigin} from '../server/http.js';

export default async function handler(req,res) {
  if(req.method!=='GET'&&req.method!=='HEAD') {
    res.setHeader('Allow','GET, HEAD');return json(res,405,{error:'Use GET to download a banner.'});
  }
  try {
    let recipe;
    try {recipe=recipeFromUrl(new URL(req.url,requestOrigin(req)));}
    catch(error){return json(res,error.status??400,{error:error.status===401?error.message:'Invalid banner recipe. Generate a new link with generate_banner.'});}
    res.setHeader('Content-Type','image/png');
    res.setHeader('Content-Disposition',`attachment; filename="${bannerFilename(recipe)}"`);
    res.setHeader('X-Content-Type-Options','nosniff');
    // Recipes include all content and a seed; the CDN may cache the exact image.
    // Signed downloads stay private so token rotation always invalidates access.
    res.setHeader('Cache-Control',process.env.MCP_AUTH_TOKEN?'private, no-store':'public, max-age=3600, s-maxage=86400');
    if(req.method==='HEAD'){res.statusCode=200;res.end();return;}
    const result=await renderBanner(recipe);
    // Stream rather than buffer a Vercel response above its 4.5 MB payload cap.
    async function* chunks(){for(let i=0;i<result.png.length;i+=64*1024)yield result.png.subarray(i,i+64*1024);}
    await pipeline(Readable.from(chunks()),res);
  } catch(error) {
    console.error('Banner download failed:',error.message);
    if(!res.headersSent) {
      if(error.status===429)res.setHeader('Retry-After','5');
      json(res,error.status??500,{error:error.message});
    }
  }
}
