import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCanvas,ImageData,GlobalFonts,loadImage} from '@napi-rs/canvas';
import {BANNER_SIZES,BANNER_LAYOUTS,BRAND_FONTS,BRAND_MARKS,gridFor,gridRect,bannerBlocks,coverRect,containRect,fadeVector,fitText,drawBanner} from '../src/lib/banner-layout.js';
import {paintBackground,readImageFile} from '../src/lib/paint-background.js';
import {solidBackgrounds} from '../src/lib/palettes.js';

for(const [file,family] of [['literatura-past.otf','Literatura Past'],['abc-areal-regular.ttf','ABC Areal']]) {
  assert(GlobalFonts.registerFromPath(fileURLToPath(new URL(`../public/fonts/${file}`,import.meta.url)),family),`Load ${family}`);
}
const light={};
for(const asset of Object.keys(BRAND_MARKS)) {
  light[asset]=await loadImage(fileURLToPath(new URL(`../public/brand/idem-${asset}.svg`,import.meta.url)));
  assert.equal(light[asset].width,BRAND_MARKS[asset].width);assert.equal(light[asset].height,BRAND_MARKS[asset].height);
}
const dark=Object.fromEntries(Object.entries(light).map(([key,image])=>{
  const canvas=createCanvas(image.width*4,image.height*4),ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#141414';ctx.fillRect(0,0,canvas.width,canvas.height);
  return [key,canvas];
}));
const logos={light,dark};
assert.deepEqual(BANNER_LAYOUTS.map(layout=>layout.id),['inset','monogram','signature','split','editorial','corner'],'Offer only the six new Figma compositions, in reference order');
const referencePositions={
  inset:[[284,524,696,216],[284,764,696,216],[284,44,216,96]],
  monogram:[[284,44,696,456],[284,764,696,216],[44,44,96,96]],
  signature:[[284,524,696,216],[284,884,696,96],[284,764,216,96]],
  split:[[44,764,456,216],[644,884,336,96],[644,764,216,96]],
  editorial:[[44,44,936,456],[524,764,456,216],[44,764,216,96]],
  corner:[[44,44,936,456],[524,884,456,96],[524,764,216,96]],
};
for(const [layout,rects] of Object.entries(referencePositions)) {
  assert.deepEqual(bannerBlocks(BANNER_SIZES.square,layout).map(({rect})=>[rect.x,rect.y,rect.width,rect.height]),rects,`${layout}: match the Figma grid spans`);
}
const square=gridFor(BANNER_SIZES.square),landscape=gridFor(BANNER_SIZES.landscape);
assert.deepEqual([square.margin,square.gap,square.halfColumn,square.halfRow,square.column,square.row],[44,24,456,456,96,96]);
assert.deepEqual([landscape.margin,landscape.gap,landscape.halfColumn,landscape.halfRow,landscape.column,landscape.row],[44,24,904,484,208,103]);
const texts={title:'Your next\nbig thing.',descriptor:'A little color.\nA lot of possibility.'};
const squareSignature=bannerBlocks(BANNER_SIZES.square,'signature')[0];
const wideSignature=bannerBlocks(BANNER_SIZES.landscape,'signature')[0];
assert.equal(squareSignature.fontSize,52,'Retain the square Signature typography');
assert.equal(fitText(createCanvas(1,1).getContext('2d'),texts.title,wideSignature).fontSize,110,'The 16:9 Signature headline must render at the larger size');
const white=createCanvas(64,64);white.getContext('2d').fillStyle='white';white.getContext('2d').fillRect(0,0,64,64);
function pixel(canvas,x,y){return Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);}

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
    assert.equal(blocks[1].weight,400,'Descriptions must use the real Regular face');
    assert.equal(blocks[1].opacity,.7,'Supporting copy must keep the reference hierarchy');
    for(const block of blocks) {
      const r=block.rect;
      assert.equal((r.x-44)%(grid.column+24),0);assert.equal((r.y-44)%(grid.row+24),0);
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
    const headline=fitText(ctx,texts.title,blocks[0]);
    assert.deepEqual(headline.lines,texts.title.split('\n'),'Preserve intentional headline breaks');
    for(const block of blocks.filter(block=>block.kind==='text')) {
      const fit=fitText(ctx,texts[block.key],block);
      assert(fit.offsetY>=0&&fit.offsetY+fit.height<=block.rect.height,'Visible ink must fit its aligned block');
      if(block.align==='end')assert.equal(fit.offsetY+fit.height,block.rect.height,'Footer copy must align to the bottom margin');
    }
    const artwork=logos.light[blocks[2].asset];
    const logoRect=containRect(artwork.width,artwork.height,blocks[2].rect,blocks[2]);
    assert.equal(blocks[2].asset,layout==='monogram'?'mark':'lockup');
    assert(Math.abs(logoRect.width/logoRect.height-artwork.width/artwork.height)<1e-9);
    assert.equal(logoRect.x,blocks[2].rect.x);
    assert(logoRect.width<=blocks[2].maxWidth,'Keep the logo subordinate to the headline');
    if(blocks[2].align==='end')assert.equal(logoRect.y+logoRect.height,blocks[2].rect.y+blocks[2].rect.height);
    else assert.equal(logoRect.y,blocks[2].rect.y);
    for(const tone of ['light','dark']) {
      drawBanner(canvas,{size,texts,layout,tone,logo:logos[tone]});
      const withLogo=ctx.getImageData(logoRect.x,logoRect.y,Math.ceil(logoRect.width),Math.ceil(logoRect.height)).data.slice();
      drawBanner(canvas,{size,texts,layout,tone});
      assert.notDeepEqual(ctx.getImageData(logoRect.x,logoRect.y,Math.ceil(logoRect.width),Math.ceil(logoRect.height)).data,withLogo,'Supplied logo must appear in the exported canvas');
    }
    drawBanner(canvas,{size,texts,layout,logo:logos.light});
    const png=await canvas.encode('png');
    assert.equal(png.readUInt32BE(16),size.width);assert.equal(png.readUInt32BE(20),size.height);
    assert.deepEqual(pixel(canvas,1,1),[0,0,0,0],'Empty backgrounds must export as transparent, without checkerboard or guides');
  }
  assert.equal(signatures.size,6,'Each format must have all six different compositions');
  const solid=createCanvas(size.width,size.height);
  for(const {color} of solidBackgrounds) {
    drawBanner(solid,{size,texts:{},solidColor:color});
    const expected=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));
    assert.deepEqual(pixel(solid,1,1),[...expected,255],'Each solid swatch must render as an opaque background');
  }
  const encodedSolid=await loadImage(await solid.encode('png'));
  const decodedSolid=createCanvas(size.width,size.height);decodedSolid.getContext('2d').drawImage(encodedSolid,0,0);
  assert.deepEqual(pixel(decodedSolid,1,1),pixel(solid,1,1),'Solid colors must survive PNG export');
  drawBanner(solid,{size,texts:{}});
  assert.deepEqual(pixel(solid,1,1),[0,0,0,0],'Selecting transparency must clear the solid fill');
  // Removing a background must clear old pixels, even when the canvas size and
  // tone stay the same. Verify alpha survives the actual PNG encode/decode.
  const cleared=createCanvas(size.width,size.height);
  drawBanner(cleared,{size,texts:{},background:white});
  assert.deepEqual(pixel(cleared,1,1),[255,255,255,255]);
  for(const tone of ['light','dark']) {
    drawBanner(cleared,{size,texts,layout:'signature',tone,logo:logos[tone]});
    const exported=await loadImage(await cleared.encode('png'));
    const decoded=createCanvas(size.width,size.height);decoded.getContext('2d').drawImage(exported,0,0);
    assert.deepEqual(pixel(decoded,1,1),[0,0,0,0],'Transparent PNG alpha must survive encoding in either ink tone');
  }
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
// Fade belongs behind the supplied logo, never on the foreground artwork.
for(const size of Object.values(BANNER_SIZES)) {
  const canvas=createCanvas(size.width,size.height);
  drawBanner(canvas,{size,texts:{},logo:logos.light,fade:{enabled:true,side:'left'}});
  const block=bannerBlocks(size)[2],artwork=logos.light[block.asset],box=containRect(artwork.width,artwork.height,block.rect,block);
  const pixels=canvas.getContext('2d').getImageData(box.x,box.y,Math.ceil(box.width),Math.ceil(box.height)).data;
  let whitePixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]===255&&pixels[i+1]===255&&pixels[i+2]===255)whitePixels++;
  assert(whitePixels>100,'Fade must not darken the logo');
}
// Brand assets and fonts must be ready before the interface enables export.
const originalImage=globalThis.Image,originalDocument=globalThis.document;
try {
  globalThis.Image=class {constructor(){this.width=216;this.height=61;}decode(){return Promise.resolve();}};
  globalThis.document={fonts:{load:()=>Promise.resolve([])},createElement:()=>({getContext:()=>({drawImage(){},fillRect(){}})})};
  const {loadBrandAssets}=await import('../src/lib/brand-assets.js');
  await assert.rejects(loadBrandAssets(),/fonts/);
  const requested=[];globalThis.document.fonts.load=font=>{requested.push(font);return Promise.resolve([{}]);};
  const pending=loadBrandAssets();assert.equal(loadBrandAssets(),pending,'Asset loads should be cached');
  const assets=await pending;
  assert.equal(assets.light.lockup.src,'/brand/idem-lockup.svg');assert.equal(assets.light.mark.src,'/brand/idem-mark.svg');
  assert.equal(assets.dark.lockup.width,864,'Dark artwork should retain a sharp alpha mask');
  assert(requested.some(font=>font.includes('Literatura Past')));assert(requested.includes('400 24px "ABC Areal"'));
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
const previous=globalThis.Worker;let terminated=false;
globalThis.Worker=class {postMessage(){}terminate(){terminated=true;}};
const pendingController=new AbortController();
const pending=paintBackground({colors:['#000000','#ffffff'],signal:pendingController.signal});
pendingController.abort();await assert.rejects(pending,{name:'AbortError'});assert(terminated);
globalThis.Worker=previous;
console.log('Passed: all six Figma compositions in both formats, exact square grid spans, real brand fonts, SVG lockup and monogram in both tones, text fitting, PNG dimensions, fades, clean export, and cancellation.');

if(process.argv.includes('--samples')) {
  const painter=await readFile(new URL('../public/painter.js',import.meta.url),'utf8');
  const background=createCanvas(1920,1200);
  const self={postMessage(data){if(data.error)throw new Error(data.error);if(data.pixels)background.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);}};
  new Function('self',painter)(self);
  self.onmessage({data:{colors:['#DFD2AE','#856333','#1C2020','#4A292C','#82908A'],seed:42,width:1920,height:1200}});
  for(const [key,size] of Object.entries(BANNER_SIZES)) {
    const tileWidth=key==='square'?512:640,tileHeight=tileWidth*size.height/size.width;
    const gap=16,labelHeight=32;
    const sheet=createCanvas(tileWidth*3+gap*4,(tileHeight+labelHeight)*2+gap*3),sheetContext=sheet.getContext('2d');
    sheetContext.fillStyle='#242424';sheetContext.fillRect(0,0,sheet.width,sheet.height);
    for(const [index,{id:layout,label}] of BANNER_LAYOUTS.entries()) {
      const canvas=createCanvas(size.width,size.height);
      drawBanner(canvas,{size,texts,layout,background,logo:logos.light,fade:{enabled:true,side:layout==='editorial'?'top':'left'}});
      const x=gap+index%3*(tileWidth+gap),y=gap+Math.floor(index/3)*(tileHeight+labelHeight+gap);
      sheetContext.drawImage(canvas,x,y,tileWidth,tileHeight);
      sheetContext.fillStyle='#e5e5e5';sheetContext.font='14px sans-serif';sheetContext.fillText(label,x,y+tileHeight+22);
      if(index===0)await writeFile(`/tmp/idem-banner-${key}.png`,await canvas.encode('png'));
    }
    await writeFile(`/tmp/idem-banner-${key}-layouts.png`,await sheet.encode('png'));
  }
  console.log('Sample branded exports and layout sheets saved to /tmp/idem-banner-*.png');
}
