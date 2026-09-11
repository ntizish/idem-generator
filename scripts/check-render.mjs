import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
const source=await readFile(new URL('../painter.js',import.meta.url),'utf8');
function render(colors,seed,width=320,height=200){let output;const self={postMessage(data){if(data.error)throw Error(data.error);if(data.pixels)output=data;}};new Function('self',source)(self);self.onmessage({data:{colors,seed,width,height}});assert(output);return new Uint8Array(output.pixels);}
const palette=['#F5F0D9','#E9D995','#D8CFAC','#F7F5E7'];
const a=render(palette,42),b=render(palette,42),c=render(palette,43),d=render(['#321434','#BC828E'],42);
assert.deepEqual(a,b,'Same seed should reproduce a painting');assert.notDeepEqual(a,c,'Fresh seed should change the painting');assert.notDeepEqual(a,d,'Palette should change the painting');
assert.equal(a.length,320*200*4);assert(a.every((v,i)=>i%4!==3||v===255),'PNG must be opaque');
assert(new Set(a).size>30,'Painting must contain tonal detail');
console.log('Passed: deterministic rendering, unique compositions, palette response, dimensions, opacity, tonal detail.');
if(process.argv.includes('--sample')){
 const width=1920,height=1200;const start=Date.now();const chosen=process.argv.includes('--rose')?['#F2DDD0','#C58F7B','#A85C50','#E8C5B8']:palette;const pixels=render(chosen,62781,width,height);
 const crc=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
 await writeFile('/tmp/pigment-sample.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
 console.log(`Full-size sample: /tmp/pigment-sample.png (${Date.now()-start} ms)`);
}
