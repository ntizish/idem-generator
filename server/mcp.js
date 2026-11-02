import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {bannerInputSchema,bannerRecipe,bannerFilename} from './banner-options.js';
import {bannerDownloadUrl} from './banner-links.js';
import {renderBanner} from './banner-renderer.js';
import {presets} from '../src/lib/palettes.js';
import {BANNER_SIZES,BANNER_LAYOUTS} from '../src/lib/banner-layout.js';

export function createBannerMcpServer(origin) {
  const server=new McpServer({name:'idem-banner-generator',version:'1.0.0'},{instructions:'Generate idem branded banners with generate_banner. Supply a headline and optional supporting copy. Choose sensible design settings from the request; list_banner_options describes palettes and layouts. The result includes a preview and a full-resolution PNG download URL. Download that URL to save the image. Reuse the returned seed and settings for revisions. This server creates new images independently of the website workspace.'});

  server.registerTool('list_banner_options',{
    description:'List banner formats, layouts, color palettes, and available controls before generating an idem banner.',
    inputSchema:{},
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async()=>({content:[{type:'text',text:JSON.stringify({formats:BANNER_SIZES,layouts:BANNER_LAYOUTS,palettes:presets,tones:['light','dark'],backgrounds:['painted','solid'],fade:['none','left','top','right','bottom']})}]}));

  server.registerTool('generate_banner',{
    description:'Generate a finished idem branded banner PNG with headline, supporting copy, bundled brand typography and logo, and an oil-painted or solid background. Returns an image preview, reusable settings and seed, and a downloadable full-resolution PNG URL. The default square format is 1024 × 1024; landscape is 1920 × 1080. Rendering a painted background can take tens of seconds. For revisions reuse the seed and settings. Does not edit the open website.',
    inputSchema:bannerInputSchema,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:false},
  },async(input)=>{
    try {
      const recipe=bannerRecipe(input),result=await renderBanner(recipe);
      const url=bannerDownloadUrl(recipe,origin);
      const {version,...settings}=recipe;
      const metadata={url,filename:bannerFilename(recipe),width:result.width,height:result.height,settings};
      return {content:[{type:'text',text:`Banner ready. Download the full-resolution PNG from ${url}\n${JSON.stringify(metadata)}`},{type:'image',mimeType:'image/jpeg',data:result.jpeg.toString('base64')},{type:'resource_link',uri:url,name:metadata.filename,mimeType:'image/png',description:'Full-resolution banner PNG; generated from these settings when downloaded.'}],structuredContent:metadata};
    } catch(error) {
      return {isError:true,content:[{type:'text',text:error.message}]};
    }
  });
  return server;
}
