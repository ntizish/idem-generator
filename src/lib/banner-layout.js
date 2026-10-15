export const BANNER_SIZES = {
  square: { width: 1024, height: 1024, margin: 44, label: 'Square · 1024 × 1024' },
  landscape: { width: 1920, height: 1080, margin: 44, label: 'Landscape · 1920 × 1080' },
};
export const GRID_GAP = 24;

export function gridFor(size) {
  const {width, height, margin} = size;
  const track = (length, count) => (length - margin*2 - GRID_GAP*(count-1))/count;
  return { ...size, gap:GRID_GAP, column:track(width,8), row:track(height,8), halfColumn:track(width,2), halfRow:track(height,2) };
}

// Every text block starts on a grid line and spans whole tracks and gutters.
export function gridRect(grid, column, row, columns, rows) {
  if (column<0 || row<0 || columns<1 || rows<1 || column+columns>8 || row+rows>8) throw new RangeError('Text must stay inside the 8 × 8 grid.');
  return { x:grid.margin+column*(grid.column+grid.gap), y:grid.margin+row*(grid.row+grid.gap), width:columns*grid.column+(columns-1)*grid.gap, height:rows*grid.row+(rows-1)*grid.gap };
}

export function bannerBlocks(size) {
  const grid=gridFor(size), wide=size.width>size.height;
  return [
    { key:'eyebrow', rect:gridRect(grid,0,0,4,1), fontSize:wide?28:24, family:'Arial, Helvetica, sans-serif', weight:500, lineHeight:1.15 },
    { key:'headline', rect:gridRect(grid,0,2,4,4), fontSize:wide?128:80, family:'Georgia, "Times New Roman", serif', weight:400, lineHeight:1.04 },
    { key:'brand', rect:gridRect(grid,4,5,4,1), fontSize:wide?72:52, family:'Georgia, "Times New Roman", serif', weight:400, lineHeight:1.1 },
    { key:'body', rect:gridRect(grid,4,6,4,2), fontSize:wide?30:24, family:'Arial, Helvetica, sans-serif', weight:500, lineHeight:1.15 },
  ];
}

export function coverRect(sourceWidth,sourceHeight,width,height) {
  const scale=Math.max(width/sourceWidth,height/sourceHeight);
  return {x:(width-sourceWidth*scale)/2,y:(height-sourceHeight*scale)/2,width:sourceWidth*scale,height:sourceHeight*scale};
}

export function wrapText(context,text,maxWidth) {
  const lines=[];
  for (const paragraph of text.split('\n')) {
    let line='';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate=line?`${line} ${word}`:word;
      if (context.measureText(candidate).width<=maxWidth) {line=candidate;continue;}
      if (line) {lines.push(line);line='';}
      for (const character of word) {
        if (line && context.measureText(line+character).width>maxWidth) {lines.push(line);line='';}
        line+=character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function fitText(context,text,block) {
  let fontSize=block.fontSize,lines;
  while (true) {
    context.font=`${block.weight} ${fontSize}px ${block.family}`;
    lines=wrapText(context,text,block.rect.width);
    if (lines.length*fontSize*block.lineHeight<=block.rect.height || fontSize<=8) break;
    fontSize-=1;
  }
  return {lines,fontSize,lineHeight:fontSize*block.lineHeight};
}

// The export surface contains only the artwork. Preview guides live in SVG.
export function drawBanner(canvas,{size,texts,background,overlay=.25,textColor='#ffffff'}) {
  if (canvas.width!==size.width) canvas.width=size.width;
  if (canvas.height!==size.height) canvas.height=size.height;
  const context=canvas.getContext('2d');
  context.fillStyle='#141414';context.fillRect(0,0,size.width,size.height);
  if(background) {
    const rect=coverRect(background.width,background.height,size.width,size.height);
    context.drawImage(background,rect.x,rect.y,rect.width,rect.height);
    context.fillStyle=`rgba(0,0,0,${overlay})`;context.fillRect(0,0,size.width,size.height);
  }
  for(const block of bannerBlocks(size)) {
    context.save();
    context.beginPath();context.rect(block.rect.x,block.rect.y,block.rect.width,block.rect.height);context.clip();
    const fitted=fitText(context,texts[block.key]||'',block);
    context.fillStyle=textColor;context.textBaseline='top';
    fitted.lines.forEach((line,index)=>context.fillText(line,block.rect.x,block.rect.y+index*fitted.lineHeight));
    context.restore();
  }
}
