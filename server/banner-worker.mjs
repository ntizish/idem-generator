import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCanvas,ImageData,GlobalFonts,loadImage} from '@napi-rs/canvas';
import {BANNER_SIZES,drawBanner} from '../src/lib/banner-layout.js';
import {presets} from '../src/lib/palettes.js';
import {reviewBanner} from '../src/lib/banner-review.js';

try {
  let {recipe}=workerData;
  const {autoLayout}=workerData;
  for(const [file,family] of [['literatura-past.otf','Literatura Past'],['abc-areal-medium.ttf','ABC Areal']]) {
    if(!GlobalFonts.registerFromPath(fileURLToPath(new URL(`../public/fonts/${file}`,import.meta.url)),family)) throw new Error(`Unable to load ${family}`);
  }
  const ink=recipe.tone==='light'?'white':'ink';
  const legacy=recipe.version===1;
  const logo=await loadImage(fileURLToPath(new URL(`../public/brand/idem-${legacy?'':'lockup-'}${ink}.png`,import.meta.url)));
  const symbol=!legacy
    ?await loadImage(fileURLToPath(new URL(`../public/brand/idem-symbol-${ink}.png`,import.meta.url))):undefined;
  let background;
  if(recipe.background==='painted') {
    // Run the exact trusted worker source used by the website, with a Node adapter.
    const source=await readFile(new URL('../public/painter.js',import.meta.url),'utf8');
    const worker={postMessage(data) {
      if(data.error)throw new Error(data.error);
      if(data.pixels) {
        background=createCanvas(data.width,data.height);
        background.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
      }
    }};
    new Function('self',source)(worker);
    worker.onmessage({data:{colors:recipe.colors??presets.find(preset=>preset.name===recipe.palette).colors,seed:recipe.seed,width:3840,height:2400}});
    if(!background)throw new Error('The painter did not return an image');
  }
  const size=BANNER_SIZES[recipe.format];
  const canvas=createCanvas(size.width,size.height);
  const texts={title:recipe.title,descriptor:recipe.descriptor},fade={enabled:recipe.fade!=='none',side:recipe.fade==='none'?'left':recipe.fade};
  let review;
  if(!legacy) {
    // Review the actual cropped and faded background before drawing foreground.
    drawBanner(canvas,{size,texts:{},layout:recipe.layout,tone:recipe.tone,background,fade});
    const context=canvas.getContext('2d');
    review=reviewBanner(context,{size,texts,layout:recipe.layout,tone:recipe.tone,checkContrast:true});
    if(autoLayout) {
      recipe={...recipe,layout:review.candidates[0].layout};
      if(recipe.layout!==review.selectedLayout)review=reviewBanner(context,{size,texts,layout:recipe.layout,tone:recipe.tone,checkContrast:true});
    }
  }
  drawBanner(canvas,{size,texts:{title:recipe.title,descriptor:recipe.descriptor},layout:recipe.layout,tone:recipe.tone,logo,symbol,version:recipe.version,background,fade:{enabled:recipe.fade!=='none',side:recipe.fade==='none'?'left':recipe.fade}});
  const preview=createCanvas(768,Math.round(768*size.height/size.width));
  preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
  const [png,jpeg]=await Promise.all([canvas.encode('png'),preview.encode('jpeg',85)]);
  parentPort.postMessage({png,jpeg,width:size.width,height:size.height,recipe,review});
} catch(error) {
  parentPort.postMessage({error:error.message});
}
