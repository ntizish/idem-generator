let assetsPromise;
function loadLogo(src) {
  const image=new Image();image.src=src;
  return image.decode().then(()=>image);
}
export function loadBrandAssets() {
  if(!assetsPromise)assetsPromise=Promise.all([
    loadLogo('/brand/idem-lockup-white.png'),loadLogo('/brand/idem-lockup-ink.png'),
    loadLogo('/brand/idem-symbol-white.png'),loadLogo('/brand/idem-symbol-ink.png'),
    document.fonts.load('400 96px "Literatura Past"'),
    document.fonts.load('500 24px "ABC Areal"'),
  ]).then(([light,dark,symbolLight,symbolDark,titleFaces,descriptorFaces])=>{
    if(!titleFaces.length||!descriptorFaces.length)throw new Error('Brand fonts are unavailable.');
    return {light,dark,symbolLight,symbolDark};
  }).catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}
