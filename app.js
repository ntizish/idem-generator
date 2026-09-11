const $ = s => document.querySelector(s);
const presets = [
  {name:'Butter & light',colors:['#F5F0D9','#E9D995','#D8CFAC','#F7F5E7']},
  {name:'Rose & clay',colors:['#F2DDD0','#C58F7B','#A85C50','#E8C5B8']},
  {name:'Sage & silence',colors:['#E4E6D6','#ADB99D','#6F8067','#D1D7BE']},
  {name:'Blue hour',colors:['#E5E8E9','#A3B6C4','#647E97','#CCD6DA']}
];
let colors=[...presets[0].colors], edition=0, busy=false, currentColors=[], currentSeed=0;
const outputSize={width:3840,height:2400};
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
presets.forEach(p=>{const b=document.createElement('button');b.className='preset';b.title=p.name;b.setAttribute('aria-label',p.name);p.colors.forEach(c=>{const s=document.createElement('i');s.style.background=c;b.append(s);});b.addEventListener('click',()=>{colors=[...p.colors];renderColors();});$('#presets').append(b);});
$('#add').addEventListener('click',()=>{if(colors.length<6){colors.push('#F5F0E5');renderColors();}});
function setBusy(value){busy=value;$('#generate').disabled=value;$('#download').disabled=value||!edition;$('#loading').hidden=!value;$('#painting').setAttribute('aria-busy',String(value));}
function generate(){
  if(busy)return;setBusy(true);$('#status').textContent='';$('#progress').textContent='Mixing your pigments…';
  const renderColors=[...colors],renderSeed=crypto.getRandomValues(new Uint32Array(1))[0];
  worker?.terminate();worker=new Worker('/painter.js');
  worker.onmessage=({data})=>{
    if(data.progress){$('#progress').textContent=data.progress;return;}
    if(data.error){fail(data.error);return;}
    const canvas=$('#painting');
    canvas.width=data.width;canvas.height=data.height;
    currentColors=renderColors;currentSeed=renderSeed;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
    edition++;$('#edition').textContent=`STUDY ${String(edition).padStart(3,'0')}`;
    const preset=presets.find(p=>p.colors.join()===currentColors.join());
    $('#art-title').textContent=preset?`A study in ${preset.name.toLowerCase()}`:'A study in your colors';
    setBusy(false);$('#status').textContent='Your painting is ready.';worker.terminate();worker=null;
  };
  worker.onerror=()=>fail('The painting could not be completed. Please try again.');
  worker.postMessage({colors:renderColors,seed:renderSeed,...outputSize});
}
function fail(message){setBusy(false);$('#status').textContent=message;worker?.terminate();worker=null;}
$('#generate').addEventListener('click',generate);
$('#download').addEventListener('click',()=>{
  $('#painting').toBlob(blob=>{if(!blob){$('#status').textContent='Unable to save this image. Please try again.';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pigment-${currentSeed}-3840x2400.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);$('#status').textContent='Your PNG is ready to save.';},'image/png');
});
renderColors();generate();
