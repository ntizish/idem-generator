import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createBannerMcpServer} from '../server/mcp.js';
import {tokensEqual} from '../server/banner-links.js';
import {json,requestBody,requestOrigin} from '../server/http.js';

export default async function handler(req,res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers','MCP-Protocol-Version, Mcp-Session-Id');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
  let server,transport;
  try {
    const origin=requestOrigin(req);
    if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'Origin not allowed'});
    const token=process.env.MCP_AUTH_TOKEN;
    if(token&&!tokensEqual(req.headers.authorization,`Bearer ${token}`)) {
      res.setHeader('WWW-Authenticate','Bearer realm="idem-banner-generator"');
      return json(res,401,{error:'Supply the configured MCP bearer token.'});
    }
    if(req.method!=='POST') {
      res.setHeader('Allow','POST, OPTIONS');
      return json(res,405,{jsonrpc:'2.0',id:null,error:{code:-32000,message:'Use Streamable HTTP POST. This server is stateless and does not use a standalone SSE stream.'}});
    }
    let body;
    try {body=await requestBody(req);} catch(error) {
      return json(res,error.status??400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:error.message}});
    }
    server=createBannerMcpServer(origin);
    transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    await server.connect(transport);
    await transport.handleRequest(req,res,body);
  } catch(error) {
    console.error('MCP request failed:',error.message);
    if(!res.headersSent)json(res,500,{jsonrpc:'2.0',id:null,error:{code:-32603,message:'Unable to handle this MCP request.'}});
  } finally {await transport?.close();await server?.close();}
}
