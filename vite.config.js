import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import mcpHandler from './api/mcp.js';
import bannerHandler from './api/banner.js';

const bannerApi = {
  name: 'idem-banner-api',
  configureServer(server) {
    server.middlewares.use((req,res,next)=>{
      const path=req.url?.split('?')[0];
      if(path?.startsWith('/.well-known/')) {
        res.statusCode=404;
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({error:'No OAuth server is configured. Connect to /api/mcp without authentication unless an MCP_AUTH_TOKEN has been configured.'}));
        return;
      }
      const handler=path==='/api/mcp'?mcpHandler:path==='/api/banner'?bannerHandler:null;
      if(handler)handler(req,res).catch(next);
      else next();
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), bannerApi],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
