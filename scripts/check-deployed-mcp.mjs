import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const origin=process.argv[2];
if(!origin)throw new Error('Usage: node scripts/check-deployed-mcp.mjs https://your-deployment.vercel.app');
const headers=process.env.MCP_AUTH_TOKEN?{Authorization:`Bearer ${process.env.MCP_AUTH_TOKEN}`}:{ };
if(process.env.VERCEL_AUTOMATION_BYPASS_SECRET)headers['x-vercel-protection-bypass']=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const client=new Client({name:'idem-deployment-check',version:'1.0.0'});
const started=performance.now();
try {
  for(const path of ['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/api/mcp','/.well-known/oauth-authorization-server','/.well-known/openid-configuration']) {
    const response=await fetch(new URL(path,origin),{headers});
    assert.equal(response.status,404,`${path} must not return the SPA as OAuth metadata`);
  }
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp',origin),{requestInit:{headers}}));
  const {tools}=await client.listTools();
  assert(tools.some(tool=>tool.name==='generate_banner'));
  const result=await client.callTool({name:'generate_banner',arguments:{title:'Make room\nfor possibility.',descriptor:'A little color.\nA lot of possibility.',format:'landscape',palette:'Midnight & ivory',seed:42}},undefined,{timeout:240_000});
  const generationSeconds=Number(((performance.now()-started)/1000).toFixed(2));
  assert(!result.isError,result.content[0].text);
  const metadata=result.structuredContent;
  const response=await fetch(metadata.url,{headers});
  if(response.status!==200)throw new Error(`Download failed (${response.status}): ${(await response.text()).slice(0,200)}`);
  assert.equal(response.headers.get('content-type'),'image/png');
  const png=Buffer.from(await response.arrayBuffer());
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1920,1080]);
  const preview=result.content.find(item=>item.type==='image');
  await mkdir(new URL('../.context/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.context/deployed-banner.png',import.meta.url),png);
  await writeFile(new URL('../.context/deployed-banner-preview.jpg',import.meta.url),Buffer.from(preview.data,'base64'));
  await writeFile(new URL('../.context/deployed-banner-result.json',import.meta.url),JSON.stringify(metadata,null,2));
  console.log(JSON.stringify({endpoint:new URL('/api/mcp',origin).href,tools:tools.map(tool=>tool.name),width:metadata.width,height:metadata.height,pngBytes:png.length,generationSeconds,seconds:Number(((performance.now()-started)/1000).toFixed(2)),output:'.context/deployed-banner.png'}));
} finally {await client.close();}
