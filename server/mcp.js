import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {bannerInputSchema,bannerRecipe,bannerFilename} from './banner-options.js';
import {bannerDownloadUrl} from './banner-links.js';
import {renderBanner} from './banner-renderer.js';
import {preflightBanner} from './banner-review.js';
import {presets} from '../src/lib/palettes.js';
import {BANNER_SIZES,BANNER_LAYOUTS} from '../src/lib/banner-layout.js';

export function createBannerMcpServer(origin) {
  const server=new McpServer({name:'idem-banner-generator',version:'2.1.0'},{instructions:'Generate idem branded banners with generate_banner. Supply a headline and optional supporting copy. Use layout auto unless the user requests a specific composition; all six approved layouts are compared for text fit, grouping and contrast on the rendered background. review_banner provides a fast text-only preflight before painting. After generation, read review and inspect the image preview for balance, whitespace, wrapping and legibility. If review.status is revise, follow suggestedChanges: reuse the seed and settings and try the recommended layout or a different fade or ink. Never silently rewrite user copy. Make at most two revision attempts, then return the best result and explain any remaining issues; do not describe a flagged result as approved. Scores are heuristics, and a pass still requires visual judgement. The result includes a preview and a full-resolution PNG download URL. Download that URL to save the image. Returned settings contain the concrete selected layout and seed so downloads and revisions remain reproducible. This server creates new images independently of the website workspace.'});

  server.registerTool('list_banner_options',{
    description:'List banner formats, six approved Figma compositions with descriptions, color palettes, and available controls before generating an idem banner.',
    inputSchema:{},
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async()=>({content:[{type:'text',text:JSON.stringify({formats:BANNER_SIZES,layouts:BANNER_LAYOUTS,defaultLayout:'auto',reviewChecks:['internal whitespace','underfilled headline blocks','text overflow','excessive shrinking','viewing-size legibility','orphan lines','broken words','headline hierarchy','overlap','sampled contrast','busy backgrounds'],palettes:presets,tones:['light','dark'],backgrounds:['painted','solid'],fade:['none','left','top','right','bottom']})}]}));

  server.registerTool('review_banner',{
    description:'Quick composition preflight using the real brand fonts. Compare all six layouts for the supplied copy, flag spacing and typography problems, and recommend a layout. Does not paint or assess background contrast; generate_banner adds that review. Use before painting when choosing a composition. Always inspect the final preview too.',
    inputSchema:bannerInputSchema,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async(input)=>{
    try {
      const review=preflightBanner(input);
      return {content:[{type:'text',text:JSON.stringify(review)}],structuredContent:review};
    } catch(error) {
      return {isError:true,content:[{type:'text',text:error.message}]};
    }
  });

  server.registerTool('generate_banner',{
    description:'Generate an idem branded banner PNG. The default auto layout reviews all six compositions using the copy and actual rendered background, then selects the best fit. A named layout stays fixed. Returns a JPEG preview, reusable settings with the selected layout and seed, a PNG download URL, and a composition review with issues and suggested fixes. Read the review and inspect the preview before delivery; revise flagged results. Default square: 1024 × 1024; landscape: 1920 × 1080. Painting can take tens of seconds. Does not edit the open website.',
    inputSchema:bannerInputSchema,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:false},
  },async(input)=>{
    try {
      const result=await renderBanner(bannerRecipe(input),{autoLayout:input.layout==='auto'});
      const recipe=result.recipe;
      const url=bannerDownloadUrl(recipe,origin);
      const {version,...settings}=recipe;
      const metadata={url,filename:bannerFilename(recipe),width:result.width,height:result.height,settings,layoutSelection:{requested:input.layout,selected:recipe.layout},review:result.review};
      const status=result.review.status==='revise'?'Draft rendered. Review the flagged issues and revise before delivery.':'Banner rendered. Inspect the preview before delivery.';
      return {content:[{type:'text',text:`${status} Download the full-resolution PNG from ${url}\n${JSON.stringify(metadata)}`},{type:'image',mimeType:'image/jpeg',data:result.jpeg.toString('base64')},{type:'resource_link',uri:url,name:metadata.filename,mimeType:'image/png',description:'Full-resolution banner PNG; generated from these settings when downloaded.'}],structuredContent:metadata};
    } catch(error) {
      return {isError:true,content:[{type:'text',text:error.message}]};
    }
  });
  return server;
}
