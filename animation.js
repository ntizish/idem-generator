const $ = s => document.querySelector(s);
const accumulating=document.body.dataset.motion==='layered';
const modeName=accumulating?'layered':'moving';
let basePixels=null,brushStyle=null;
const presets = [
  {name:'Chiaroscuro',colors:['#DFD2AE','#856333','#1C2020','#4A292C','#82908A']},
  {name:'Crimson & gold',colors:['#E1CBA0','#AD8543','#211B1B','#572329','#963E36']},
  {name:'Storm & stone',colors:['#DAD1B7','#A49B7E','#1B2329','#34454D','#687F86']},
  {name:'Forest & bronze',colors:['#D7C59F','#9D7844','#1B211D','#39432D','#696447']},
  {name:'Midnight & ivory',colors:['#DDD7C5','#858F9C','#151E30','#293D5D','#577390']},
  {name:'Prussian & ochre',colors:['#DCD0AD','#AE874D','#14272E','#234C60','#658894']},
  {name:'Blue hour',colors:['#D7D4D9','#A09AAB','#222638','#48526F','#7B8CA5']},
  {name:'Sea mist',colors:['#E2DFCF','#A8B5B1','#243C43','#497580','#8DA6AC']},
  {name:'Slate & linen',colors:['#E2D8C4','#A89E8B','#2D363E','#546573','#91A0A8']},
  {name:'Indigo & rose',colors:['#DDD0C6','#AF8D8A','#25243B','#404A70','#7E90AA']},
  {name:'Baltic & copper',colors:['#DCCDB6','#A57250','#172F3B','#30566B','#7799A3']},
  {name:'Winter light',colors:['#EAE5D8','#BAC5CA','#374854','#708A9D','#A5B8C6']}
];
let colors=[...presets[0].colors], edition=0, busy=false, currentColors=[], currentSeed=0;
const outputSize={width:1280,height:800};
let worker;
function renderColors(){
  $('#colors').replaceChildren();
  colors.forEach((color,index)=>{
    const row=document.createElement('div'); row.className='color-row';
    const swatch=document.createElement('label'); swatch.className='swatch'; swatch.style.background=color;
    const picker=document.createElement('input');picker.type='color';picker.value=color;picker.setAttribute('aria-label',`Pigment ${index+1} color`);
    const hex=document.createElement('input');hex.className='hex';hex.value=color;hex.maxLength=7;hex.spellcheck=false;hex.setAttribute('aria-label',`Pigment ${index+1} hex code`);
    picker.addEventListener('input',()=>{colors[index]=picker.value.toUpperCase();hex.value=colors[index];swatch.style.background=colors[index];updatePresets();});
    hex.addEventListener('change',()=>{let value=hex.value.trim();if(!value.startsWith('#'))value='#'+value;if(/^#[0-9a-f]{3}$/i.test(value))value='#'+value.slice(1).split('').map(c=>c+c).join('');if(/^#[0-9a-f]{6}$/i.test(value)){colors[index]=value.toUpperCase();picker.value=value;swatch.style.background=value;updatePresets();}hex.value=colors[index];});
    const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove pigment ${index+1}`);remove.disabled=colors.length<=2;
    remove.addEventListener('click',()=>{colors.splice(index,1);renderColors();});
    swatch.append(picker);row.append(swatch,hex,remove);$('#colors').append(row);
  });
  $('#color-count').textContent=`${colors.length} colors`;$('#add').disabled=colors.length>=6;updatePresets();
}
function updatePresets(){document.querySelectorAll('.preset').forEach((el,i)=>{const active=colors.join()==presets[i].colors.join();el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});}
presets.forEach(p=>{const b=document.createElement('button');b.className='preset';b.title=p.name;b.setAttribute('aria-label',p.name);const strip=document.createElement('span');strip.className='preset-swatches';p.colors.forEach(c=>{const s=document.createElement('i');s.style.background=c;strip.append(s);});const label=document.createElement('span');label.className='preset-name';label.textContent=p.name;b.append(strip,label);b.addEventListener('click',()=>{colors=[...p.colors];renderColors();});$('#presets').append(b);});
$('#add').addEventListener('click',()=>{if(colors.length<6){colors.push('#F5F0E5');renderColors();}});
const canvas=$('#painting'),ctx=canvas.getContext('2d',{alpha:false});
const mask=document.createElement('canvas'),layer=document.createElement('canvas');
for(const c of [mask,layer]){c.width=outputSize.width;c.height=outputSize.height;}
const maskCtx=mask.getContext('2d'),layerCtx=layer.getContext('2d');
let target=null,nextTarget=null,strokes=[],raf=0,lastTime=0,paintTime=0,paused=false,hidden=document.hidden,recorder=null,recordTimer=null;
let randomState=1;
function rand(){randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;}
function setBusy(value){busy=value;$('#generate').disabled=value;$('#loading').hidden=!value;$('#download').disabled=value;$('#pause').disabled=value;$('#record').disabled=value||!canRecord;canvas.setAttribute('aria-busy',String(value));}
const mediaType=typeof MediaRecorder==='undefined'?'':['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
const canRecord=Boolean(mediaType&&canvas.captureStream);
if(!canRecord)$('#record').title='Video recording is unavailable in this browser. You can still save a frame.';
function prepare(first=false){
  worker?.terminate();worker=new Worker('/painter.js');
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  worker.onmessage=({data})=>{
    if(data.progress){if(first)$('#progress').textContent=data.progress;return;}
    if(data.error){fail(data.error,first);return;}
    const picture=document.createElement('canvas');picture.width=data.width;picture.height=data.height;
    picture.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
    worker.terminate();worker=null;
    if(first){
      target=picture;basePixels=new Uint8ClampedArray(data.pixels);brushStyle=data.style;currentSeed=seed;randomState=seed;strokes=[];paintTime=0;lastTime=0;
      ctx.fillStyle=currentColors[2]||currentColors[0];ctx.fillRect(0,0,canvas.width,canvas.height);
      if(accumulating)ctx.drawImage(target,0,0);
      setBusy(false);edition++;$('#edition').textContent=`${modeName.toUpperCase()} STUDY ${String(edition).padStart(3,'0')}`;
      const preset=presets.find(p=>p.colors.join()===currentColors.join());$('#art-title').textContent=preset?`A ${modeName} study in ${preset.name.toLowerCase()}`:`A ${modeName} study in your colors`;
      // Reduced-motion users choose when animation starts.
      if(paused){ctx.drawImage(target,0,0);$('#status').textContent='Ready. Press Play to start the brush strokes.';}
      else {$('#status').textContent='Your painting is unfolding.';schedule();}
      updatePause();if(!accumulating)prepare();
    }else nextTarget=picture;
  };
  worker.onerror=()=>fail('Could not prepare the next painting. Try painting something new.',first);
  worker.postMessage({colors:currentColors,seed,...outputSize});
}
function fail(message,first){worker?.terminate();worker=null;if(first){setBusy(false);$('#download').disabled=!target;$('#pause').disabled=!target;$('#record').disabled=!target||!canRecord;}$('#status').textContent=message;}
function generate(){
  if(busy)return;stopRecording();cancelAnimationFrame(raf);raf=0;worker?.terminate();target=null;nextTarget=null;
  currentColors=[...colors];paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  setBusy(true);$('#status').textContent='';$('#progress').textContent='Preparing the first painted variation…';prepare(true);
}
function makeStroke(){
  if(accumulating){
    const x=rand()*canvas.width,y=rand()*canvas.height;
    const angle=brushStyle.angle+Math.sin(x/220+y/300)*.65+(rand()-.5)*.7;
    const length=25+rand()*95,width=4+rand()*17;
    const i=((y|0)*canvas.width+(x|0))*4;
    const tone=(rand()-.5)*22;
    const color=[0,1,2].map(k=>Math.max(0,Math.min(255,basePixels[i+k]+tone)));
    return {x,y,dx:Math.cos(angle)*length,dy:Math.sin(angle)*length,bend:(rand()-.5)*length*.3,width,color,t:0,duration:1.5+rand()*2.5,bristles:Array.from({length:15},()=>.25+rand()*.75)};
  }
  const x=rand()*canvas.width,y=rand()*canvas.height,angle=rand()*Math.PI*2;
  const length=65+rand()*210,width=20+rand()*65;
  return {x,y,dx:Math.cos(angle)*length,dy:Math.sin(angle)*length,bend:(rand()-.5)*length*.8,width,t:0,duration:.65+rand()*1.2,bristles:Array.from({length:9},()=>.35+rand()*.65)};
}
function point(s,t){return {x:s.x+s.dx*t-s.dy*.3*Math.sin(t*Math.PI),y:s.y+s.dy*t+s.bend*Math.sin(t*Math.PI)};}
function schedule(){if(!raf&&!paused&&!hidden&&target)raf=requestAnimationFrame(frame);}
function frame(now){
  raf=0;if(paused||hidden||!target)return;
  const dt=lastTime?Math.min(.05,(now-lastTime)/1000):1/60;lastTime=now;paintTime+=dt;
  // Replace the pigment source, never the displayed image: each new variation
  // is revealed by the next brush contacts, without a cut or full-image fade.
  if(!accumulating&&paintTime>12&&nextTarget){target=nextTarget;nextTarget=null;paintTime=0;prepare();}
  while(strokes.length<(accumulating?8:38))strokes.push(makeStroke());
  if(accumulating){
    // Only deposit new pigment. No clears, fades, base redraws, or new targets.
    ctx.lineCap='round';
    for(const s of strokes){
      const old=s.t;s.t=Math.min(1,s.t+dt/s.duration);
      const a=point(s,old),b=point(s,s.t),pressure=Math.pow(Math.sin(s.t*Math.PI),.6);
      const nx=-s.dy/Math.hypot(s.dx,s.dy),ny=s.dx/Math.hypot(s.dx,s.dy);
      for(let j=0;j<s.bristles.length;j++){
        const bristle=s.bristles[j],offset=(j/(s.bristles.length-1)-.5)*s.width*pressure;
        const relief=(bristle-.5)*12;
        const color=s.color.map(v=>Math.round(Math.max(0,Math.min(255,v+relief))));
        ctx.strokeStyle=`rgba(${color.join(',')},${(.08+bristle*.16)*pressure})`;
        ctx.lineWidth=Math.max(.4,s.width/s.bristles.length*bristle*pressure);
        ctx.beginPath();ctx.moveTo(a.x+nx*offset,a.y+ny*offset);ctx.lineTo(b.x+nx*offset,b.y+ny*offset);ctx.stroke();
      }
    }
    strokes=strokes.filter(s=>s.t<1);schedule();return;
  }
  maskCtx.clearRect(0,0,canvas.width,canvas.height);maskCtx.lineCap='round';
  for(const s of strokes){
    const old=s.t;s.t=Math.min(1,s.t+dt/s.duration);const a=point(s,old),b=point(s,s.t);
    const pressure=.4+.6*Math.sin(s.t*Math.PI),normalX=-s.dy/Math.hypot(s.dx,s.dy),normalY=s.dx/Math.hypot(s.dx,s.dy);
    for(let j=0;j<s.bristles.length;j++){
      const offset=(j-4)*s.width/9*pressure;
      maskCtx.strokeStyle=`rgba(255,255,255,${s.bristles[j]*.38})`;maskCtx.lineWidth=s.width/8*pressure;
      maskCtx.beginPath();maskCtx.moveTo(a.x+normalX*offset,a.y+normalY*offset);maskCtx.lineTo(b.x+normalX*offset,b.y+normalY*offset);maskCtx.stroke();
    }
  }
  strokes=strokes.filter(s=>s.t<1);
  layerCtx.globalCompositeOperation='source-over';layerCtx.clearRect(0,0,canvas.width,canvas.height);layerCtx.drawImage(target,0,0);
  layerCtx.globalCompositeOperation='destination-in';layerCtx.filter='blur(2px)';layerCtx.drawImage(mask,0,0);layerCtx.filter='none';ctx.drawImage(layer,0,0);
  schedule();
}
function updatePause(){$('#pause').textContent=paused?'Play':'Pause';$('#pause').setAttribute('aria-pressed',String(paused));}
$('#pause').addEventListener('click',()=>{paused=!paused;if(paused){cancelAnimationFrame(raf);raf=0;stopRecording();}lastTime=0;updatePause();schedule();});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden){cancelAnimationFrame(raf);raf=0;stopRecording();}lastTime=0;schedule();});
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('#download').addEventListener('click',()=>canvas.toBlob(blob=>{if(blob)save(blob,`pigment-${modeName}-${currentSeed}.png`);},'image/png'));
function stopRecording(){clearTimeout(recordTimer);if(recorder&&recorder.state==='recording')recorder.stop();}
$('#record').addEventListener('click',()=>{
  if(recorder?.state==='recording'){stopRecording();return;}
  if(!canRecord||!target)return;
  paused=false;updatePause();schedule();
  const stream=canvas.captureStream(30),chunks=[],recordSeed=currentSeed;
  try{recorder=new MediaRecorder(stream,{mimeType:mediaType,videoBitsPerSecond:8000000});}
  catch{stream.getTracks().forEach(t=>t.stop());$('#status').textContent='This browser could not start recording.';return;}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(chunks.length)save(new Blob(chunks,{type:mediaType}),`pigment-${modeName}-${recordSeed}.${mediaType.startsWith('video/mp4')?'mp4':'webm'}`);$('#record').textContent='Record 12 seconds';$('#status').textContent=chunks.length?'Your video is ready to save.':'No video was captured.';recorder=null;};
  recorder.onerror=()=>{$('#status').textContent='Video recording failed.';stopRecording();};
  recorder.start();$('#record').textContent='Stop & save';$('#status').textContent='Recording 12 seconds…';recordTimer=setTimeout(stopRecording,12000);
});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);worker?.terminate();stopRecording();});
$('#generate').addEventListener('click',generate);
renderColors();generate();
