import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app';
import './index.css';

if(location.pathname.replace(/\/$/,'')==='/layered')history.replaceState(null,'','/banner');
const path=location.pathname.replace(/\/$/,'');
const mode=path==='/upload'?'upload':path==='/banner'?'banner':'still';
createRoot(document.getElementById('root')).render(<App mode={mode}/>);
