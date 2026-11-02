import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {loadImage} from '@napi-rs/canvas';
import mcpHandler from '../api/mcp.js';
import bannerHandler from '../api/banner.js';
import {bannerRecipe} from '../server/banner-options.js';
import {renderBanner} from '../server/banner-renderer.js';

const originalToken=process.env.MCP_AUTH_TOKEN;
delete process.env.MCP_AUTH_TOKEN;
const http=createServer((req,res)=>{
  const handler=req.url.split('?')[0]==='/api/mcp'?mcpHandler:bannerHandler;
  handler(req,res).catch(error=>{console.error(error);res.statusCode=500;res.end();});
});
http.listen(0,'127.0.0.1');await once(http,'listening');
const origin=`http://127.0.0.1:${http.address().port}`;
const client=new Client({name:'idem-mcp-regression',version:'1.0.0'});
const authenticated=new Client({name:'idem-mcp-auth-regression',version:'1.0.0'});
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp',origin)));
  const tools=await client.listTools();
  assert.deepEqual(tools.tools.map(tool=>tool.name).sort(),['generate_banner','list_banner_options']);
  assert(tools.tools.find(tool=>tool.name==='generate_banner').inputSchema.required.includes('title'));
  const options=await client.callTool({name:'list_banner_options',arguments:{}});
  assert.equal(JSON.parse(options.content[0].text).palettes.length,12);

  const input={title:'Make room\nfor possibility.',descriptor:'A little color. A lot of possibility.',background:'solid',fade:'none',seed:42};
  const generated=await client.callTool({name:'generate_banner',arguments:input});
  assert(!generated.isError,generated.content[0].text);
  const {url,width,height,settings}=generated.structuredContent;
  assert.deepEqual([width,height,settings.seed],[1024,1024,42]);
  assert.equal(new URL(url).origin,origin);
  const preview=generated.content.find(item=>item.type==='image');
  const decoded=await loadImage(Buffer.from(preview.data,'base64'));
  assert.deepEqual([decoded.width,decoded.height],[768,768]);
  const download=await fetch(url);
  assert.equal(download.status,200);
  assert.equal(download.headers.get('content-type'),'image/png');
  assert.match(download.headers.get('content-disposition'),/idem-banner-1024x1024-42.png/);
  const png=Buffer.from(await download.arrayBuffer());
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1024,1024]);
  assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()),png);
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);

  // Reproduce the same recipe using an independent renderer cache, as a cold
  // download function must do when the MCP ran on another Vercel instance.
  const independent=await import('../server/banner-renderer.js?cold-instance');
  assert.deepEqual((await independent.renderBanner({...settings,version:1})).png,png);
  assert(!(await client.callTool({name:'generate_banner',arguments:settings})).isError,'Returned settings can be reused verbatim for revisions');
  const landscape=await client.callTool({name:'generate_banner',arguments:{...input,format:'landscape',layout:'offset',tone:'dark',colors:['#000000','#FFFFFF']}});
  assert(!landscape.isError,landscape.content[0].text);
  assert.deepEqual([landscape.structuredContent.width,landscape.structuredContent.height],[1920,1080]);
  for(const args of [{title:''},{title:'Hello',colors:['red','blue']},{title:'Hello',format:'giant'},{title:'Hello',seed:-1},{title:'Hello',descriptor:'x'.repeat(601)}]) {
    assert((await client.callTool({name:'generate_banner',arguments:args})).isError,'Reject invalid tool inputs');
  }
  const recipe=bannerRecipe({...input,title:'Concurrency check'});
  const first=renderBanner(recipe),duplicate=renderBanner(recipe);
  await assert.rejects(renderBanner({...recipe,seed:43}),/Another banner/);
  assert.deepEqual((await first).png,(await duplicate).png);

  assert.equal((await fetch(`${origin}/api/banner?recipe=invalid`)).status,400);
  assert.equal((await fetch(`${origin}/api/banner`,{method:'POST'})).status,405);
  assert.equal((await fetch(`${origin}/api/mcp`)).status,405);
  assert.equal((await fetch(`${origin}/api/mcp`,{method:'OPTIONS'})).status,204);
  assert.equal((await fetch(`${origin}/api/mcp`,{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'})).status,403);
  assert.equal((await fetch(`${origin}/api/mcp`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(`${origin}/api/mcp`,{method:'POST',body:'x'.repeat(16_385)})).status,413);

  process.env.MCP_AUTH_TOKEN='test-secret-only';
  assert.equal((await fetch(`${origin}/api/mcp`,{method:'POST',body:'{}'})).status,401);
  assert.equal((await fetch(url)).status,401,'An unsigned download cannot bypass configured auth');
  await authenticated.connect(new StreamableHTTPClientTransport(new URL('/api/mcp',origin),{requestInit:{headers:{Authorization:'Bearer test-secret-only'}}}));
  const secured=await authenticated.callTool({name:'generate_banner',arguments:input});
  assert(!secured.isError,secured.content[0].text);
  const signedUrl=new URL(secured.structuredContent.url);
  assert(signedUrl.searchParams.has('signature'));
  const signedResponse=await fetch(signedUrl);
  assert.equal(signedResponse.status,200);
  assert.equal(signedResponse.headers.get('cache-control'),'private, no-store');
  await signedResponse.arrayBuffer();
  signedUrl.searchParams.set('recipe',Buffer.from(JSON.stringify({...settings,title:'Tampered title'})).toString('base64url'));
  assert.equal((await fetch(signedUrl)).status,401,'Signed links cannot authorize other recipes');
  console.log('Passed: real MCP client discovery and tool calls, both formats, previews, downloadable PNGs, cold-instance reproduction, input validation, bounded concurrency, HTTP errors, origin checks, bearer auth, and signed downloads.');
} finally {
  if(originalToken===undefined)delete process.env.MCP_AUTH_TOKEN;else process.env.MCP_AUTH_TOKEN=originalToken;
  await client.close();await authenticated.close();
  http.closeAllConnections();await new Promise(resolve=>http.close(resolve));
}
