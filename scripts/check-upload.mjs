import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const painter = await readFile(new URL('../painter.js', import.meta.url), 'utf8');
function render(sourcePixels, width=160, height=100) {
  let result;
  const self = {postMessage(data) {if (!data.progress) result = data;}};
  new Function('self', painter)(self);
  self.onmessage({data:{sourcePixels, width, height, seed:42}});
  return result;
}
// A recognizable two-color composition must survive painting spatially.
const source = new Uint8ClampedArray(160*100*4);
for(let y=0;y<100;y++)for(let x=0;x<160;x++)source.set(x<80?[210,40,30,255]:[30,50,210,255],(y*160+x)*4);
const output = render(source.buffer);
assert(!output.error, output.error);
const pixels = new Uint8ClampedArray(output.pixels);
assert.deepEqual(output.pixels, render(source.buffer).pixels, 'Image studies should be repeatable with the same seed');
let left=0,right=0;
for(let y=0;y<100;y++)for(let x=0;x<160;x++){
  const i=(y*160+x)*4;
  assert.equal(pixels[i+3],255);
  if(x<50)left+=pixels[i]-pixels[i+2];
  if(x>110)right+=pixels[i+2]-pixels[i];
}
assert(left/(50*100)>100,'Preserve the red region on the left');
assert(right/(49*100)>100,'Preserve the blue region on the right');
assert.notDeepEqual(pixels,source,'Apply brush texture and lighting to the image');
const portrait=render(new Uint8ClampedArray(40*100*4).fill(180).buffer,40,100);
assert.equal(portrait.width,40);assert.equal(portrait.height,100);
assert(render(new ArrayBuffer(4)).error,'Reject incorrect source dimensions');
// With identical pigment, both entry points must produce exactly the same
// brush marks and finish. This catches upload-only brush size/density drift.
const uniform = new Uint8ClampedArray(160*100*4);
for(let i=0;i<uniform.length;i+=4)uniform.set([128,128,128,255],i);
let paletteResult;
const paletteWorker = {postMessage(data) {if(data.pixels)paletteResult=data;}};
new Function('self',painter)(paletteWorker);
paletteWorker.onmessage({data:{colors:['#808080','#808080'],seed:42,width:160,height:100}});
assert.deepEqual(render(uniform.buffer).pixels,paletteResult.pixels,
  'Uploads must use the same brush scale, density, bristle marks, and finish as Still');
console.log('Passed: source composition, painted finish, repeatability, portrait proportions, opaque output, invalid source handling, and matching Still brushwork.');
