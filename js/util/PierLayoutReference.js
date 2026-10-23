const median=values=>{const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
const round=n=>Math.round(n*1000)/1000;
export function inferPierSettings(layout,slots,sourceId){
 const source=layout.items.find(i=>i.id===sourceId);if(!source)throw Error('Choose an existing reference berth.');
 const points=slots.map(s=>{const item=layout.items.find(i=>i.id===s.id),match=String(s.record?.berthNumber||s.label).trim().match(/(\d+)\s*$/);if(!item||!match)throw Error('Copy spacing from a finished pier with numbered berths.');const n=Number(match[1]);return {id:s.id,n,rank:Math.floor((n-1)/2),side:n%2===0?1:0,x:item.x+item.width/2,y:item.y+item.height/2};});
 if(new Set(points.map(p=>p.n)).size!==points.length)throw Error('The source pier has duplicate berth numbers.');
 if(points.length<3||!points.some(p=>p.side===0)||!points.some(p=>p.side===1))throw Error('To copy both gaps, the source pier needs both sides and at least two berths on one side.');
 const vectors=[];for(const side of [0,1]){const row=points.filter(p=>p.side===side).sort((a,b)=>a.rank-b.rank);for(let i=1;i<row.length;i++){const a=row[i-1],b=row[i],d=b.rank-a.rank;if(d)vectors.push({x:(b.x-a.x)/d,y:(b.y-a.y)/d});}}
 if(!vectors.length)throw Error('The source pier needs at least two numbered berths on one side.');
 const vx=median(vectors.map(v=>v.x)),vy=median(vectors.map(v=>v.y)),pitch=Math.hypot(vx,vy);if(pitch<1)throw Error('Align the source pier before copying its spacing.');
 const axis=Math.abs(vx)>=Math.abs(vy)?'horizontal':'vertical',reverse=axis==='horizontal'?vx<0:vy<0,sign=reverse?-1:1,ax=vx*sign/pitch,ay=vy*sign/pitch;
 const tilt=(axis==='horizontal'?Math.atan2(ay,ax):Math.atan2(-ax,ay))*180/Math.PI,r=tilt*Math.PI/180,cross=axis==='horizontal'?{x:-Math.sin(r),y:Math.cos(r)}:{x:Math.cos(r),y:Math.sin(r)};
 const odds=points.filter(p=>!p.side).map(p=>({x:p.x-p.rank*vx,y:p.y-p.rank*vy})),evens=points.filter(p=>p.side).map(p=>({x:p.x-p.rank*vx,y:p.y-p.rank*vy}));
 const origin={x:median(odds.map(p=>p.x)),y:median(odds.map(p=>p.y))},offset={x:median(evens.map(p=>p.x))-origin.x,y:median(evens.map(p=>p.y))-origin.y},distance=offset.x*cross.x+offset.y*cross.y;
 if(Math.abs(distance)<1)throw Error('Copy spacing from a finished pier with two distinct rows.');
 const tolerance=Math.max(2,pitch*.06);for(const p of points){const x=origin.x+p.rank*vx+p.side*distance*cross.x,y=origin.y+p.rank*vy+p.side*distance*cross.y;if(Math.hypot(x-p.x,y-p.y)>tolerance)throw Error('The source pier is not regularly aligned yet. Finish its alignment before copying the gaps.');}
 const width=source.width,height=source.height,angle=source.rotation||0,mr=(angle-tilt)*Math.PI/180,ex=Math.abs(width*Math.cos(mr))+Math.abs(height*Math.sin(mr)),ey=Math.abs(width*Math.sin(mr))+Math.abs(height*Math.cos(mr)),spacing=pitch-(axis==='horizontal'?ex:ey),gap=Math.abs(distance)-(axis==='horizontal'?ey:ex);
 if(spacing< -1||gap< -1)throw Error('The source markers overlap. Adjust their size or spacing before copying.');
 return {pattern:'two',axis,tilt:round(tilt),width,height,angle,spacing:round(Math.max(0,spacing)),gap:round(Math.max(0,gap)),reverse,swap:distance<0};
}
