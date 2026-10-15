import React, {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {presets} from '@/lib/palettes';
import {cn} from '@/lib/utils';

function HexInput({ color, index, onCommit }) {
  const [draft, setDraft] = useState(color);
  useEffect(() => setDraft(color), [color]);
  function commit() {
    let value = draft.trim();
    if (!value.startsWith('#')) value = `#${value}`;
    if (/^#[0-9a-f]{3}$/i.test(value)) value = `#${value.slice(1).split('').map(c => c+c).join('')}`;
    if (/^#[0-9a-f]{6}$/i.test(value)) onCommit(value.toUpperCase());
    else setDraft(color);
  }
  return <Input aria-label={`Pigment ${index+1} hex code`} value={draft} maxLength={7} spellCheck={false}
    className="h-8 min-w-0 border-0 bg-transparent! px-1 font-mono text-xs shadow-none"
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if(event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function PaletteControls({ colors, setColors }) {
  const update = (index, value) => setColors(current => current.map((color, i) => i === index ? value : color));
  return <>
    <section className="space-y-3" aria-labelledby="colors-label">
      <div className="flex items-center justify-between"><h2 id="colors-label" className="text-xs font-semibold">Colors</h2><span className="text-[10px] text-muted-foreground">{colors.length} colors</span></div>
      <div className="space-y-1.5">{colors.map((color, index) => <div key={index} className="flex h-11 items-center gap-2 rounded-md border px-2">
        <Input type="color" aria-label={`Pigment ${index+1} color`} value={color} onChange={event => update(index, event.target.value.toUpperCase())} className="h-7 w-7 shrink-0 cursor-pointer rounded-sm border-0 p-0" />
        <HexInput color={color} index={index} onCommit={value => update(index,value)} />
        <Button variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground" aria-label={`Remove pigment ${index+1}`} disabled={colors.length <= 2} onClick={() => setColors(current => current.filter((_,i) => i !== index))}>×</Button>
      </div>)}</div>
      <Button variant="outline" size="sm" className="w-full text-xs" disabled={colors.length >= 6} onClick={() => setColors(current => [...current, '#F5F0E5'])}>＋ Add a color</Button>
    </section>
    <section className="space-y-3" aria-labelledby="palettes-label">
      <h2 id="palettes-label" className="text-xs font-semibold">Palettes</h2>
      <div className="grid grid-cols-2 gap-1.5 max-[600px]:grid-cols-3">{presets.map(preset => {
        const active = preset.colors.join() === colors.join();
        return <Button key={preset.name} variant="outline" aria-label={preset.name} aria-pressed={active} onClick={() => setColors([...preset.colors])}
          className={cn('h-auto min-w-0 flex-col items-stretch gap-1.5 px-2 py-2', active && 'border-ring bg-accent')}>
          <span className="flex w-full overflow-hidden rounded-xs" aria-hidden="true">{preset.colors.map((color,i) => <i key={i} className="h-4 flex-1" style={{background:color}} />)}</span>
          <span className="text-left text-[9px] font-normal text-muted-foreground">{preset.name}</span>
        </Button>;
      })}</div>
    </section>
  </>;
}

