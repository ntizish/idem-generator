import React from 'react';
import {gridFor} from '@/lib/banner-layout';

export function GridOverlay({size}) {
  const grid=gridFor(size);
  const tracks=(axis,count,color)=>{
    const length=axis==='column'?size.width:size.height;
    const track=(length-size.margin*2-24*(count-1))/count;
    return <g key={`${axis}-${count}`} fill={color} fillOpacity={.035} stroke={color} strokeOpacity={count===2?.6:.3}>
      {Array.from({length:count},(_,index)=> <rect key={index}
        x={axis==='column'?size.margin+index*(track+24):size.margin}
        y={axis==='row'?size.margin+index*(track+24):size.margin}
        width={axis==='column'?track:size.width-size.margin*2}
        height={axis==='row'?track:size.height-size.margin*2}
        strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
    </g>;
  };
  return <svg className="banner-grid" viewBox={`0 0 ${grid.width} ${grid.height}`} aria-hidden="true">
    {tracks('column',2,'#ffb996')}{tracks('row',2,'#ffb996')}
    {tracks('column',8,'#9bdeff')}{tracks('row',8,'#9bdeff')}
  </svg>;
}

