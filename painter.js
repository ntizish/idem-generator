// A local pigment and paint-height renderer. No images, fonts, or services are fetched.
self.onmessage = ({ data: { colors, seed, width: w, height: h } }) => {
  try {
    let state = seed >>> 0;
    const random = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    // One seeded painting character, plus small variations within each brush.
    // Keep load/coverage bounded and compensate stroke count for brush area.
    const range=(lo,hi)=>lo+(hi-lo)*random();
    const style={
      brushScale:range(.58,1.85), width:range(.65,1.4), density:range(.8,1.15),
      curvature:range(.35,1.5), spread:range(.85,2),
      flowScale:range(1.8,6), flowTurn:range(1.8,5.5), angle:range(-Math.PI,Math.PI),
      jitter:range(.25,1), pigmentLoad:range(.7,1.3), wetness:range(.35,.85),
      pickup:range(.009,.034), pressure:range(.25,.7),
      compositionScale:range(1.8,4.6), warp:range(.8,2.7), patchScale:range(3,9),
      bristleSpacing:range(.7,1.45), grainScale:range(.75,1.35),
      lightAngle:range(-2.7,-.45), lightHeight:range(.73,.88), gloss:range(22,38),
      passes:Array.from({length:4},()=>range(.8,1.2))
    };
    const palette = colors.map(c => [1,3,5].map(i => parseInt(c.slice(i,i+2),16)));
    const tables = Array.from({length:5},()=> Float32Array.from({length:128*128},random));
    function noise(x,y,layer=0) {
      const ix=Math.floor(x),iy=Math.floor(y); let u=x-ix,v=y-iy; u=u*u*(3-2*u); v=v*v*(3-2*v);
      const a=tables[layer], at=(xx,yy)=>a[(yy&127)*128+(xx&127)];
      return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
    }
    function field(x,y) {
      const nx=x/w,ny=y/h;
      const wx=nx*style.compositionScale+(noise(nx*4,ny*4,1)-.5)*style.warp;
      const wy=ny*style.compositionScale+(noise(nx*4+40,ny*4,2)-.5)*style.warp;
      return noise(wx,wy)*.68+noise(wx*2.7,wy*2.7,1)*.23+noise(wx*7,wy*7,2)*.09;
    }
    // Large, softly marbled pigment masses, with all entered colors represented.
    const paint=new Float32Array(w*h*3), relief=new Float32Array(w*h);
    const coarseW=161,coarseH=101,coarse=new Float32Array(coarseW*coarseH);
    let min=1,max=0;
    for(let y=0;y<coarseH;y++)for(let x=0;x<coarseW;x++){const v=field(x/(coarseW-1)*w,y/(coarseH-1)*h);coarse[y*coarseW+x]=v;min=Math.min(min,v);max=Math.max(max,v);}
    function sample(x,y){const u=Math.max(0,Math.min(coarseW-1.001,x/w*(coarseW-1))),v=Math.max(0,Math.min(coarseH-1.001,y/h*(coarseH-1)));const ix=u|0,iy=v|0,fx=u-ix,fy=v-iy;return ((coarse[iy*coarseW+ix]*(1-fx)+coarse[iy*coarseW+ix+1]*fx)*(1-fy)+(coarse[(iy+1)*coarseW+ix]*(1-fx)+coarse[(iy+1)*coarseW+ix+1]*fx)*fy-min)/(max-min);}
    function colorAt(t){const v=Math.max(0,Math.min(.99999,t))*(palette.length-1),i=v|0,f=v-i;return palette[i].map((c,k)=>c*(1-f)+palette[Math.min(i+1,palette.length-1)][k]*f);}
    self.postMessage({progress:'Laying down the first pigments…'});
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x,c=colorAt(sample(x,y));
      for(let k=0;k<3;k++)paint[i*3+k]=c[k];
    }
    // Reduced brush model: each bristle carries pigment, picks up the wet
    // underlayer, and deposits color and height through the same contact mask.
    // No photographic textures or independent embossed shapes are used.
    const scale=w/1920;
    const clamp=v=>Math.max(0,Math.min(1,v));
    const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
    const wet=new Float32Array(w*h);
    const sizes=[105,55,24,11].map((size,i)=>size*style.brushScale*style.passes[i]);
    const counts=[2300,6500,9500,9000].map((count,i)=>Math.round(count*style.density/Math.max(.35,style.brushScale**2*style.width*style.passes[i]**2)));
    const pickupRate=1-Math.pow(1-style.pickup,1/scale);
    for(let pass=0;pass<sizes.length;pass++){
      self.postMessage({progress:['Brushing in the first pigments…','Pulling wet colors together…','Scumbling broken layers of paint…','Leaving the last bristle traces…'][pass]});
      for(let stroke=0;stroke<counts[pass];stroke++){
        const cx=random()*w,cy=random()*h;
        const body=clamp((noise(cx/w*style.patchScale,cy/h*style.patchScale,4)-.3)*2.3);
        if(pass>1 && random()> .2+body*.8)continue;
        // Direction varies by region and follows the developing composition.
        const angle=style.angle+(noise(cx/w*style.flowScale,cy/h*style.flowScale,3)-.5)*style.flowTurn+(random()-.5)*style.jitter;
        const co=Math.cos(angle),si=Math.sin(angle);
        const length=sizes[pass]*(.6+random()*style.spread)*scale;
        const half=length*.5,radius=length*(.13+random()*.21)*style.width;
        const curve=(random()-.5)*radius*style.curvature;
        const bristleCount=Math.max(12,Math.ceil(radius*2/(scale*style.bristleSpacing)));
        const bristles=Float32Array.from({length:bristleCount+2},()=>random());
        const tips=Float32Array.from({length:bristleCount+2},()=>random());
        const carried=new Float32Array((bristleCount+2)*3);
        const tint=(random()-.5)*[7,14,16,13][pass];
        const startColor=colorAt(sample(cx,cy));
        const loaded=clamp(style.wetness+(random()-.5)*.4);
        const contact=[.55,.8,.86,.7][pass];
        const load=[.09,.23,.6,.32][pass]*(.35+body*1.1)*(.5+random())*style.pigmentLoad;
        const offset=random()*100;
        for(let b=0;b<bristleCount+2;b++){
          const across=(b/bristleCount-.5)*radius*2;
          const c=colorAt(sample(cx-si*across,cy+co*across));
          for(let k=0;k<3;k++)carried[b*3+k]=c[k]*.75+startColor[k]*.25+tint+(bristles[b]-.5)*4;
        }
        // Scan along the brush. A bristle carries its own evolving color.
        const step=.85;
        for(let t=-half;t<=half;t+=step){
          const u=t/half;
          const bend=curve*(1-u*u)+Math.sin(u*2+offset)*radius*.08;
          const pressure=Math.pow(Math.max(0,1-u*u),style.pressure);
          const span=radius*(.72+.28*pressure);
          for(let q=-span;q<=span;q+=step){
            const v=q/radius;
            const bpos=clamp((v+1)*.5)*bristleCount;
            const bi=bpos|0,bf=bpos-bi;
            const bristle=bristles[bi]*(1-bf)+bristles[bi+1]*bf;
            const tip=tips[bi]*(1-bf)+tips[bi+1]*bf;
            const x=Math.round(cx+co*t-si*(q+bend)),y=Math.round(cy+si*t+co*(q+bend));
            if(x<0||x>=w||y<0||y>=h)continue;
            const i=y*w+x;
            // Broken pigment at the edge and bristle tips, not an oval stamp.
            const entry=smooth((u+1-tip*.32)*5);
            const exit=smooth((1-u-(1-tip)*.4)*3.8);
            const side=smooth((1-Math.abs(v))*(5+tip*4));
            const tooth=noise(x/(3.2*scale*style.grainScale)+offset,y/(3.2*scale*style.grainScale),2);
            const drag=noise(t/(9*scale)+offset,q/(2.1*scale),4);
            const dry=clamp((bristle*.55+tooth*.3+drag*.15-(1-loaded)*.38)*2.2);
            const coverage=entry*exit*side*dry;
            if(coverage<.015)continue;
            const p=bi*3;
            // Pickup accumulates along a bristle, naturally streaking pigment.
            const pickup=pickupRate*(.3+wet[i]);
            const a=coverage*contact;
            for(let k=0;k<3;k++){
              const old=paint[i*3+k];
              carried[p+k]+=(old-carried[p+k])*pickup;
              paint[i*3+k]=old+(carried[p+k]-old)*a;
            }
            const thickness=load*(.35+bristle*.48+drag*.17)*(1-u*.2);
            // A loaded brush levels old marks; a dry bristle leaves them visible.
            relief[i]+=(thickness-relief[i])*a;
            wet[i]+=(loaded-wet[i])*a;
          }
        }
      }
    }
    // Subpixel settling removes raster artifacts, preserving physical grooves.
    const surface=new Float32Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;
      surface[i]=(relief[i]*4+relief[y*w+Math.max(0,x-1)]+relief[y*w+Math.min(w-1,x+1)]+relief[Math.max(0,y-1)*w+x]+relief[Math.min(h-1,y+1)*w+x])/8;
    }
    const out=new Uint8ClampedArray(w*h*4);
    self.postMessage({progress:'Lighting the painted surface…'});
    const lz=style.lightHeight,lr=Math.sqrt(1-lz*lz);
    const lx=Math.cos(style.lightAngle)*lr,ly=Math.sin(style.lightAngle)*lr;
    const halfLength=Math.sqrt(lx*lx+ly*ly+(lz+1)**2);
    const hx=lx/halfLength,hy=ly/halfLength,hz=(lz+1)/halfLength;
    const flatGloss=Math.pow(hz,style.gloss);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;
      const left=surface[y*w+Math.max(0,x-1)],right=surface[y*w+Math.min(w-1,x+1)];
      const up=surface[Math.max(0,y-1)*w+x],down=surface[Math.min(h-1,y+1)*w+x];
      const nx=(left-right)*2.8*scale,ny=(up-down)*2.8*scale,inv=1/Math.sqrt(1+nx*nx+ny*ny);
      const diffuse=Math.max(0,(nx*lx+ny*ly+lz)*inv);
      const gloss=Math.pow(Math.max(0,(nx*hx+ny*hy+hz)*inv),style.gloss);
      const shade=(diffuse-lz)*.44;
      const highlight=(gloss-flatGloss)*11;
      const weave=Math.sin(x*2.8)*Math.sin(y*2.7)*.28;
      const grain=(random()-.5)*1.2;
      for(let k=0;k<3;k++)out[i*4+k]=paint[i*3+k]*(1+shade)+highlight+grain+weave;
      out[i*4+3]=255;
    }
    self.postMessage({pixels:out.buffer,width:w,height:h,style},[out.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
