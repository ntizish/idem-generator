import React, {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,ArrowRight,ArrowDown,Sun,Moon,Plus,Minus,WandSparkles,Square,Image as ImageIcon,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Separator} from '@/components/ui/separator';
import {GridOverlay} from '@/components/banner-grid';
import {presets,solidBackgrounds} from '@/lib/palettes';
import {BANNER_SIZES,BANNER_LAYOUTS,DEFAULT_BANNER_LAYOUT,BRAND_MARKS,bannerBlocks,containRect,drawBanner} from '@/lib/banner-layout';
import {loadBrandAssets} from '@/lib/brand-assets';
import {readImageFile,paintBackground} from '@/lib/paint-background';

function Segments({label,value,onChange,options,disabled=false}) {
  return <ToggleGroup type="single" aria-label={label} value={value} onValueChange={next=>{if(next)onChange(next);}} disabled={disabled} size="sm" spacing={1} className="w-full rounded-lg bg-muted/50 p-1">
    {options.map(({value:key,label:title,content})=><ToggleGroupItem key={key} value={key} aria-label={title} title={title} className="h-8 min-w-0 flex-1 rounded-md px-1.5 text-[11px] text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground">{content||title}</ToggleGroupItem>)}
  </ToggleGroup>;
}

function LayoutIcon({size,layout}) {
  const blocks=bannerBlocks(size,layout);
  return <svg viewBox={`0 0 ${size.width} ${size.height}`} className="size-6 w-11" aria-hidden="true">
    <rect x="8" y="8" width={size.width-16} height={size.height-16} fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="20"/>
    {blocks.map(block=>{
      if(block.kind==='image')return <rect key={block.key} {...containRect(BRAND_MARKS[block.asset].width,BRAND_MARKS[block.asset].height,block.rect,block)} fill="currentColor"/>;
      const height=Math.min(block.rect.height,block.fontSize*1.9);
      const y=block.rect.y+(block.align==='end'?block.rect.height-height:block.align==='center'?(block.rect.height-height)/2:0);
      return <g key={block.key} fill="currentColor" opacity={block.key==='title'?.85:.4}>
        <rect x={block.rect.x} y={y} width={block.rect.width*.9} height={height*.35}/>
        <rect x={block.rect.x} y={y+height*.6} width={block.rect.width*.7} height={height*.35}/>
      </g>;
    })}
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

function SolidBackgrounds({background,onChange}) {
  const value=background?.color||(!background?'transparent':'');
  return <ToggleGroup type="single" aria-label="Solid background color" value={value} onValueChange={next=>{if(next)onChange(next);}} spacing={2} className="grid w-full grid-cols-4 gap-2">
    {solidBackgrounds.map(({name,color})=><ToggleGroupItem key={color} value={color} aria-label={`${name} background`} title={`${name} · ${color}`} className="h-8 min-w-0 rounded-md border border-white/15 p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring data-[state=on]:ring-offset-2 data-[state=on]:ring-offset-card" style={{backgroundColor:color}}><span className="sr-only">{name}</span></ToggleGroupItem>)}
    <ToggleGroupItem value="transparent" aria-label="Transparent background" className="col-span-4 h-8 gap-2 rounded-md border border-border text-[11px] text-muted-foreground data-[state=on]:text-foreground"><span className="transparency-swatch size-4 rounded-sm border border-white/15" aria-hidden="true"/>Transparent</ToggleGroupItem>
  </ToggleGroup>;
}

export function BannerWorkspace() {
  const [sizeKey,setSizeKey]=useState('square');
  const size=BANNER_SIZES[sizeKey];
  const [layout,setLayout]=useState(DEFAULT_BANNER_LAYOUT);
  const [showGrid,setShowGrid]=useState(true);
  const [texts,setTexts]=useState({title:'Your next\nbig thing.',descriptor:'A little color.\nA lot of possibility.'});
  const [tone,setTone]=useState('light');
  const [fade,setFade]=useState({enabled:false,side:'left'});
  const [assets,setAssets]=useState(null);
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

  useEffect(()=>{
    let disposed=false;
    loadBrandAssets().then(result=>{if(!disposed)setAssets(result);}).catch(()=>{if(!disposed)setStatus('The brand fonts or logo could not be loaded. Reload to try again.');});
    return ()=>{disposed=true;};
  },[]);
  useEffect(()=>{
    if(assets)drawBanner(canvas.current,{size,texts,layout,tone,logo:assets[tone],background:background?.canvas,solidColor:background?.color,fade});
  },[size,texts,layout,tone,assets,background,fade]);
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
  function applySolidBackground(value) {
    cancelPainting();fileVersion.current++;setFileLoading(false);
    const transparent=value==='transparent';
    setBackground(transparent?null:{color:value});
    if(transparent)setFade(current=>({...current,enabled:false}));
    setStatus(transparent?'Transparent background selected. PNGs will preserve transparency.':'Solid background ready.');
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
  function clearBackground() {cancelPainting();setBackground(null);setStatus('Background removed. PNGs will export with transparency.');}
  function exportBanner() {
    if(busy||exporting||!assets)return;
    drawBanner(canvas.current,{size,texts,layout,tone,logo:assets[tone],background:background?.canvas,solidColor:background?.color,fade});
    setExporting(true);
    const exportSize={...size};
    canvas.current.toBlob(blob=>{
      setExporting(false);
      if(!blob){setStatus('Unable to export the banner. Please try again.');return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`idem-banner-${exportSize.width}x${exportSize.height}.png`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      setStatus(background?'PNG ready to save. Preview guides are excluded.':'Transparent PNG ready to save. Checkerboard and guides are excluded.');
    },'image/png');
  }

  const fadeOptions=[['left',ArrowLeft],['top',ArrowUp],['right',ArrowRight],['bottom',ArrowDown]].map(([side,Icon])=>({value:side,label:`Fade from ${side}`,content:<Icon className="size-3.5"/>}));
  return <main className="studio-main">
    <section className="workspace" aria-label="Banner workspace">
      <div className="canvas-stage"><div className="art-frame banner-frame" data-tone={tone} style={{'--banner-ratio':size.width/size.height}}>
        <canvas id="banner-canvas" ref={canvas} width={size.width} height={size.height} aria-label={`${size.width} by ${size.height} banner preview`} aria-busy={busy||!assets}/>
        {!assets&&<div className="banner-loading">Loading brand assets…</div>}
        {showGrid&&<GridOverlay size={size}/>}
      </div></div>
      <div className="export-bar" aria-label="Export controls"><span className="text-[11px] text-muted-foreground">{size.width} × {size.height} px{!background&&' · Transparent'}</span><Button size="sm" variant="outline" className="text-xs" onClick={exportBanner} disabled={busy||exporting||!assets}>{exporting?'Exporting…':'Export PNG'}</Button></div>
      <p id="status" role="status" aria-live="polite">{status}</p>
    </section>
    <aside className="settings-panel banner-settings" aria-label="Banner settings">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2>Format</h2><span className="text-[10px] text-muted-foreground">{size.width} × {size.height}</span></div>
        <Segments label="Banner size" value={sizeKey} onChange={setSizeKey} options={[{value:'square',label:'Square 1024 by 1024',content:'1:1'},{value:'landscape',label:'Landscape 1920 by 1080',content:'16:9'}]}/>
        <div className="flex items-center justify-between"><h2>Layout</h2><span className="text-[10px] text-muted-foreground">{BANNER_LAYOUTS.find(item=>item.id===layout).label}</span></div>
        <ToggleGroup type="single" aria-label="Banner layout" value={layout} onValueChange={next=>{if(next)setLayout(next);}} spacing={1} className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1">
          {BANNER_LAYOUTS.map(item=><ToggleGroupItem key={item.id} value={item.id} aria-label={`${item.label} layout`} title={`${item.label} layout`} className="h-14 min-w-0 flex-col gap-1 rounded-md px-1 text-[10px] text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground"><LayoutIcon size={size} layout={item.id}/><span>{item.label}</span></ToggleGroupItem>)}
        </ToggleGroup>
      </section>
      <Separator/>
      <section className="space-y-2" aria-label="Grid controls">
        <div className="flex items-center justify-between"><Label htmlFor="show-grid" className="text-[11px] font-semibold">Grid</Label><Switch id="show-grid" size="sm" checked={showGrid} onCheckedChange={setShowGrid}/></div>
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
        <div className="flex items-center justify-between"><h2>Background</h2>{background&&<Button variant="ghost" size="icon-xs" aria-label="Remove background" title="Remove background" onClick={clearBackground}><X/></Button>}</div>
        <Segments label="Background source" value={source} onChange={changeSource} options={[{value:'generate',label:'Generate background from colors',content:<><WandSparkles className="size-3"/>Generate</>},{value:'upload',label:'Upload and paint background',content:<><ImageIcon className="size-3"/>Upload</>},{value:'solid',label:'Solid background',content:<><Square className="size-3"/>Solid</>}]}/>
        {source==='solid'?<SolidBackgrounds background={background} onChange={applySolidBackground}/>:source==='generate'?<BannerPalette colors={colors} setColors={setColors}/>:<div className="space-y-1.5">
          <Label className="upload-drop py-4!" htmlFor="banner-file"><span>Choose or drop an image</span><Input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload banner background" onChange={event=>{loadFile(event.target.files[0]);event.target.value='';}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();loadFile(event.dataTransfer.files[0]);}}/></Label>
          <p className="truncate text-[9px] text-muted-foreground" title={fileName}>{fileName||'JPG, PNG, WebP · up to 20 MB'}</p>
        </div>}
        {source!=='solid'&&<Button size="sm" className="w-full text-xs" disabled={busy||fileLoading||(source==='upload'&&!hasImage)} onClick={generate}>{fileLoading?'Opening image…':busy?'Painting background…':source==='upload'?'Paint background':'Generate background'}</Button>}
        {busy&&<Button variant="outline" size="sm" className="w-full text-xs" onClick={()=>{cancelPainting();setStatus('Painting cancelled.');}}>Cancel</Button>}
        <div className="flex items-center justify-between"><Label htmlFor="banner-fade" className="text-[11px] font-semibold">Fade</Label><Switch id="banner-fade" size="sm" checked={fade.enabled} onCheckedChange={enabled=>setFade(current=>({...current,enabled}))}/></div>
        <Segments label="Fade direction" value={fade.side} onChange={side=>setFade(current=>({...current,side}))} options={fadeOptions} disabled={!fade.enabled}/>
      </section>
    </aside>
  </main>;
}
