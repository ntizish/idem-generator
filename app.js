const $ = s => document.querySelector(s);
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
presets.forEach(p=>{const b=document.createElement('button');b.className='preset';b.title=p.name;b.setAttribute('aria-label',p.name);const strip=document.createElement('span');strip.className='preset-swatches';p.colors.forEach(c=>{const s=document.createElement('i');s.style.background=c;strip.append(s);});const label=document.createElement('span');label.className='preset-name';label.textContent=p.name;b.append(strip,label);b.addEventListener('click',()=>{colors=[...p.colors];renderColors();});$('#presets').append(b);});
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
    edition++;
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
