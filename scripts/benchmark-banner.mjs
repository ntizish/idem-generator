import {mkdir,writeFile} from 'node:fs/promises';
import {bannerRecipe} from '../server/banner-options.js';
import {renderBanner} from '../server/banner-renderer.js';

await mkdir(new URL('../.context/',import.meta.url),{recursive:true});
const recipe=bannerRecipe({title:'Your next\nbig thing.',descriptor:'A little color.\nA lot of possibility.',format:'landscape',palette:'Midnight & ivory',seed:42});
const start=performance.now();
const result=await renderBanner(recipe);
await writeFile(new URL('../.context/mcp-banner.png',import.meta.url),result.png);
await writeFile(new URL('../.context/mcp-banner-preview.jpg',import.meta.url),result.jpeg);
console.log(JSON.stringify({seconds:Number(((performance.now()-start)/1000).toFixed(2)),pngBytes:result.png.length,previewBytes:result.jpeg.length,width:result.width,height:result.height,peakRSSMB:Math.round(process.resourceUsage().maxRSS/1024),output:'.context/mcp-banner.png'}));
