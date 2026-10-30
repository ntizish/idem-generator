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

export const BANNER_LAYOUTS = [
  {id:'inset',label:'Inset'}, {id:'monogram',label:'Monogram'},
  {id:'signature',label:'Signature'}, {id:'split',label:'Split'},
  {id:'editorial',label:'Editorial'}, {id:'corner',label:'Corner'},
];
export const DEFAULT_BANNER_LAYOUT = BANNER_LAYOUTS[0].id;
export const BRAND_FONTS = {title:'"Literatura Past"',descriptor:'"ABC Areal"'};
export const BRAND_MARKS = {lockup:{width:216,height:61},mark:{width:77,height:61}};

// Only the six compositions from Figma section 2528:118, in visual order.
// Keep the same column relationships in 16:9; adapt row tracks and type to the
// available height instead of stretching the square artwork horizontally.
const COMPOSITIONS = {
  inset:     {title:[2,4,6,2],descriptor:[2,6,6,2],logo:[2,0,2,1],font:130,descriptorFont:32},
  monogram:  {title:[2,0,6,4],descriptor:[2,6,6,2],logo:[0,0,1,1],font:130,descriptorFont:32,asset:'mark'},
  signature: {title:[2,4,6,2],descriptor:[2,7,6,1],logo:[2,6,2,1],font:52,landscapeFont:104,descriptorFont:32},
  split:     {title:[0,6,4,2],descriptor:[5,7,3,1],logo:[5,6,2,1],font:72,descriptorFont:24},
  editorial: {title:[0,0,8,4],descriptor:[4,6,4,2],logo:[0,6,2,1],font:130,descriptorFont:32},
  corner:    {title:[0,0,8,4],descriptor:[4,7,4,1],logo:[4,6,2,1],font:130,descriptorFont:24},
};

export function bannerBlocks(size,layout=DEFAULT_BANNER_LAYOUT) {
  const grid=gridFor(size);
  const composition=COMPOSITIONS[layout];
  if(!composition)throw new RangeError('Unknown banner layout');
  const scale=(size.height-size.margin*2)/(BANNER_SIZES.square.height-BANNER_SIZES.square.margin*2);
  const titleFont=size.width>size.height?(composition.landscapeFont??composition.font):composition.font;
  const asset=composition.asset||'lockup';
  return [
    {key:'title',kind:'text',rect:gridRect(grid,...composition.title),fontSize:Math.round(titleFont*scale),family:BRAND_FONTS.title,weight:400,lineHeight:1,align:'start'},
    {key:'descriptor',kind:'text',rect:gridRect(grid,...composition.descriptor),fontSize:Math.round(composition.descriptorFont*scale),family:BRAND_FONTS.descriptor,weight:400,lineHeight:1.1,opacity:.7,align:'start'},
    {key:'logo',kind:'image',rect:gridRect(grid,...composition.logo),asset,maxWidth:BRAND_MARKS[asset].width*scale,align:'start'},
  ];
}

function alignOffset(available,used,align) {
  return align==='end'?available-used:align==='center'?(available-used)/2:0;
}

export function containRect(sourceWidth,sourceHeight,box,{maxWidth=box.width,align='start'}={}) {
  const scale=Math.min(box.width/sourceWidth,box.height/sourceHeight,maxWidth/sourceWidth);
  return {x:box.x,y:box.y+alignOffset(box.height,sourceHeight*scale,align),width:sourceWidth*scale,height:sourceHeight*scale};
}

// The chosen side is opaque black; the opposite edge is fully transparent.
export function fadeVector(size,side) {
  const {width:w,height:h}=size;
  const vectors={left:[0,h/2,w,h/2],top:[w/2,0,w/2,h],right:[w,h/2,0,h/2],bottom:[w/2,h,w/2,0]};
  if(!vectors[side])throw new RangeError('Unknown fade direction');
  return vectors[side];
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
  let fontSize=block.fontSize,lines,ascent,descent,height,offsetsX;
  // Explicit headline breaks are editorial decisions. Scale them before
  // wrapping, rather than turning a two-line headline into three ragged lines.
  let headlineLines=block.key==='title'&&text.includes('\n')?text.split('\n'):null;
  while (true) {
    context.font=`${block.weight} ${fontSize}px ${block.family}`;
    lines=headlineLines||wrapText(context,text,block.rect.width);
    const metrics=lines.map(line=>context.measureText(line));
    offsetsX=metrics.map(metric=>metric.actualBoundingBoxLeft);
    ascent=Math.max(0,...metrics.map(metric=>metric.actualBoundingBoxAscent));
    descent=Math.max(0,...metrics.map(metric=>metric.actualBoundingBoxDescent));
    height=ascent+descent+Math.max(0,lines.length-1)*fontSize*block.lineHeight;
    const fitsWidth=metrics.every(metric=>Math.max(metric.width,metric.actualBoundingBoxRight)+Math.max(0,metric.actualBoundingBoxLeft)<=block.rect.width);
    // Extremely long explicit lines still need to wrap at the minimum size.
    if(headlineLines&&!fitsWidth&&fontSize<=8) {headlineLines=null;continue;}
    if ((fitsWidth&&Math.max(height,lines.length*fontSize*block.lineHeight)<=block.rect.height) || fontSize<=8) break;
    fontSize-=1;
  }
  return {lines,fontSize,lineHeight:fontSize*block.lineHeight,ascent,height,offsetsX,offsetY:alignOffset(block.rect.height,height,block.align)};
}

// The export surface contains only the artwork. Checkerboard and guides are
// preview layers; clearing also removes any previously assigned background.
export function drawBanner(canvas,{size,texts,background,solidColor,layout=DEFAULT_BANNER_LAYOUT,tone='light',logo,fade={enabled:false,side:'left'}}) {
  if(canvas.width!==size.width)canvas.width=size.width;
  if(canvas.height!==size.height)canvas.height=size.height;
  const context=canvas.getContext('2d');
  context.clearRect(0,0,size.width,size.height);
  if(solidColor) {
    context.fillStyle=solidColor;context.fillRect(0,0,size.width,size.height);
  }
  if(background) {
    const rect=coverRect(background.width,background.height,size.width,size.height);
    context.drawImage(background,rect.x,rect.y,rect.width,rect.height);
  }
  if(fade.enabled) {
    const gradient=context.createLinearGradient(...fadeVector(size,fade.side));
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,size.width,size.height);
  }
  for(const block of bannerBlocks(size,layout)) {
    if(block.kind==='image') {
      const artwork=logo?.[block.asset];
      if(artwork) {
        const rect=containRect(artwork.width,artwork.height,block.rect,block);
        context.drawImage(artwork,rect.x,rect.y,rect.width,rect.height);
      }
      continue;
    }
    context.save();context.beginPath();context.rect(block.rect.x,block.rect.y,block.rect.width,block.rect.height);context.clip();
    const fitted=fitText(context,texts[block.key]||'',block);
    context.fillStyle=tone==='light'?'#ffffff':'#141414';context.textBaseline='alphabetic';context.globalAlpha=block.opacity??1;
    fitted.lines.forEach((line,index)=>context.fillText(line,block.rect.x+fitted.offsetsX[index],block.rect.y+fitted.offsetY+fitted.ascent+index*fitted.lineHeight));
    context.restore();
  }
}
