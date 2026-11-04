import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {BANNER_SIZES} from '../src/lib/banner-layout.js';
import {reviewBanner} from '../src/lib/banner-review.js';
import {bannerInputSchema} from './banner-options.js';

let fontsReady=false;
export function preflightBanner(input) {
  if(!fontsReady) {
    for(const [file,family] of [['literatura-past.otf','Literatura Past'],['abc-areal-medium.ttf','ABC Areal']])
      if(!GlobalFonts.registerFromPath(fileURLToPath(new URL(`../public/fonts/${file}`,import.meta.url)),family))throw new Error(`Unable to load ${family}`);
    fontsReady=true;
  }
  const options=bannerInputSchema.parse(input),size=BANNER_SIZES[options.format];
  const context=createCanvas(size.width,size.height).getContext('2d');
  const settings={size,texts:{title:options.title,descriptor:options.descriptor},tone:options.tone};
  const initial=reviewBanner(context,{...settings,layout:options.layout==='auto'?'logo-top':options.layout});
  return options.layout==='auto'?reviewBanner(context,{...settings,layout:initial.candidates[0].layout}):initial;
}
