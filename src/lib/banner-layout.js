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
  {id:'logo-top',label:'Logo top',description:'Full logo above a six-column headline and supporting copy.',figmaNode:'2528:80'},
  {id:'offset',label:'Offset',description:'Symbol at top left; large headline and copy offset by two columns.',figmaNode:'2528:84'},
  {id:'stack',label:'Stack',description:'Six-column headline, then full logo and supporting copy at the bottom.',figmaNode:'2528:92'},
  {id:'split',label:'Split',description:'Bottom headline on the left; full logo and supporting copy on the right.',figmaNode:'2528:98'},
  {id:'editorial',label:'Editorial',description:'Full-width headline at the top; logo bottom left and copy bottom right.',figmaNode:'2528:106'},
  {id:'footer',label:'Footer',description:'Full-width headline; full logo above the bottom-right supporting copy.',figmaNode:'2528:111'},
];
export const BRAND_FONTS = {title:'"Literatura Past"',descriptor:'"ABC Areal"'};

// Separate compositions for each format, expressed exclusively in grid spans.
const LEGACY_COMPOSITIONS = {
  square: {
    split:      {title:[0,1,4,4],descriptor:[4,6,4,2],logo:[4,5,2,1],font:96},
    editorial:  {title:[0,0,8,3],descriptor:[4,5,4,2],logo:[0,7,2,1],font:108},
    stack:      {title:[0,2,8,3],descriptor:[0,6,4,2],logo:[6,0,2,1],font:108},
    offset:     {title:[2,1,6,4],descriptor:[2,6,4,2],logo:[0,0,2,1],font:104},
  },
  landscape: {
    split:      {title:[0,1,4,5],descriptor:[4,6,4,2],logo:[4,4,2,2],font:148},
    editorial:  {title:[0,0,6,4],descriptor:[4,5,4,2],logo:[0,6,2,2],font:168},
    stack:      {title:[0,2,6,3],descriptor:[0,6,4,2],logo:[6,0,2,2],font:160},
    offset:     {title:[2,1,6,4],descriptor:[4,6,4,2],logo:[0,0,2,2],font:160},
  },
};

function legacyBlocks(size,layout) {
  const grid=gridFor(size),wide=size.width>size.height;
  const composition=LEGACY_COMPOSITIONS[wide?'landscape':'square'][layout];
  if(!composition)throw new RangeError('Unknown banner layout');
  return [
    {key:'title',kind:'text',rect:gridRect(grid,...composition.title),fontSize:composition.font,family:BRAND_FONTS.title,weight:400,lineHeight:1.06},
    {key:'descriptor',kind:'text',rect:gridRect(grid,...composition.descriptor),fontSize:wide?32:24,family:BRAND_FONTS.descriptor,weight:500,lineHeight:1.15},
    {key:'logo',kind:'image',rect:gridRect(grid,...composition.logo)},
  ];
}

// Approved 1024px Figma frames. Both formats use the same grid anchors;
// landscape extends their spans across its wider tracks.
const COMPOSITIONS = {
  'logo-top': {title:[2,4,6,2],titleHeight:130,descriptor:[2,6,6,2],logo:[2,0],font:130,descriptorFont:32,descriptorInset:7},
  offset: {title:[2,0,6,4],descriptor:[2,6,6,2],logo:[0,0],font:130,descriptorFont:32,descriptorInset:7,symbol:true},
  stack: {title:[2,4,6,2],descriptor:[2,7,6,1],logo:[2,6],font:52,descriptorFont:32},
  split: {title:[0,6,4,2],descriptor:[5,7,3,1],logo:[5,6],font:72,descriptorFont:24},
  editorial: {title:[0,0,8,4],descriptor:[4,6,4,2],logo:[0,6],font:130,descriptorFont:32,descriptorInset:7},
  footer: {title:[0,0,8,4],descriptor:[4,7,4,1],logo:[4,6],font:130,descriptorFont:24},
};

export function bannerBlocks(size,layout='logo-top',version=2) {
  if(version===1)return legacyBlocks(size,layout);
  const grid=gridFor(size),composition=COMPOSITIONS[layout];
  if(!composition)throw new RangeError('Unknown banner layout');
  const descriptor=gridRect(grid,...composition.descriptor);
  descriptor.y+=composition.descriptorInset||0;
  descriptor.height-=composition.descriptorInset||0;
  const anchor=gridRect(grid,...composition.logo,1,1);
  const title=gridRect(grid,...composition.title);
  if(composition.titleHeight)title.height=composition.titleHeight;
  return [
    {key:'title',kind:'text',rect:title,fontSize:composition.font,family:BRAND_FONTS.title,weight:400,lineHeight:1,letterSpacing:-.01,opacity:1},
    {key:'descriptor',kind:'text',rect:descriptor,fontSize:composition.descriptorFont,family:BRAND_FONTS.descriptor,weight:500,lineHeight:1.1,letterSpacing:-.01,opacity:.7},
    {key:'logo',kind:'image',asset:composition.symbol?'symbol':'lockup',rect:{x:anchor.x,y:anchor.y,width:composition.symbol?77:216,height:61}},
  ];
}

export function containRect(sourceWidth,sourceHeight,box) {
  const scale=Math.min(box.width/sourceWidth,box.height/sourceHeight);
  return {x:box.x,y:box.y,width:sourceWidth*scale,height:sourceHeight*scale};
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
  let fontSize=block.fontSize,lines;
  while (true) {
    context.font=`${block.weight} ${fontSize}px ${block.family}`;
    context.letterSpacing=`${fontSize*(block.letterSpacing||0)}px`;
    lines=wrapText(context,text,block.rect.width);
    if (lines.length*fontSize*block.lineHeight<=block.rect.height || fontSize<=8) break;
    fontSize-=1;
  }
  return {lines,fontSize,lineHeight:fontSize*block.lineHeight};
}

// The export surface contains only the artwork. Preview guides live in SVG.
export function drawBanner(canvas,{size,texts,background,layout='logo-top',tone='light',logo,symbol,version=2,fade={enabled:false,side:'left'}}) {
  if(canvas.width!==size.width)canvas.width=size.width;
  if(canvas.height!==size.height)canvas.height=size.height;
  const context=canvas.getContext('2d');
  context.fillStyle=tone==='light'?'#141414':'#f4f0e5';context.fillRect(0,0,size.width,size.height);
  if(background) {
    const rect=coverRect(background.width,background.height,size.width,size.height);
    context.drawImage(background,rect.x,rect.y,rect.width,rect.height);
  }
  if(fade.enabled) {
    const gradient=context.createLinearGradient(...fadeVector(size,fade.side));
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    context.fillStyle=gradient;context.fillRect(0,0,size.width,size.height);
  }
  for(const block of bannerBlocks(size,layout,version)) {
    if(block.kind==='image') {
      const artwork=block.asset==='symbol'?symbol:logo;
      if(artwork) {
        const rect=containRect(artwork.width,artwork.height,block.rect);
        context.drawImage(artwork,rect.x,rect.y,rect.width,rect.height);
      }
      continue;
    }
    context.save();context.beginPath();context.rect(block.rect.x,block.rect.y,block.rect.width,block.rect.height);context.clip();
    const fitted=fitText(context,texts[block.key]||'',block);
    context.globalAlpha=block.opacity??1;
    context.fillStyle=tone==='light'?'#ffffff':'#141414';context.textBaseline='top';
    fitted.lines.forEach((line,index)=>context.fillText(line,block.rect.x,block.rect.y+index*fitted.lineHeight));
    context.restore();
  }
}
