import {Worker} from 'node:worker_threads';
import {bannerRecipeSchema} from './banner-options.js';

const cache=new Map();
let active;

export class RenderBusyError extends Error {
  constructor(){super('Another banner is being painted. Retry in a few seconds.');this.status=429;}
}

export async function renderBanner(input,{autoLayout=false}={}) {
  const recipe=bannerRecipeSchema.parse(input),key=JSON.stringify({recipe,autoLayout});
  const cached=cache.get(key);
  if(cached && cached.expires>Date.now())return cached.result;
  if(active) {
    if(active.key===key)return active.promise;
    throw new RenderBusyError();
  }
  const promise=new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./banner-worker.mjs',import.meta.url),{workerData:{recipe,autoLayout},execArgv:[]});
    const timer=setTimeout(()=>finish(new Error('Banner rendering timed out. Try a solid background or retry.')),240_000);
    let settled=false;
    async function finish(error,data) {
      if(settled)return;
      settled=true;clearTimeout(timer);
      await worker.terminate();
      if(error)reject(error);
      else resolve({png:Buffer.from(data.png),jpeg:Buffer.from(data.jpeg),width:data.width,height:data.height,recipe:data.recipe,review:data.review});
    }
    worker.once('message',data=>finish(data.error?new Error(data.error):null,data));
    worker.once('error',error=>finish(error));
    worker.once('exit',code=>{if(!settled)finish(new Error(`Banner renderer exited unexpectedly (${code})`));});
  });
  active={key,promise};
  try {
    const result=await promise;
    // Only an optimization: another instance can always reproduce the recipe.
    const keys=new Set([key,JSON.stringify({recipe:result.recipe,autoLayout:false})]);
    for(const cacheKey of keys) {
      if(!cache.has(cacheKey)&&cache.size>=3)cache.delete(cache.keys().next().value);
      cache.set(cacheKey,{result,expires:Date.now()+5*60_000});
    }
    return result;
  } finally {active=undefined;}
}
