import React, {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,ArrowRight,ArrowDown,Sun,Moon,Plus,Minus,WandSparkles,Image as ImageIcon,Grid2X2,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Separator} from '@/components/ui/separator';
import {GridOverlay} from '@/components/banner-grid';
import {presets} from '@/lib/palettes';
import {BANNER_SIZES,BANNER_LAYOUTS,bannerBlocks,gridFor,drawBanner} from '@/lib/banner-layout';
import {loadBrandAssets} from '@/lib/brand-assets';
import {readImageFile,loadBackgroundPlaceholder,paintBackground} from '@/lib/paint-background';

function Segments({label,value,onChange,options,disabled=false}) {
  return <ToggleGroup type="single" aria-label={label} value={value} onValueChange={next=>{if(next)onChange(next);}} disabled={disabled} size="sm" spacing={1} className="w-full rounded-lg bg-muted/50 p-1">
    {options.map(({value:key,label:title,content})=><ToggleGroupItem key={key} value={key} aria-label={title} title={title} className="h-8 min-w-0 flex-1 rounded-md px-1.5 text-[11px] text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground">{content||title}</ToggleGroupItem>)}
  </ToggleGroup>;
}

function LayoutIcon({size,layout}) {
  const blocks=bannerBlocks(size,layout);
  return <svg viewBox={`0 0 ${size.width} ${size.height}`} className="h-6 w-full max-w-11" aria-hidden="true">
    <rect x="8" y="8" width={size.width-16} height={size.height-16} fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="20"/>
    {blocks.map(block=><rect key={block.key} {...block.rect} fill="currentColor" opacity={block.key==='title'?.85:block.key==='descriptor'?.4:1}/>)}
  </svg>;
}

function BannerPalette({colors,setColors}) {
  return <div className="space-y-2">
    <div className="flex items-center gap-1.5">{colors.map((color,index)=><Input key={index} type="color" aria-label={`Background pigment ${index+1}`} value={color} onChange={event=>setColors(current=>current.map((entry,i)=>i===index?event.target.value.toUpperCase():entry))} className="h-7 min-w-0 flex-1 cursor-pointer border-0 p-0"/>)}
      <Button size="icon-xs" variant="ghost" aria-label="Add background color" title="Add color" disabled={colors.length>=6} onClick={()=>setColors(current=>[...current,'#F5F0E5'])}><Plus/></Button>
      <Button size="icon-xs" variant="ghost" aria-label="Remove last background color" title="Remove last color" disabled={colors.length<=2} onClick={()=>setColors(current=>current.slice(0,-1))}><Minus/></Button>
    </div>
    <div className="grid grid-cols-4 gap-1">{presets.map(preset=><Button key={preset.name} size="sm" variant="ghost" aria-label={preset.name} title={preset.name} aria-pressed={preset.colors.join()===colors.join()} className="h-6 gap-0 overflow-hidden rounded-sm p-1 aria-pressed:ring-1 aria-pressed:ring-ring" onClick={()=>setColors([...preset.colors])}>{preset.colors.map((color,i)=><i key={i} className="h-3 flex-1" style={{background:color}}/>)}</Button>)}</div>
  </div>;
}

const GENERATION_RESOLUTIONS={
  fast:{width:1920,height:1200,label:'Fast'},
  hifi:{width:3840,height:2400,label:'Hi-fi'},
};

export function BannerWorkspace() {
  const [sizeKey,setSizeKey]=useState('square');
  const size=BANNER_SIZES[sizeKey],grid=gridFor(size);
  const [layout,setLayout]=useState('logo-top');
  const [showGrid,setShowGrid]=useState(true);
  const [layers,setLayers]=useState({columns2:true,rows2:true,columns8:true,rows8:true});
  const [texts,setTexts]=useState({title:'Your next\nbig thing.',descriptor:'A little color.\nA lot of possibility.'});
  const [tone,setTone]=useState('light');
  const [fade,setFade]=useState({enabled:false,side:'left'});
  const [assets,setAssets]=useState(null);
  const [source,setSource]=useState('generate');
  const [resolutionKey,setResolutionKey]=useState('fast');
  const [colors,setColors]=useState([...presets[0].colors]);
  const [background,setBackground]=useState(null);
  const [fileName,setFileName]=useState('');
  const [fileLoading,setFileLoading]=useState(false);
  const [hasImage,setHasImage]=useState(false);
  const [busy,setBusy]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [status,setStatus]=useState('');
  const canvas=useRef(null),image=useRef(null),job=useRef(null),fileVersion=useRef(0);

  useEffect(()=>{
    let disposed=false;
    loadBrandAssets().then(result=>{if(!disposed)setAssets(result);}).catch(()=>{if(!disposed)setStatus('The brand fonts or logo could not be loaded. Reload to try again.');});
    return ()=>{disposed=true;};
  },[]);
  useEffect(()=>{
    let disposed=false;
    loadBackgroundPlaceholder().then(result=>{if(!disposed)setBackground(result);}).catch(error=>{if(!disposed)setStatus(error.message);});
    return ()=>{disposed=true;};
  },[]);
  useEffect(()=>{
    if(assets)drawBanner(canvas.current,{size,texts,layout,tone,logo:assets[tone],symbol:assets[tone==='light'?'symbolLight':'symbolDark'],background:source==='transparent'?undefined:background?.canvas,transparent:source==='transparent',fade});
  },[size,texts,layout,tone,assets,background,source,fade]);
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
      const resolution=GENERATION_RESOLUTIONS[resolutionKey];
      const result=await paintBackground({colors,image:source==='upload'?image.current:null,width:resolution.width,height:resolution.height,signal:controller.signal,onProgress:message=>{if(!controller.signal.aborted)setStatus(message);}});
      if(controller.signal.aborted)return;
      setBackground(result);setStatus(`Background ready${source==='generate'?` at ${resolution.width} × ${resolution.height}`:''}. Text and guides remain editable.`);
    } catch(error) {if(error.name!=='AbortError'&&!controller.signal.aborted)setStatus(error.message);}
    finally {if(job.current===controller){job.current=null;setBusy(false);}}
  }
  function clearBackground() {cancelPainting();setBackground(null);setStatus('Background removed.');}
  function exportBanner() {
    if(busy||exporting||!assets)return;
    drawBanner(canvas.current,{size,texts,layout,tone,logo:assets[tone],symbol:assets[tone==='light'?'symbolLight':'symbolDark'],background:source==='transparent'?undefined:background?.canvas,transparent:source==='transparent',fade});
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

  const gridOptions=[['columns2','2 cols',grid.halfColumn],['rows2','2 rows',grid.halfRow],['columns8','8 cols',grid.column],['rows8','8 rows',grid.row]];
  const fadeOptions=[['left',ArrowLeft],['top',ArrowUp],['right',ArrowRight],['bottom',ArrowDown]].map(([side,Icon])=>({value:side,label:`Fade from ${side}`,content:<Icon className="size-3.5"/>}));
  return <main className="studio-main">
    <section className="workspace" aria-label="Banner workspace">
      <div className="canvas-stage"><div className={`art-frame banner-frame${source==='transparent'?' is-transparent':''}`} style={{'--banner-ratio':size.width/size.height}}>
        <canvas id="banner-canvas" ref={canvas} width={size.width} height={size.height} aria-label={`${size.width} by ${size.height} banner preview`} aria-busy={busy||!assets}/>
        {!assets&&<div className="banner-loading">Loading brand assets…</div>}
        {showGrid&&<GridOverlay size={size} layers={layers}/>}
      </div></div>
      <div className="export-bar" aria-label="Export controls"><span className="text-[11px] text-muted-foreground">{size.width} × {size.height} px</span><Button size="sm" variant="outline" className="text-xs" onClick={exportBanner} disabled={busy||exporting||!assets}>{exporting?'Exporting…':'Export PNG'}</Button></div>
      <p id="status" role="status" aria-live="polite">{status}</p>
    </section>
    <aside className="settings-panel banner-settings" aria-label="Banner settings">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2>Format</h2><span className="text-[10px] text-muted-foreground">{size.width} × {size.height}</span></div>
        <Segments label="Banner size" value={sizeKey} onChange={setSizeKey} options={[{value:'square',label:'Square 1024 by 1024',content:'1:1'},{value:'landscape',label:'Landscape 1920 by 1080',content:'16:9'}]}/>
        <div className="flex items-center justify-between"><h2>Layout</h2><span className="text-[10px] text-muted-foreground">{BANNER_LAYOUTS.find(item=>item.id===layout).label}</span></div>
        <Segments label="Banner layout" value={layout} onChange={setLayout} options={BANNER_LAYOUTS.map(item=>({value:item.id,label:`${item.label} layout`,content:<LayoutIcon size={size} layout={item.id}/>}))}/>
      </section>
      <Separator/>
      <section className="space-y-2" aria-label="Grid controls">
        <div className="flex items-center justify-between"><Label htmlFor="show-grid" className="text-[11px] font-semibold">Grid</Label><Switch id="show-grid" size="sm" checked={showGrid} onCheckedChange={setShowGrid}/></div>
        <ToggleGroup type="multiple" aria-label="Grid layers" value={Object.keys(layers).filter(key=>layers[key])} onValueChange={selected=>setLayers(Object.fromEntries(gridOptions.map(([key])=>[key,selected.includes(key)])))} disabled={!showGrid} size="sm" spacing={1} className="w-full rounded-lg bg-muted/50 p-1">
          {gridOptions.map(([key,label,track])=><ToggleGroupItem key={key} value={key} aria-label={label} title={`${label} · ${track}px`} className="h-7 min-w-0 flex-1 rounded-md px-1 text-[10px] data-[state=on]:bg-card">{label}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="text-[10px] text-muted-foreground">44 px margins · 24 px gutters</p>
      </section>
      <Separator/>
      <section className="space-y-3" aria-label="Banner content">
        <div className="space-y-1.5"><div className="flex justify-between"><Label htmlFor="banner-title" className="text-[11px]">Title</Label><span className="text-[9px] text-muted-foreground">Literatura Past</span></div><Textarea id="banner-title" rows={2} className="min-h-16 resize-y text-xs" maxLength={180} value={texts.title} onChange={event=>setText('title',event.target.value)}/></div>
        <div className="space-y-1.5"><div className="flex justify-between"><Label htmlFor="banner-descriptor" className="text-[11px]">Descriptor</Label><span className="text-[9px] text-muted-foreground">ABC Areal</span></div><Textarea id="banner-descriptor" rows={2} className="min-h-14 resize-y text-xs" maxLength={600} value={texts.descriptor} onChange={event=>setText('descriptor',event.target.value)}/></div>
        <div className="flex items-center gap-3"><Label className="shrink-0 text-[11px]">Text & logo</Label><Segments label="Text and logo color" value={tone} onChange={setTone} options={[{value:'light',label:'Light text and logo',content:<><Sun className="size-3"/>Light</>},{value:'dark',label:'Dark text and logo',content:<><Moon className="size-3"/>Dark</>}]}/></div>
      </section>
      <Separator/>
      <section className="space-y-3" aria-label="Background controls">
        <div className="flex items-center justify-between"><h2>Background</h2>{background&&source!=='transparent'&&<Button variant="ghost" size="icon-xs" aria-label="Remove background" title="Remove background" onClick={clearBackground}><X/></Button>}</div>
        <Segments label="Background source" value={source} onChange={changeSource} options={[{value:'generate',label:'Generate background from colors',content:<><WandSparkles className="size-3"/>Generate</>},{value:'upload',label:'Upload and paint background',content:<><ImageIcon className="size-3"/>Upload</>},{value:'transparent',label:'Use a transparent background',content:<><Grid2X2 className="size-3"/>Transparent</>}]}/>
        {source==='generate'?<div className="space-y-3"><BannerPalette colors={colors} setColors={setColors}/><div className="space-y-1.5"><div className="flex items-center justify-between"><Label className="text-[10px] font-semibold">Generation resolution</Label><span className="text-[9px] text-muted-foreground">{GENERATION_RESOLUTIONS[resolutionKey].width} × {GENERATION_RESOLUTIONS[resolutionKey].height}</span></div><Segments label="Generation resolution" value={resolutionKey} onChange={setResolutionKey} disabled={busy} options={Object.entries(GENERATION_RESOLUTIONS).map(([value,item])=>({value,label:`${item.label} background generation at ${item.width} by ${item.height}`,content:item.label}))}/></div></div>:source==='upload'?<div className="space-y-1.5">
          <Label className="upload-drop py-4!" htmlFor="banner-file"><span>Choose or drop an image</span><Input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload banner background" onChange={event=>{loadFile(event.target.files[0]);event.target.value='';}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();loadFile(event.dataTransfer.files[0]);}}/></Label>
          <p className="truncate text-[9px] text-muted-foreground" title={fileName}>{fileName||'JPG, PNG, WebP · up to 20 MB'}</p>
        </div>:<p className="text-[10px] leading-relaxed text-muted-foreground">Export the banner as a PNG with no background. Text and logos remain visible.</p>}
        {source!=='transparent'&&<Button size="sm" className="w-full text-xs" disabled={busy||fileLoading||(source==='upload'&&!hasImage)} onClick={generate}>{fileLoading?'Opening image…':busy?'Painting background…':source==='upload'?'Paint background':'Generate background'}</Button>}
        {busy&&<Button variant="outline" size="sm" className="w-full text-xs" onClick={()=>{cancelPainting();setStatus('Painting cancelled.');}}>Cancel</Button>}
        {source!=='transparent'&&<><div className="flex items-center justify-between"><Label htmlFor="banner-fade" className="text-[11px] font-semibold">Fade</Label><Switch id="banner-fade" size="sm" checked={fade.enabled} onCheckedChange={enabled=>setFade(current=>({...current,enabled}))}/></div>
        <Segments label="Fade direction" value={fade.side} onChange={side=>setFade(current=>({...current,side}))} options={fadeOptions} disabled={!fade.enabled}/></>}
      </section>
    </aside>
  </main>;
}
