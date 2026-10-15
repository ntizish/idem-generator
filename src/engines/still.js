export function mountStill(getColors) {
const removers=[];
function listen(target,type,handler){
  target.addEventListener(type,handler);
  removers.push(()=>target.removeEventListener(type,handler));
}
const $ = s => document.querySelector(s);
let edition=0, busy=false, currentColors=[], currentSeed=0;
const outputSize={width:3840,height:2400};
let worker;
function setBusy(value){busy=value;$('#generate').disabled=value;$('#download').disabled=value||!edition;$('#loading').hidden=!value;$('#painting').setAttribute('aria-busy',String(value));}
function generate(){
  if(busy)return;setBusy(true);$('#status').textContent='';$('#progress').textContent='Mixing your pigments…';
  const renderColors=[...getColors()],renderSeed=crypto.getRandomValues(new Uint32Array(1))[0];
  worker?.terminate();worker=new Worker('/painter.js');
  worker.onmessage=({data})=>{
    if(data.progress){$('#progress').textContent=data.progress;return;}
    if(data.error){fail(data.error);return;}
    const canvas=$('#painting');
    canvas.width=data.width;canvas.height=data.height;
    currentColors=renderColors;currentSeed=renderSeed;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
    edition++;
    setBusy(false);$('#status').textContent='Your painting is ready.';worker.terminate();worker=null;
  };
  worker.onerror=()=>fail('The painting could not be completed. Please try again.');
  worker.postMessage({colors:renderColors,seed:renderSeed,...outputSize});
}
function fail(message){setBusy(false);$('#status').textContent=message;worker?.terminate();worker=null;}
listen($('#generate'),'click',generate);
listen($('#download'),'click',()=>{
  $('#painting').toBlob(blob=>{if(!blob){$('#status').textContent='Unable to save this image. Please try again.';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pigment-${currentSeed}-3840x2400.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);$('#status').textContent='Your PNG is ready to save.';},'image/png');
});
generate();

return {destroy(){removers.forEach(remove=>remove());worker?.terminate();}};
}
