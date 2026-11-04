import {BANNER_LAYOUTS,bannerBlocks,fitText} from './banner-layout.js';

const round=value=>Math.round(value*100)/100;
const luminance=rgb=>rgb.map(value=>{
  const channel=value/255;
  return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);

export function contrastRatio(foreground,background,opacity=1) {
  const blended=foreground.map((value,index)=>value*opacity+background[index]*(1-opacity));
  const a=luminance(blended),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

// Sample behind the fitted lines, before foreground artwork is drawn. These are
// estimates for painted backgrounds, not a pixel-perfect accessibility audit.
function contrastFor(pixels,size,rects,ink,opacity,target) {
  const ratios=[],light=[];
  for(const rect of rects)for(let row=0;row<4;row++)for(let column=0;column<10;column++) {
    const x=Math.max(0,Math.min(size.width-1,Math.floor(rect.x+(column+.5)*rect.width/10)));
    const y=Math.max(0,Math.min(size.height-1,Math.floor(rect.y+(row+.5)*rect.height/4)));
    const index=(y*size.width+x)*4;
    const rgb=[pixels[index],pixels[index+1],pixels[index+2]];
    ratios.push(contrastRatio(ink,rgb,opacity));light.push(luminance(rgb));
  }
  ratios.sort((a,b)=>a-b);
  const mean=light.reduce((sum,value)=>sum+value,0)/light.length;
  return {target,lowerQuintile:round(ratios[Math.floor(ratios.length*.2)]),minimum:round(ratios[0]),
    passingFraction:round(ratios.filter(value=>value>=target).length/ratios.length),
    luminanceDeviation:round(Math.sqrt(light.reduce((sum,value)=>sum+(value-mean)**2,0)/light.length))};
}

function assessLayout(context,{size,texts,layout,tone,pixels}) {
  const blocks=bannerBlocks(size,layout),issues=[],metrics={},occupied=[];
  let penalty=0;
  function flag(code,element,message,cost,severity='warning') {
    penalty+=cost;issues.push({code,element,severity,message});
  }
  const ink=tone==='dark'?[20,20,20]:[255,255,255];
  for(const block of blocks) {
    let rects=[block.rect];
    if(block.kind==='text') {
      const text=texts[block.key]||'';
      if(!text.trim())continue;
      const fitted=fitText(context,text,block);
      const widths=fitted.lines.map(line=>context.measureText(line).width);
      const height=fitted.lines.length*fitted.lineHeight;
      const fontScale=fitted.fontSize/block.fontSize;
      const previewFontSize=fitted.fontSize*768/size.width;
      rects=fitted.lines.flatMap((line,index)=>line.trim()?[{x:block.rect.x,y:block.rect.y+index*fitted.lineHeight,width:widths[index],height:fitted.lineHeight}]:[]);
      metrics[block.key]={fontSize:fitted.fontSize,previewFontSize:round(previewFontSize),fontScale:round(fontScale),lines:fitted.lines,
        widthUsage:round(Math.max(...widths)/block.rect.width),heightUsage:round(height/block.rect.height)};
      if(height>block.rect.height+.01||widths.some(width=>width>block.rect.width+.01))
        flag('text_overflow',block.key,'Copy cannot fit even at the minimum size. Shorten it before delivering.',100,'error');
      if(fontScale<.7)flag('excessive_shrink',block.key,`Text shrinks to ${Math.round(fontScale*100)}% of its intended size. Try a roomier layout or shorter copy.`,(1-fontScale)*35);
      const minimum=block.key==='title'?24:12;
      if(previewFontSize<minimum)flag('small_text',block.key,`Text is approximately ${round(previewFontSize)} px at a 768 px viewing width. Shorten the copy or choose a larger text area.`,25*(1-previewFontSize/minimum)+10);
      if(block.key==='title'&&block.rect.height>size.height*.3&&height/block.rect.height<.4&&Math.max(...widths)/block.rect.width<.65)
        flag('underfilled_title',block.key,'A small headline occupies little of its large reserved block. Try a more compact composition.',14);
      if(fitted.lines.length>1) {
        const last=fitted.lines.at(-1).trim();
        if(last&&!last.includes(' ')&&widths.at(-1)<Math.max(...widths)*.3)
          flag('orphan_line',block.key,'The final line contains one short word. Try a different layout or adjust the line breaks.',9);
      }
      if(text.split(/\s+/).some(word=>context.measureText(word).width>block.rect.width))
        flag('broken_word',block.key,'An unbroken word is split across lines. Use a wider composition or edit the copy.',12);
    }
    occupied.push(...rects.map(rect=>({...rect,element:block.key})));
    if(pixels&&rects.length) {
      // Body copy uses a conservative 4.5:1 target; titles and brand artwork use
      // 3:1 as a legibility heuristic. Logos have no WCAG contrast requirement.
      const contrast=contrastFor(pixels,size,rects,ink,block.opacity??1,block.key==='descriptor'?4.5:3);
      (metrics[block.key]??={}).contrast=contrast;
      if(contrast.passingFraction<.8)
        flag('low_contrast',block.key,'Parts of the foreground blend into the background. Try a different fade direction, ink color, palette, or layout.',25+(1-contrast.passingFraction)*25);
      if(contrast.luminanceDeviation>.2&&contrast.passingFraction<.95)
        flag('busy_background',block.key,'The background varies strongly behind the content. Move it to a calmer region or use a fade.',8);
    }
  }
  if(metrics.title&&metrics.descriptor&&metrics.title.fontSize/metrics.descriptor.fontSize<1.6)
    flag('weak_hierarchy','title','The headline is too close to the supporting copy in size. Try a larger headline area or less title text.',18);

  // Only measure gaps between occupied elements. An intentionally empty outer
  // region (e.g. the top of Split) is part of the approved composition.
  const intervals=occupied.map(rect=>[rect.y,rect.y+rect.height]).sort((a,b)=>a[0]-b[0]);
  let end=intervals[0]?.[1]??0,largestGap=0;
  for(const [start,bottom] of intervals.slice(1)) {largestGap=Math.max(largestGap,start-end);end=Math.max(end,bottom);}
  metrics.largestInternalGapRatio=round(largestGap/(size.height-size.margin*2));
  if(largestGap/(size.height-size.margin*2)>.28)
    flag('disconnected_content','composition','A large empty band separates foreground elements. Try a layout that groups the copy and logo more closely.',Math.min(28,largestGap/size.height*45));
  for(let i=0;i<occupied.length;i++)for(let j=i+1;j<occupied.length;j++) {
    const a=occupied[i],b=occupied[j];
    if(a.element!==b.element&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)
      flag('overlap','composition','Foreground elements overlap. Choose another layout or shorten the copy.',100,'error');
  }
  return {layout,score:round(100-penalty),status:issues.length?'revise':'pass',issues,metrics};
}

export function reviewBanner(context,{size,texts,layout='logo-top',tone='light',checkContrast=false}) {
  const pixels=checkContrast?context.getImageData(0,0,size.width,size.height).data:null;
  const candidates=BANNER_LAYOUTS.map(({id})=>assessLayout(context,{size,texts,layout:id,tone,pixels}));
  const errors=candidate=>candidate.issues.filter(issue=>issue.severity==='error').length;
  candidates.sort((a,b)=>errors(a)-errors(b)||b.score-a.score||Number(b.layout===layout)-Number(a.layout===layout));
  const selected=candidates.find(candidate=>candidate.layout===layout),best=candidates[0];
  const recommended=errors(best)<errors(selected)||best.score>=selected.score+6?best:selected;
  const suggestions=[];
  if(recommended.layout!==layout)suggestions.push({layout:recommended.layout,reason:'Better text fit, grouping, or legibility for this copy.'});
  if(selected.issues.some(issue=>['low_contrast','busy_background'].includes(issue.code)))
    suggestions.push({reason:'Reuse the seed and compare another fade direction or ink color; review the new preview before delivery.'});
  if(selected.issues.some(issue=>['text_overflow','small_text','excessive_shrink'].includes(issue.code)))
    suggestions.push({reason:'If all layouts struggle, shorten the copy with the user’s approval. Do not silently rewrite it.'});
  return {status:selected.status,selectedLayout:layout,recommendedLayout:recommended.layout,score:selected.score,issues:selected.issues,
    suggestedChanges:suggestions,candidates,contrastChecked:checkContrast,requiresVisualReview:true,
    note:checkContrast?'Heuristic review of text geometry and sampled background pixels. Inspect the preview for optical balance and legibility.':'Preflight checks text geometry only. Contrast is checked after generation. Inspect the final preview.'};
}
