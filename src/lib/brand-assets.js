let assetsPromise;
function loadLogo(src) {
  const image=new Image();image.src=src;
  return image.decode().then(()=>image);
}
export function loadBrandAssets() {
  if(!assetsPromise)assetsPromise=Promise.all([
    loadLogo('/brand/idem-white.png'),loadLogo('/brand/idem-ink.png'),
    document.fonts.load('400 96px "Literatura Past"'),
    document.fonts.load('500 24px "ABC Areal"'),
  ]).then(([light,dark,titleFaces,descriptorFaces])=>{
    if(!titleFaces.length||!descriptorFaces.length)throw new Error('Brand fonts are unavailable.');
    return {light,dark};
  }).catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}
