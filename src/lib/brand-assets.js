let assetsPromise;
function loadLogo(src) {
  const image=new Image();image.src=src;
  return image.decode().then(()=>image);
}
// Tint the supplied SVG alpha masks without changing their paths or proportions.
function darkLogo(image) {
  const canvas=document.createElement('canvas');
  canvas.width=image.width*4;canvas.height=image.height*4;
  const context=canvas.getContext('2d');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  context.globalCompositeOperation='source-in';
  context.fillStyle='#141414';context.fillRect(0,0,canvas.width,canvas.height);
  return canvas;
}
export function loadBrandAssets() {
  if(!assetsPromise)assetsPromise=Promise.all([
    loadLogo('/brand/idem-lockup.svg'),loadLogo('/brand/idem-mark.svg'),
    document.fonts.load('400 96px "Literatura Past"'),
    document.fonts.load('400 24px "ABC Areal"'),
  ]).then(([lockup,mark,titleFaces,descriptorFaces])=>{
    if(!titleFaces.length||!descriptorFaces.length)throw new Error('Brand fonts are unavailable.');
    return {light:{lockup,mark},dark:{lockup:darkLogo(lockup),mark:darkLogo(mark)}};
  }).catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}
