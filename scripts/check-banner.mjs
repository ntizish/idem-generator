import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createCanvas,ImageData} from '@napi-rs/canvas';
import {BANNER_SIZES,gridFor,gridRect,bannerBlocks,coverRect,fitText,drawBanner} from '../src/lib/banner-layout.js';
import {paintBackground,readImageFile} from '../src/lib/paint-background.js';

const square=gridFor(BANNER_SIZES.square),landscape=gridFor(BANNER_SIZES.landscape);
assert.deepEqual([square.margin,square.gap,square.halfColumn,square.halfRow,square.column,square.row],[44,24,456,456,96,96]);
assert.deepEqual([landscape.margin,landscape.gap,landscape.halfColumn,landscape.halfRow,landscape.column,landscape.row],[44,24,904,484,208,103]);
for(const size of Object.values(BANNER_SIZES)) {
  const grid=gridFor(size);
  assert.equal(grid.margin,44,'Every banner must have 44 px padding on all four sides');
  const last=gridRect(grid,7,7,1,1);
  assert.equal(size.width-last.x-last.width,44,'Right padding must be 44 px');
  assert.equal(size.height-last.y-last.height,44,'Bottom padding must be 44 px');
  assert.deepEqual(gridRect(grid,0,0,8,8),{x:size.margin,y:size.margin,width:size.width-2*size.margin,height:size.height-2*size.margin});
  for(const block of bannerBlocks(size)) {
    assert.equal((block.rect.x-size.margin)%(grid.column+24),0);
    assert.equal((block.rect.y-size.margin)%(grid.row+24),0);
    assert(block.rect.x+block.rect.width<=size.width-size.margin);
    assert(block.rect.y+block.rect.height<=size.height-size.margin);
  }
}
assert.throws(()=>gridRect(square,7,0,2,1),RangeError);
for(const [sw,sh] of [[3840,2400],[600,900],[100,100]])for(const size of Object.values(BANNER_SIZES)) {
  const crop=coverRect(sw,sh,size.width,size.height);
  assert(crop.width>=size.width&&crop.height>=size.height);
  assert(Math.abs(crop.width/crop.height-sw/sh)<1e-8,'Backgrounds must not stretch');
  assert.equal(crop.x*2+crop.width,size.width);assert.equal(crop.y*2+crop.height,size.height);
}
function context(){
  return {font:'',draws:[],text:[],fills:[],save(){},restore(){},beginPath(){},rect(){},clip(){},
    measureText(text){return {width:text.length*parseFloat(this.font.split(' ')[1])*.55};},
    fillRect(...args){this.fills.push(args);},drawImage(...args){this.draws.push(args);},fillText(...args){this.text.push(args);}};
}
for(const size of Object.values(BANNER_SIZES))for(const block of bannerBlocks(size)) {
  const ctx=context(),fit=fitText(ctx,('A long heading\n'+ 'unbroken'.repeat(8)+' ' ).repeat(3),block);
  assert(fit.lines.every(line=>ctx.measureText(line).width<=block.rect.width));
  assert(fit.lines.length*fit.lineHeight<=block.rect.height,'Text should shrink inside its grid block');
}
for(const size of Object.values(BANNER_SIZES)) {
  const ctx=context(),canvas={width:0,height:0,getContext:()=>ctx};
  const texts={eyebrow:'LABEL',headline:'Title',brand:'idem.',body:'Description'};
  drawBanner(canvas,{size,texts,background:{width:3840,height:2400}});
  assert.equal(canvas.width,size.width);assert.equal(canvas.height,size.height);
  assert.equal(ctx.draws.length,1);
  assert.deepEqual(ctx.text.map(([text])=>text),Object.values(texts));
  assert.equal(ctx.fills.length,2,'Export draws background and darkening, with no grid fills');
  for(let i=0;i<ctx.text.length;i++)assert.deepEqual(ctx.text[i].slice(1),[bannerBlocks(size)[i].rect.x,bannerBlocks(size)[i].rect.y]);
}
await assert.rejects(readImageFile({type:'text/plain',size:10}),/JPG/);
await assert.rejects(readImageFile({type:'image/png',size:21*1024*1024}),/20 MB/);
const controller=new AbortController();controller.abort();
await assert.rejects(paintBackground({signal:controller.signal}),{name:'AbortError'});
// Replaced background requests must release their worker immediately.
const previous=globalThis.Worker;let terminated=false;
globalThis.Worker=class {postMessage(){}terminate(){terminated=true;}};
const pendingController=new AbortController();
const pending=paintBackground({colors:['#000000','#ffffff'],signal:pendingController.signal});
pendingController.abort();await assert.rejects(pending,{name:'AbortError'});
assert(terminated,'Cancellation must terminate the background worker');
globalThis.Worker=previous;
console.log('Passed: exact reference grid dimensions, grid-bound text, fitting, aspect-preserving crop, guide-free export, invalid uploads, and render cancellation.');

// Exercise real font metrics and PNG encoding, in addition to geometry mocks.
const sampleText={eyebrow:'A NEW PERSPECTIVE',headline:'Your next\nbig thing.',brand:'idem.',body:'A little color.\nA lot of possibility.'};
for(const [key,size] of Object.entries(BANNER_SIZES)) {
  const canvas=createCanvas(size.width,size.height);
  drawBanner(canvas,{size,texts:sampleText});
  const png=await canvas.encode('png');
  assert.equal(png.readUInt32BE(16),size.width);assert.equal(png.readUInt32BE(20),size.height);
  const context=canvas.getContext('2d');
  assert.deepEqual(Array.from(context.getImageData(size.margin,size.height-size.margin-1,1,1).data),[20,20,20,255],
    'Grid positions must remain clean in the exported PNG');
  for(const block of bannerBlocks(size)) {
    const fit=fitText(context,(sampleText[block.key]+' ').repeat(5),block);
    assert(fit.lines.every(line=>context.measureText(line).width<=block.rect.width));
    assert(fit.lines.length*fit.lineHeight<=block.rect.height);
  }
  if(process.argv.includes('--samples'))await writeFile(`/tmp/idem-banner-${key}.png`,png);
}
console.log('Passed: real font fitting, encoded PNG dimensions, and grid-free export pixels.');
if(process.argv.includes('--samples')) {
  const painter=await readFile(new URL('../public/painter.js',import.meta.url),'utf8');
  const background=createCanvas(1920,1200);
  const self={postMessage(data){
    if(data.error)throw new Error(data.error);
    if(data.pixels)background.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
  }};
  new Function('self',painter)(self);
  self.onmessage({data:{colors:['#DFD2AE','#856333','#1C2020','#4A292C','#82908A'],seed:42,width:1920,height:1200}});
  for(const [key,size] of Object.entries(BANNER_SIZES)) {
    const canvas=createCanvas(size.width,size.height);
    drawBanner(canvas,{size,texts:sampleText,background,overlay:.25});
    await writeFile(`/tmp/idem-banner-${key}.png`,await canvas.encode('png'));
  }
  console.log('Preview exports saved to /tmp/idem-banner-square.png and /tmp/idem-banner-landscape.png');
}
