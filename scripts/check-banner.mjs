import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCanvas,ImageData,GlobalFonts,loadImage} from '@napi-rs/canvas';
import {BANNER_SIZES,BANNER_LAYOUTS,BRAND_FONTS,gridFor,gridRect,bannerBlocks,coverRect,containRect,fadeVector,fitText,drawBanner} from '../src/lib/banner-layout.js';
import {paintBackground,readImageFile} from '../src/lib/paint-background.js';

for(const [file,family] of [['literatura-past.otf','Literatura Past'],['abc-areal-medium.ttf','ABC Areal']]) {
  assert(GlobalFonts.registerFromPath(fileURLToPath(new URL(`../public/fonts/${file}`,import.meta.url)),family),`Load ${family}`);
}
const logos={light:await loadImage(fileURLToPath(new URL('../public/brand/idem-lockup-white.png',import.meta.url))),dark:await loadImage(fileURLToPath(new URL('../public/brand/idem-lockup-ink.png',import.meta.url)))};
assert.equal(logos.light.width,864);assert.equal(logos.light.height,244);
assert.equal(logos.dark.width,864);assert.equal(logos.dark.height,244);
const symbols={light:await loadImage(fileURLToPath(new URL('../public/brand/idem-symbol-white.png',import.meta.url))),dark:await loadImage(fileURLToPath(new URL('../public/brand/idem-symbol-ink.png',import.meta.url)))};
const square=gridFor(BANNER_SIZES.square),landscape=gridFor(BANNER_SIZES.landscape);
assert.deepEqual([square.margin,square.gap,square.halfColumn,square.halfRow,square.column,square.row],[44,24,456,456,96,96]);
assert.deepEqual([landscape.margin,landscape.gap,landscape.halfColumn,landscape.halfRow,landscape.column,landscape.row],[44,24,904,484,208,103]);
const texts={title:'Your next\nbig thing.',descriptor:'A little color.\nA lot of possibility.'};
const white=createCanvas(64,64);white.getContext('2d').fillStyle='white';white.getContext('2d').fillRect(0,0,64,64);
function pixel(canvas,x,y){return Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);}
const placeholderImage=await loadImage(fileURLToPath(new URL('../public/banner-placeholder.jpg',import.meta.url)));
assert.deepEqual([placeholderImage.width,placeholderImage.height],[1920,1200],'The static placeholder must match the generated painting aspect ratio');
const placeholder=createCanvas(1920,1200);placeholder.getContext('2d').drawImage(placeholderImage,0,0);
assert.notDeepEqual(pixel(placeholder,80,80),pixel(placeholder,960,600),'The static placeholder must contain visible painted variation');

// Literal measurements from the six approved Figma frames, in canvas pixels.
const figmaFrames={
  'logo-top':[[284,524,696,130],[284,771,696,209],[284,44,216,61],130,32,'lockup'],
  offset:[[284,44,696,456],[284,771,696,209],[44,44,77,61],130,32,'symbol'],
  stack:[[284,524,696,216],[284,884,696,96],[284,764,216,61],52,32,'lockup'],
  split:[[44,764,456,216],[644,884,336,96],[644,764,216,61],72,24,'lockup'],
  editorial:[[44,44,936,456],[524,771,456,209],[44,764,216,61],130,32,'lockup'],
  footer:[[44,44,936,456],[524,884,456,96],[524,764,216,61],130,24,'lockup'],
};
for(const [layout,expected] of Object.entries(figmaFrames)) {
  const blocks=bannerBlocks(BANNER_SIZES.square,layout);
  assert.deepEqual(blocks.map(({rect:{x,y,width,height}})=>[x,y,width,height]),expected.slice(0,3),`${layout}: match Figma geometry`);
  assert.deepEqual([blocks[0].fontSize,blocks[1].fontSize,blocks[2].asset],expected.slice(3));
  assert.equal(blocks[1].opacity,.7);
}

for(const size of Object.values(BANNER_SIZES)) {
  const grid=gridFor(size),last=gridRect(grid,7,7,1,1);
  assert.equal(grid.margin,44);assert.equal(size.width-last.x-last.width,44);assert.equal(size.height-last.y-last.height,44);
  assert.deepEqual(gridRect(grid,0,0,8,8),{x:44,y:44,width:size.width-88,height:size.height-88});
  const signatures=new Set();
  for(const {id:layout} of BANNER_LAYOUTS) {
    const blocks=bannerBlocks(size,layout);
    signatures.add(JSON.stringify(blocks.map(block=>block.rect)));
    assert.deepEqual(blocks.map(block=>block.key),['title','descriptor','logo'],'Exactly three branded elements');
    assert.equal(blocks[0].family,BRAND_FONTS.title);assert.equal(blocks[1].family,BRAND_FONTS.descriptor);
    for(const block of blocks) {
      const r=block.rect;
      assert.equal((r.x-44)%(grid.column+24),0);
      assert.equal((r.y-44-(block.key==='descriptor'&&['logo-top','offset','editorial'].includes(layout)?7:0))%(grid.row+24),0);
      assert(r.x+r.width<=size.width-44);assert(r.y+r.height<=size.height-44);
    }
    for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++) {
      const a=blocks[i].rect,b=blocks[j].rect;
      assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),`${layout}: elements must not overlap`);
    }
    const canvas=createCanvas(size.width,size.height),ctx=canvas.getContext('2d');
    for(const block of blocks.filter(block=>block.kind==='text')) {
      const fit=fitText(ctx,(texts[block.key]+' unbroken'.repeat(10)+'\n').repeat(3),block);
      assert(fit.lines.every(line=>ctx.measureText(line).width<=block.rect.width));
      assert(fit.lines.length*fit.lineHeight<=block.rect.height,'Brand text must fit inside its grid block');
    }
    const artwork=blocks[2].asset==='symbol'?symbols.light:logos.light;
    const logoRect=containRect(artwork.width,artwork.height,blocks[2].rect);
    assert(Math.abs(logoRect.width/logoRect.height-artwork.width/artwork.height)<1e-9);
    assert.equal(logoRect.x,blocks[2].rect.x);assert.equal(logoRect.y,blocks[2].rect.y);
    for(const tone of ['light','dark']) {
      drawBanner(canvas,{size,texts,layout,tone,logo:logos[tone],symbol:symbols[tone]});
      const withLogo=ctx.getImageData(logoRect.x,logoRect.y,Math.ceil(logoRect.width),Math.ceil(logoRect.height)).data.slice();
      drawBanner(canvas,{size,texts,layout,tone});
      assert.notDeepEqual(ctx.getImageData(logoRect.x,logoRect.y,Math.ceil(logoRect.width),Math.ceil(logoRect.height)).data,withLogo,'Supplied logo must appear in the exported canvas');
    }
    drawBanner(canvas,{size,texts,layout,logo:logos.light,symbol:symbols.light});
    const png=await canvas.encode('png');
    assert.equal(png.readUInt32BE(16),size.width);assert.equal(png.readUInt32BE(20),size.height);
    assert.deepEqual(pixel(canvas,1,1),[20,20,20,255],'Guides and canvas border must stay out of PNGs');
  }
  assert.equal(signatures.size,6,'Each format must have six approved compositions');
  for(const side of ['left','top','right','bottom']) {
    const canvas=createCanvas(size.width,size.height);
    drawBanner(canvas,{size,texts:{},background:white,fade:{enabled:false,side}});
    assert.deepEqual(pixel(canvas,0,0),[255,255,255,255],'Fade off must have no shading');
    drawBanner(canvas,{size,texts:{},background:white,fade:{enabled:true,side}});
    const [x1,y1,x2,y2]=fadeVector(size,side);
    const start=pixel(canvas,Math.min(size.width-1,x1),Math.min(size.height-1,y1));
    const end=pixel(canvas,Math.min(size.width-1,x2),Math.min(size.height-1,y2));
    assert(start[0]<3,`${side}: selected edge must be fully dark`);
    assert(end[0]>252,`${side}: opposite edge must be transparent`);
    assert.equal(start[3],255);assert.equal(end[3],255);
  }
}
// Transparent banners must keep the background alpha while retaining foreground artwork.
{
  const size=BANNER_SIZES.square,canvas=createCanvas(size.width,size.height);
  drawBanner(canvas,{size,texts:{},transparent:true,logo:logos.light,symbol:symbols.light,fade:{enabled:true,side:'left'}});
  assert.deepEqual(pixel(canvas,1,1),[0,0,0,0],'Transparent exports must preserve an empty alpha channel');
  const box=containRect(864,244,bannerBlocks(size)[2].rect);
  const artwork=canvas.getContext('2d').getImageData(box.x,box.y,Math.ceil(box.width),Math.ceil(box.height)).data;
  assert(artwork.some((value,index)=>index%4===3&&value>0),'Foreground artwork must remain in transparent exports');
}
// Fade belongs behind the supplied logo, never on the foreground artwork.
for(const size of Object.values(BANNER_SIZES)) {
  const canvas=createCanvas(size.width,size.height);
  drawBanner(canvas,{size,texts:{},logo:logos.light,symbol:symbols.light,fade:{enabled:true,side:'left'}});
  const box=containRect(864,244,bannerBlocks(size)[2].rect);
  const pixels=canvas.getContext('2d').getImageData(box.x,box.y,Math.ceil(box.width),Math.ceil(box.height)).data;
  let whitePixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]===255&&pixels[i+1]===255&&pixels[i+2]===255)whitePixels++;
  assert(whitePixels>100,'Fade must not darken the logo');
}
// Brand assets and fonts must be ready before the interface enables export.
const originalImage=globalThis.Image,originalDocument=globalThis.document;
try {
  globalThis.Image=class {decode(){return Promise.resolve();}};
  globalThis.document={fonts:{load:()=>Promise.resolve([])}};
  const {loadBrandAssets}=await import('../src/lib/brand-assets.js');
  await assert.rejects(loadBrandAssets(),/fonts/);
  const requested=[];globalThis.document.fonts.load=font=>{requested.push(font);return Promise.resolve([{}]);};
  const pending=loadBrandAssets();assert.equal(loadBrandAssets(),pending,'Asset loads should be cached');
  const assets=await pending;
  assert.equal(assets.light.src,'/brand/idem-lockup-white.png');assert.equal(assets.dark.src,'/brand/idem-lockup-ink.png');
  assert.equal(assets.symbolLight.src,'/brand/idem-symbol-white.png');assert.equal(assets.symbolDark.src,'/brand/idem-symbol-ink.png');
  assert(requested.some(font=>font.includes('Literatura Past')));assert(requested.some(font=>font.includes('ABC Areal')));
} finally {globalThis.Image=originalImage;globalThis.document=originalDocument;}
assert.throws(()=>gridRect(square,7,0,2,1),RangeError);
assert.throws(()=>bannerBlocks(BANNER_SIZES.square,'invalid'),RangeError);
for(const [sw,sh] of [[3840,2400],[600,900],[100,100]])for(const size of Object.values(BANNER_SIZES)) {
  const crop=coverRect(sw,sh,size.width,size.height);
  assert(crop.width>=size.width&&crop.height>=size.height);
  assert(Math.abs(crop.width/crop.height-sw/sh)<1e-8);
  assert.equal(crop.x*2+crop.width,size.width);assert.equal(crop.y*2+crop.height,size.height);
}
await assert.rejects(readImageFile({type:'text/plain',size:10}),/JPG/);
await assert.rejects(readImageFile({type:'image/png',size:21*1024*1024}),/20 MB/);
const controller=new AbortController();controller.abort();
await assert.rejects(paintBackground({signal:controller.signal}),{name:'AbortError'});
const previous=globalThis.Worker;let terminated=false,posted;
globalThis.Worker=class {postMessage(message){posted=message;}terminate(){terminated=true;}};
const pendingController=new AbortController();
const pending=paintBackground({colors:['#000000','#ffffff'],signal:pendingController.signal});
assert.deepEqual([posted.width,posted.height],[1920,1200],'Fast generation must be the default');
pendingController.abort();await assert.rejects(pending,{name:'AbortError'});assert(terminated);
const hifiController=new AbortController();
const hifi=paintBackground({colors:['#000000','#ffffff'],width:3840,height:2400,signal:hifiController.signal});
assert.deepEqual([posted.width,posted.height],[3840,2400],'Hi-fi generation must retain the original resolution');
hifiController.abort();await assert.rejects(hifi,{name:'AbortError'});
globalThis.Worker=previous;
console.log('Passed: twelve distinct layouts matching six Figma compositions, real brand fonts, both logo assets, text fitting, PNG dimensions, all four fade directions and off state, clean export, and render cancellation.');

if(process.argv.includes('--samples')) {
  const sampleDirectory=fileURLToPath(new URL('../.context',import.meta.url));
  const painter=await readFile(new URL('../public/painter.js',import.meta.url),'utf8');
  const background=createCanvas(1920,1200);
  const self={postMessage(data){if(data.error)throw new Error(data.error);if(data.pixels)background.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);}};
  new Function('self',painter)(self);
  self.onmessage({data:{colors:['#DFD2AE','#856333','#1C2020','#4A292C','#82908A'],seed:42,width:1920,height:1200}});
  for(const [key,size] of Object.entries(BANNER_SIZES)) {
    const tileWidth=key==='square'?512:640,tileHeight=tileWidth*size.height/size.width;
    const sheet=createCanvas(tileWidth*2,tileHeight*3),sheetContext=sheet.getContext('2d');
    for(const [index,{id:layout}] of BANNER_LAYOUTS.entries()) {
      const canvas=createCanvas(size.width,size.height);
      drawBanner(canvas,{size,texts,layout,background,logo:logos.light,symbol:symbols.light,fade:{enabled:true,side:layout==='editorial'?'top':'left'}});
      sheetContext.drawImage(canvas,index%2*tileWidth,Math.floor(index/2)*tileHeight,tileWidth,tileHeight);
      if(index===0)await writeFile(`${sampleDirectory}/idem-banner-${key}.png`,await canvas.encode('png'));
    }
    await writeFile(`${sampleDirectory}/idem-banner-${key}-layouts.png`,await sheet.encode('png'));
  }
  console.log('Sample branded exports and layout sheets saved to .context/idem-banner-*.png');
}
