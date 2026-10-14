/* Ôwatt – local meter-window detection. No data or photographs leave the browser.
   Only geometry is returned; never a guessed meter value. */
(function(root){
'use strict';
function morphology(source,w,h,radius,vertical,erode){
 const out=new Uint8Array(source.length);
 if(vertical){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let on=erode?1:0;
   for(let d=-radius;d<=radius;d++){
    const py=y+d;const val=py>=0&&py<h?source[py*w+x]:0;
    if(erode){if(!val){on=0;break}}else if(val){on=1;break}
   }
   out[y*w+x]=on;
  }
 }else{
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let on=erode?1:0;
   for(let d=-radius;d<=radius;d++){
    const px=x+d;const val=px>=0&&px<w?source[y*w+px]:0;
    if(erode){if(!val){on=0;break}}else if(val){on=1;break}
   }
   out[y*w+x]=on;
  }
 }
 return out;
}
function locate(imageData,kind){
 if(!imageData||!imageData.width||!imageData.height)return null;
 const {data,width:w,height:h}=imageData;
 const mask=new Uint8Array(w*h);
 for(let p=0,i=0;p<mask.length;p++,i+=4){
  const r=data[i],g=data[i+1],b=data[i+2];
  mask[p]=(r>g*1.27&&r>b*1.17&&r-g>14&&r>40)?1:0;
 }
 let smooth=morphology(mask,w,h,3,false,false);
 smooth=morphology(smooth,w,h,2,true,false);
 smooth=morphology(smooth,w,h,3,false,true);
 smooth=morphology(smooth,w,h,2,true,true);
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),regions=[];
 for(let i=0;i<seen.length;i++){
  if(seen[i]||!smooth[i])continue;
  let head=0,tail=1,loX=w,loY=h,hiX=0,hiY=0;queue[0]=i;seen[i]=1;
  while(head<tail){
   const p=queue[head++],x=p%w,y=(p/w)|0;
   if(x<loX)loX=x;if(x>hiX)hiX=x;if(y<loY)loY=y;
   const n0=x? p-1:-1,n1=x<w-1?p+1:-1,n2=y?p-w:-1,n3=y<h-1?p+w:-1;
   for(const n of [n0,n1,n2,n3])if(n>=0&&smooth[n]&&!seen[n]){seen[n]=1;queue[tail++]=n}
  }
  const ww=hiX-loX+1,hh=hiY-loY+1,rx=loX/w,ry=loY/h,rw=ww/w,rh=hh/h;
  if(tail<50||rx<.12||rx>.87||ry<.08||ry>.86||ww<7||hh<7||rw>.20||rh>.15)continue;
  regions.push({x:rx,y:ry,w:rw,h:rh,area:tail,fill:tail/(ww*hh)});
 }
 const pick=(arr)=>arr.sort((a,b)=>b.area+250*b.fill-a.area-250*a.fill)[0];
 const box=(x,y,ww,hh)=>({left:Math.max(0,x),top:Math.max(0,y),width:Math.min(1-Math.max(0,x),ww+(x<0?x:0)),height:Math.min(1-Math.max(0,y),hh+(y<0?y:0))});
 const rowBox=(r,pitch)=>box(r.x-6.0*pitch-.012,r.y-r.h*.33,6.0*pitch+r.w+.018,r.h*1.58);
 if(kind==='electric'){
  const candidates=regions.filter(r=>r.x>.34&&r.x<.79&&r.y>.24&&r.y<.79&&r.w>.03&&r.w<.14&&r.h>.025&&r.h<.095);
  const pairs=[];
  for(const a of candidates)for(const b of candidates){
   const gap=b.y-a.y;
   if(gap<.065||gap>.18||Math.abs(a.x-b.x)>.065||Math.min(a.h,b.h)<.032)continue;
   const score=a.area+b.area+220*(a.fill+b.fill)-850*Math.abs(a.x-b.x)-420*a.y-1000*Math.abs(a.h-b.h);
   pairs.push({a,b,score});
  }
  let top,bottom;
  if(pairs.length){pairs.sort((a,b)=>b.score-a.score);top=pairs[0].a;bottom=pairs[0].b;}
  else{
   const r=pick(candidates.filter(r=>r.y<.7));
   if(!r)return null;
   top=r;bottom={...r,y:r.y+2*r.h};
  }
  const pitch=Math.max(.033,Math.min(.066,Math.min(top.w,bottom.w)*.76));
  return {method:pairs.length?'paired-red-wheels':'single-red-wheel',confidence:pairs.length?'medium':'low',zones:[rowBox(top,pitch),rowBox(bottom,pitch)]};
 }
 if(kind==='pv'){
  const r=pick(regions.filter(r=>r.x>.20&&r.x<.75&&r.y>.20&&r.y<.62&&r.w>.022&&r.w<.09&&r.h>.023&&r.h<.095));
  if(!r)return null;
  const pitch=Math.max(.026,Math.min(.05,r.w*.85));
  return {method:'red-decimal-wheel',confidence:'medium',zones:[box(r.x-6.2*pitch-.01,r.y-r.h*.32,6.2*pitch+r.w+.02,r.h*1.65)]};
 }
 if(kind==='water'){
  const r=pick(regions.filter(r=>r.x>.20&&r.x<.75&&r.y>.20&&r.y<.62&&r.w>.04&&r.w<.14&&r.h>.022&&r.h<.095));
  if(!r)return null;
  return {method:'red-water-wheels',confidence:'low',zones:[box(r.x-2.6*r.w,r.y-r.h*.75,3.7*r.w,r.h*2.6)]};
 }
 return null;
}
root.OwattScan={locate};
})(typeof window==='undefined'?globalThis:window);
