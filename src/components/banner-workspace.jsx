import React, {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Separator} from '@/components/ui/separator';
import {PaletteControls} from '@/components/palette-controls';
import {presets} from '@/lib/palettes';
import {BANNER_SIZES,gridFor,drawBanner} from '@/lib/banner-layout';
import {readImageFile,paintBackground} from '@/lib/paint-background';

function GridOverlay({size,layers}) {
  const grid=gridFor(size);
  const tracks=(axis,count,color)=>{
    const length=axis==='column'?size.width:size.height;
    const track=(length-size.margin*2-24*(count-1))/count;
    return <g key={`${axis}-${count}`} fill={color} fillOpacity={.035} stroke={color} strokeOpacity={count===2?.6:.3}>
      {Array.from({length:count},(_,index)=> <rect key={index}
        x={axis==='column'?size.margin+index*(track+24):size.margin}
        y={axis==='row'?size.margin+index*(track+24):size.margin}
        width={axis==='column'?track:size.width-size.margin*2}
        height={axis==='row'?track:size.height-size.margin*2}
        strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
    </g>;
  };
  return <svg className="banner-grid" viewBox={`0 0 ${grid.width} ${grid.height}`} aria-hidden="true">
    {layers.columns2&&tracks('column',2,'#ffb996')}{layers.rows2&&tracks('row',2,'#ffb996')}
    {layers.columns8&&tracks('column',8,'#9bdeff')}{layers.rows8&&tracks('row',8,'#9bdeff')}
  </svg>;
}

function Setting({id,label,children}) {
  return <div className="space-y-2"><Label htmlFor={id} className="text-xs">{label}</Label>{children}</div>;
}

export function BannerWorkspace() {
  const [sizeKey,setSizeKey]=useState('square');
  const size=BANNER_SIZES[sizeKey],grid=gridFor(size);
  const [showGrid,setShowGrid]=useState(true);
  const [layers,setLayers]=useState({columns2:true,rows2:true,columns8:true,rows8:true});
  const [texts,setTexts]=useState({eyebrow:'A NEW PERSPECTIVE',headline:'Your next\nbig thing.',brand:'idem.',body:'A little color.\nA lot of possibility.'});
  const [textColor,setTextColor]=useState('#ffffff');
  const [overlay,setOverlay]=useState(.25);
  const [source,setSource]=useState('generate');
  const [colors,setColors]=useState([...presets[0].colors]);
  const [background,setBackground]=useState(null);
  const [fileName,setFileName]=useState('');
  const [fileLoading,setFileLoading]=useState(false);
  const [hasImage,setHasImage]=useState(false);
  const [busy,setBusy]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [status,setStatus]=useState('');
  const canvas=useRef(null),image=useRef(null),job=useRef(null),fileVersion=useRef(0);

  useEffect(()=>{drawBanner(canvas.current,{size,texts,background:background?.canvas,overlay,textColor});},[size,texts,background,overlay,textColor]);
  useEffect(()=>{
    const preventFileNavigation=event=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault();};
    window.addEventListener('dragover',preventFileNavigation);window.addEventListener('drop',preventFileNavigation);
    return ()=>{job.current?.abort();fileVersion.current++;window.removeEventListener('dragover',preventFileNavigation);window.removeEventListener('drop',preventFileNavigation);};
  },[]);

  function cancelPainting() {job.current?.abort();job.current=null;setBusy(false);}
  function setText(key,value) {setTexts(current=>({...current,[key]:value}));}
  function changeSource(value) {
    cancelPainting();fileVersion.current++;setFileLoading(false);setSource(value);setStatus('');
  }
  async function loadFile(file) {
    if(!file)return;
    const version=++fileVersion.current;
    cancelPainting();setFileLoading(true);setStatus('Opening your image…');
    try {
      const decoded=await readImageFile(file);
      if(version!==fileVersion.current)return;
      image.current=decoded;setHasImage(true);setFileName(file.name);
      setStatus('Image ready. Choose Paint background to apply the oil-paint style.');
    } catch(error) {if(version===fileVersion.current)setStatus(error.message);}
    finally {if(version===fileVersion.current)setFileLoading(false);}
  }
  async function generate() {
    if(busy||fileLoading||(source==='upload'&&!image.current))return;
    cancelPainting();
    const controller=new AbortController();job.current=controller;setBusy(true);setStatus('Mixing your pigments…');
    try {
      const result=await paintBackground({colors,image:source==='upload'?image.current:null,signal:controller.signal,onProgress:message=>{if(!controller.signal.aborted)setStatus(message);}});
      if(controller.signal.aborted)return;
      setBackground(result);setStatus('Background ready. Text and guides remain editable.');
    } catch(error) {if(error.name!=='AbortError'&&!controller.signal.aborted)setStatus(error.message);}
    finally {if(job.current===controller){job.current=null;setBusy(false);}}
  }
  function clearBackground() {cancelPainting();setBackground(null);setStatus('Background removed.');}
  function exportBanner() {
    if(busy||exporting)return;
    setExporting(true);
    const exportSize={...size};
    canvas.current.toBlob(blob=>{
      setExporting(false);
      if(!blob){setStatus('Unable to export the banner. Please try again.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`idem-banner-${exportSize.width}x${exportSize.height}.png`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      setStatus('PNG ready to save. Preview guides are excluded.');
    },'image/png');
  }

  const guides=[['columns2',`2 columns (${grid.halfColumn}px)`],['rows2',`2 rows (${grid.halfRow}px)`],['rows8',`8 rows (${grid.row}px)`],['columns8',`8 columns (${grid.column}px)`]];
  return <main className="studio-main">
    <section className="workspace" aria-label="Banner workspace">
      <div className="canvas-stage"><div className="art-frame banner-frame" style={{'--banner-ratio':size.width/size.height}}>
        <canvas id="banner-canvas" ref={canvas} width={size.width} height={size.height} aria-label={`${size.width} by ${size.height} banner preview`} aria-busy={busy} />
        {showGrid&&<GridOverlay size={size} layers={layers}/>}
      </div></div>
      <div className="export-bar" aria-label="Export controls"><span className="text-[11px] text-muted-foreground">{size.width} × {size.height} px</span><Button size="sm" variant="outline" className="text-xs" onClick={exportBanner} disabled={busy||exporting}>{exporting?'Exporting…':'Export PNG'}</Button></div>
      <p id="status" role="status" aria-live="polite">{status}</p>
    </section>
    <aside className="settings-panel" aria-label="Banner settings">
      <section className="space-y-3"><h2 className="text-xs font-semibold">Banner</h2>
        <Setting id="banner-size" label="Size"><Select value={sizeKey} onValueChange={setSizeKey}><SelectTrigger id="banner-size" className="w-full text-xs"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(BANNER_SIZES).map(([key,value])=><SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select></Setting>
      </section>
      <Separator/>
      <section className="space-y-3" aria-labelledby="grid-heading">
        <div className="flex items-center justify-between"><Label id="grid-heading" htmlFor="show-grid" className="text-xs font-semibold">Show grid</Label><Switch id="show-grid" checked={showGrid} onCheckedChange={setShowGrid}/></div>
        {guides.map(([key,label])=><div key={key} className="flex items-center justify-between gap-2"><Label htmlFor={`grid-${key}`} className="text-[11px] font-normal text-muted-foreground">{label}</Label><Switch id={`grid-${key}`} aria-label={label} checked={layers[key]} disabled={!showGrid} onCheckedChange={checked=>setLayers(current=>({...current,[key]:checked}))}/></div>)}
        <p className="text-[10px] text-muted-foreground">24 px gutters · {size.margin} px margins · guides don’t export</p>
      </section>
      <Separator/>
      <section className="space-y-4" aria-labelledby="text-heading"><h2 id="text-heading" className="text-xs font-semibold">Text</h2>
        <Setting id="banner-eyebrow" label="Eyebrow"><Input id="banner-eyebrow" className="text-xs" maxLength={100} value={texts.eyebrow} onChange={event=>setText('eyebrow',event.target.value)}/></Setting>
        <Setting id="banner-headline" label="Headline"><Textarea id="banner-headline" className="min-h-20 text-xs" maxLength={180} value={texts.headline} onChange={event=>setText('headline',event.target.value)}/></Setting>
        <Setting id="banner-brand" label="Brand"><Input id="banner-brand" className="text-xs" maxLength={80} value={texts.brand} onChange={event=>setText('brand',event.target.value)}/></Setting>
        <Setting id="banner-body" label="Supporting text"><Textarea id="banner-body" className="min-h-20 text-xs" maxLength={600} value={texts.body} onChange={event=>setText('body',event.target.value)}/></Setting>
        <div className="flex items-center justify-between"><Label htmlFor="banner-text-color" className="text-xs">Text color</Label><Input id="banner-text-color" type="color" className="h-8 w-12 p-1" value={textColor} onChange={event=>setTextColor(event.target.value)}/></div>
      </section>
      <Separator/>
      <section className="space-y-4" aria-labelledby="background-heading"><h2 id="background-heading" className="text-xs font-semibold">Background</h2>
        <Setting id="background-source" label="Source"><Select value={source} onValueChange={changeSource}><SelectTrigger id="background-source" className="w-full text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="generate">Generate from colors</SelectItem><SelectItem value="upload">Upload and paint image</SelectItem></SelectContent></Select></Setting>
        {source==='generate'?<PaletteControls colors={colors} setColors={setColors}/>:<div className="space-y-2">
          <Label className="upload-drop" htmlFor="banner-file"><strong className="font-medium text-foreground">Choose an image</strong><span>or drop it here</span><span className="text-[9px]">JPG, PNG, WebP · up to 20 MB</span><Input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload banner background" onChange={event=>{loadFile(event.target.files[0]);event.target.value='';}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();loadFile(event.dataTransfer.files[0]);}}/></Label>
          <p className="wrap-anywhere text-[10px] text-muted-foreground">{fileName||'Your image is painted locally, using the Upload style.'}</p>
        </div>}
        <Button className="w-full text-xs" disabled={busy||fileLoading||(source==='upload'&&!hasImage)} onClick={generate}>{fileLoading?'Opening image…':busy?'Painting background…':source==='upload'?'Paint background':'Generate background'}</Button>
        {busy&&<Button variant="outline" size="sm" className="w-full text-xs" onClick={()=>{cancelPainting();setStatus('Painting cancelled.');}}>Cancel</Button>}
        {background&&<><Setting id="background-dim" label={`Darken background · ${Math.round(overlay*100)}%`}><Input id="background-dim" type="range" min="0" max="80" step="1" value={Math.round(overlay*100)} onChange={event=>setOverlay(Number(event.target.value)/100)} className="h-6 border-0 px-0 shadow-none"/></Setting><Button size="sm" variant="outline" className="w-full text-xs" onClick={clearBackground}>Remove background</Button></>}
      </section>
    </aside>
  </main>;
}
