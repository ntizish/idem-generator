import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../animation.js',import.meta.url),'utf8');
const contexts=[],workers=[];
function element(){const context={draws:0,clears:0,strokes:0,drawImage(){this.draws++;},clearRect(){this.clears++;},stroke(){this.strokes++;},fillRect(){},putImageData(){},beginPath(){},moveTo(){},lineTo(){}};contexts.push(context);return {width:1280,height:800,dataset:{motion:'layered'},style:{},classList:{toggle(){}},append(){},replaceChildren(){},setAttribute(){},addEventListener(){},getContext(){return context;}};}
const elements=new Map();const document={body:element(),hidden:false,querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return [];},createElement:element,addEventListener(){}};
class Worker{constructor(){workers.push(this);}postMessage(){}terminate(){}}
class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}}
const api=new Function('document','Worker','ImageData','crypto','matchMedia','requestAnimationFrame','cancelAnimationFrame','window',source+'\nreturn {frame};')(document,Worker,ImageData,{getRandomValues(a){a[0]=42;return a;}},()=>({matches:false}),()=>1,()=>{},{addEventListener(){}});
const pixels=new Uint8ClampedArray(1280*800*4).fill(80);
workers[0].onmessage({data:{pixels:pixels.buffer,width:1280,height:800,style:{angle:.5}}});
const ctx=elements.get('#painting').getContext();const initialDraws=ctx.draws;
for(let n=0;n<2000;n++)api.frame(n*16.67);
assert.equal(workers.length,1,'Layered mode must not generate replacement paintings');
assert.equal(ctx.draws,initialDraws,'Frames must not redraw the base');
assert.equal(ctx.clears,0,'Frames must never erase accumulated paint');
assert(ctx.strokes>1000,'Frames must add new bristle marks');
console.log('Passed: layered mode adds strokes without clearing, redrawing, or replacing the painting over 33 seconds.');
