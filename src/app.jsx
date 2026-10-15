import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaletteControls } from '@/components/palette-controls';
import { BannerWorkspace } from '@/components/banner-workspace';
import { presets } from '@/lib/palettes';

const modes = { still: '/', upload: '/upload', banner: '/banner' };
function UploadControls() {
  return <>
    <section className="space-y-3" aria-labelledby="source-label">
      <h2 id="source-label" className="text-xs font-semibold">Source image</h2>
      <Label className="upload-drop" id="drop-zone" htmlFor="image-file">
        <strong className="text-xs font-medium text-foreground">Choose an image</strong><span>or drop it here</span><span className="mt-1 text-[9px]">JPG, PNG, WebP · up to 20 MB</span>
        <Input id="image-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload an image to paint" />
      </Label>
      <p id="file-name" className="wrap-anywhere text-[10px] text-muted-foreground">No image selected</p>
    </section>
    <section id="source-preview" className="space-y-3" hidden>
      <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold">Original</h2><span id="source-size" className="text-[10px] text-muted-foreground" /></div>
      <img id="original" alt="Your original image" />
    </section>
  </>;
}

export function App({mode}) {
  const [colors, setColors] = useState([...presets[0].colors]);
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const upload = mode === 'upload';
  useEffect(() => {
    if (mode === 'banner') return;
    let disposed = false, engine;
    const load = upload ? import('./engines/upload.js') : import('./engines/still.js');
    load.then(module => {
      if (disposed) return;
      const mount = module.mountUpload || module.mountStill;
      engine = mount(() => colorsRef.current);
    }).catch(() => { document.querySelector('#status').textContent = 'Unable to start the renderer. Please reload.'; });
    return () => { disposed = true; engine?.destroy(); };
  }, [mode,upload]);

  return <Tabs value={mode} onValueChange={value => location.assign(modes[value])} activationMode="manual" className="gap-0">
    <header className="flex h-16 items-center justify-center border-b bg-card">
      <TabsList aria-label="Generator mode"><TabsTrigger value="still" className="min-w-20 text-xs">Still</TabsTrigger><TabsTrigger value="upload" className="min-w-20 text-xs">Upload</TabsTrigger><TabsTrigger value="banner" className="min-w-20 text-xs">Banner</TabsTrigger></TabsList>
    </header>
    <TabsContent value={mode} className="m-0">
      {mode === 'banner' ? <BannerWorkspace /> : <main className="studio-main">
        <section className="workspace" aria-label="Canvas workspace">
          <div className="canvas-stage"><div className="art-frame">
            <canvas id="painting" width={3840} height={2400} hidden={upload} aria-label={upload ? 'Oil painting of your uploaded image' : 'Generated abstract oil painting'} />
            {upload && <div id="empty-state"><p>Upload an image to begin.</p></div>}
            <div id="loading" hidden={upload}><span className="spinner" aria-hidden="true" /><span id="progress">Preparing canvas…</span></div>
          </div></div>
          <div className="export-bar" aria-label="Export controls">
            <span id="output-size" className="text-[11px] text-muted-foreground">{upload ? '3840 px longest edge' : '3840 × 2400 px'}</span>
            <div className="flex flex-wrap gap-2"><Button id="download" variant="outline" size="sm" className="text-xs" disabled>Export PNG</Button></div>
          </div>
          <p id="status" role="status" aria-live="polite" />
        </section>
        <aside className="settings-panel" aria-label={`${mode[0].toUpperCase()+mode.slice(1)} settings`}>
          {upload ? <UploadControls /> : <PaletteControls colors={colors} setColors={setColors} />}
          <Button id="generate" className="w-full text-xs" disabled><span>{upload ? 'Paint this image' : 'Generate'}</span></Button>

        </aside>
      </main>}
    </TabsContent>
  </Tabs>;
}

