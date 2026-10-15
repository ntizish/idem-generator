import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},cacheDir:'node_modules/.vite-interface-check',appType:'custom'});
try {
  const {App}=await server.ssrLoadModule('/src/app.jsx');
  for(const mode of ['still','upload','banner']) {
    const html=renderToStaticMarkup(React.createElement(App,{mode}));
    assert.equal((html.match(/data-slot="tabs-trigger"/g)||[]).length,3);
    assert(!html.includes('Layered'),'Layered must be removed');
    assert(html.includes('aria-label="Generator mode"'));
    assert(html.includes('aria-label="Export controls"'));
    assert(html.includes('settings-panel'));
    if(mode==='banner') {
      assert(html.includes('aria-label="Banner workspace"'));
      assert(html.includes('id="banner-canvas" width="1024" height="1024"'));
      assert(html.includes('viewBox="0 0 1024 1024"'));
      assert.equal((html.match(/<rect /g)||[]).length,20,'Preview must include the 2- and 8-track row/column overlays');
      for(const id of ['banner-size','show-grid','banner-headline','banner-brand','banner-body','background-source'])assert(html.includes(`id="${id}"`));
      assert(html.includes('24 px gutters'));
    } else assert(html.includes('id="painting"'));
  }
  console.log('Passed: React/shadcn rendering for Still, Upload, and Banner, mode tabs, grid layers, labeled fields, and export controls.');
} finally {await server.close();}
