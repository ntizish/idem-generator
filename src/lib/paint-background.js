export function readImageFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return Promise.reject(new Error('Choose a JPG, PNG, or WebP image.'));
  if (file.size>20*1024*1024) return Promise.reject(new Error('Choose an image under 20 MB.'));
  const url=URL.createObjectURL(file),image=new Image();
  image.src=url;
  return image.decode().then(()=>image).catch(()=>{throw new Error('This image could not be opened. Please try another image.');}).finally(()=>URL.revokeObjectURL(url));
}

export function imagePigments(image) {
  const scale=3840/Math.max(image.naturalWidth,image.naturalHeight);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.fillStyle='#f4f0e5';context.fillRect(0,0,canvas.width,canvas.height);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return context.getImageData(0,0,canvas.width,canvas.height);
}

export function loadBackgroundPlaceholder() {
  const image=new Image();image.src='/banner-placeholder.jpg';
  return image.decode().then(()=>({canvas:image,placeholder:true})).catch(()=>{throw new Error('The example background could not be loaded.');});
}

export function paintBackground({colors,image,signal,onProgress,width=1920,height=1200}) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted) {reject(new DOMException('Cancelled','AbortError'));return;}
    let worker;
    const dispose=()=>{worker?.terminate();signal.removeEventListener('abort',cancel);};
    const cancel=()=>{dispose();reject(new DOMException('Cancelled','AbortError'));};
    signal.addEventListener('abort',cancel,{once:true});
    try {
      worker=new Worker('/painter.js');
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      worker.onmessage=({data})=>{
        if(data.progress) {onProgress?.(data.progress);return;}
        if(data.error) {dispose();reject(new Error('The background could not be painted. Please try again.'));return;}
        try {
          const canvas=document.createElement('canvas');canvas.width=data.width;canvas.height=data.height;
          canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
          dispose();resolve({canvas,seed});
        } catch(error) {dispose();reject(error);}
      };
      worker.onerror=()=>{dispose();reject(new Error('The background could not be painted. Please try again.'));};
      if(image) {
        const source=imagePigments(image);
        worker.postMessage({seed,width:source.width,height:source.height,sourcePixels:source.data.buffer},[source.data.buffer]);
      } else worker.postMessage({seed,colors:[...colors],width,height});
    } catch(error) {dispose();reject(error);}
  });
}
