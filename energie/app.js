(()=>{'use strict';
const SEED=[
{date:'2025-12-12',day:30215,night:25336,pv:70461,water:119.39},
{date:'2025-12-25',day:30283,night:25421},
{date:'2026-01-03',day:30305,night:25451},
{date:'2026-02-02',day:30461,night:25506,pv:70756},
{date:'2026-03-01',day:30536,night:25439,pv:70985},
{date:'2026-03-24',day:30536,night:25195},
{date:'2026-04-28',day:30473,night:24845},
{date:'2026-06-03',water:158},
{date:'2026-08-12',day:30130,night:23796},
{date:'2026-10-07',day:30153,night:23353,pv:75498,water:220.7}
];
const DEFAULT_EVENTS=[{id:'pool-2026',date:'2026-07-15',label:'Remplissage piscine (juillet)',amount:16,approx:true}];
const KEY='flux-hannut-v1';
const REFERENCE='2026-03-24';
const DEFAULT_OIL_READINGS=[
 {id:'oil-2025-12-12',date:'2025-12-12',liters:0,phase:'before'},
 {id:'oil-2026-02-15',date:'2026-02-15',liters:650,phase:'before'},
 {id:'oil-2026-09-21-pre',date:'2026-09-21',liters:50,phase:'before'}
];
const DEFAULT_OIL_DELIVERIES=[{id:'oil-fill-2025-12-12',date:'2025-12-12',liters:1000},{id:'oil-fill-2026-09-21',date:'2026-09-21',liters:500}];
const OIL_HOTWATER_ASSUMPTION=2.55;
const OIL_NOT_REHEATED_THROUGH='2026-10-13';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=(n,d=0)=>n==null||!Number.isFinite(n)?'—':new Intl.NumberFormat('fr-BE',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
const parseDate=s=>new Date(s+'T12:00:00'); const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const days=(a,b)=>(parseDate(b)-parseDate(a))/86400000;
const label=s=>parseDate(s).toLocaleDateString('fr-BE',{day:'2-digit',month:'short',year:'numeric'});
const monthLabel=s=>parseDate(s).toLocaleDateString('fr-BE',{month:'short',year:'2-digit'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function init(){
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(KEY))}catch{}
 const hasData=saved&&Array.isArray(saved.readings);
 const readings=hasData?saved.readings:SEED.map(r=>({...r}));
 const events=hasData&&Array.isArray(saved.events)?saved.events:DEFAULT_EVENTS.map(r=>({...r}));
 let oilReadings=hasData&&Array.isArray(saved.oilReadings)?saved.oilReadings.map(r=>({...r})):DEFAULT_OIL_READINGS.map(r=>({...r}));
 let oilDeliveries=hasData&&Array.isArray(saved.oilDeliveries)?saved.oilDeliveries.map(r=>({...r})):DEFAULT_OIL_DELIVERIES.map(r=>({...r}));
 let changed=false;
 const entry=oilReadings.find(r=>r.id==='oil-2025-12-12'&&r.date==='2025-12-12');
 if(entry&&Number(entry.liters)===1000){entry.liters=0;changed=true}
 if(entry&&Number(entry.liters)===0&&!oilDeliveries.some(d=>d.date==='2025-12-12'&&Number(d.liters)===1000)){
  oilDeliveries.push({...DEFAULT_OIL_DELIVERIES[0]});changed=true;
 }
 const value={readings,events,oilReadings,oilDeliveries,oilStopDate:hasData&&saved.oilStopDate||'2026-03-01'};
 if(changed){try{localStorage.setItem(KEY,JSON.stringify({...saved,...value}))}catch{}}
 return value;
}
let db=init(),chartMode='network',electricBarMode='net',oilChartMode='usage',pendingPhotos={},pendingImage=null;
const newestSavedDate=db.readings.map(r=>r.date).filter(Boolean).sort().at(-1)||'2026-10-07';
let granularity='month',periodPreset='rolling',calendarYear=Number(newestSavedDate.slice(0,4));
const sorted=()=>[...db.readings].sort((a,b)=>a.date.localeCompare(b.date));
const vals=k=>sorted().filter(r=>Number.isFinite(r[k])).map(r=>({date:r.date,value:r[k]}));
const net=()=>sorted().filter(r=>Number.isFinite(r.day)&&Number.isFinite(r.night)).map(r=>({date:r.date,value:r.day+r.night}));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch(e){toast('Stockage insuffisant. Exporte tes données.');return false}};
const meterList={network:net,pv:()=>vals('pv'),water:()=>vals('water')};
function at(series,date,kind='linear'){if(!series.length)return null;const exact=series.find(r=>r.date===date);if(exact)return exact.value;if(date<series[0].date||date>series.at(-1).date)return null;let i=series.findIndex(r=>r.date>date);if(i<1)return null;const a=series[i-1],b=series[i];const useKind=kind==='network'&&b.value<a.value?'pv':kind;const den=integral(a.date,b.date,useKind);const numer=integral(a.date,date,useKind);return a.value+(b.value-a.value)*(den?numer/den:days(a.date,date)/days(a.date,b.date))}
function seasonWeight(date,kind){const m=parseDate(date).getMonth();if(kind==='pv')return [0.40,.53,.90,1.14,1.41,1.55,1.57,1.40,1.12,.76,.45,.32][m];
 if(kind==='home')return [1.42,1.34,1.32,1.13,.85,.73,.72,.77,.93,1.15,1.39,1.48][m];if(kind==='network')return [1.6,1.48,1.25,.85,.58,.42,.44,.56,.81,1.15,1.52,1.66][m];if(kind==='water')return [0.82,.82,.88,.95,1.03,1.15,1.35,1.3,1.03,.95,.85,.82][m];return 1}
function integral(a,b,kind){let sum=0,d=parseDate(a),end=parseDate(b);while(d<end){sum+=seasonWeight(dateISO(d),kind);d.setDate(d.getDate()+1)}return sum}
function poolEventsBetween(a,b){return db.events.filter(e=>e.amount>0&&e.date>a&&e.date<=b)}
function waterAt(date){const data=vals('water');if(!data.length)return null;const exact=data.find(r=>r.date===date);if(exact)return exact.value;if(date<data[0].date||date>data.at(-1).date)return null;const i=data.findIndex(r=>r.date>date),a=data[i-1],b=data[i],special=poolEventsBetween(a.date,b.date),added=special.reduce((t,e)=>t+e.amount,0);const normal=Math.max(0,b.value-a.value-added);const share=integral(a.date,date,'water')/integral(a.date,b.date,'water');const pool=special.filter(e=>e.date<=date).reduce((t,e)=>t+e.amount,0);return a.value+normal*share+pool}
function pvAt(date){
 const production=vals('pv');if(!production.length)return null;
 const exact=production.find(p=>p.date===date);if(exact)return exact.value;
 if(date<production[0].date||date>production.at(-1).date)return null;
 const i=production.findIndex(p=>p.date>date),a=production[i-1],b=production[i];
 const grid=net(),n0=at(grid,a.date,'network'),n1=at(grid,b.date,'network'),nt=at(grid,date,'network');
 if(n0==null||n1==null||nt==null)return at(production,date,'pv');
 const totalHouse=(b.value-a.value)+(n1-n0);
 if(totalHouse<0)return at(production,date,'pv');
 const den=integral(a.date,b.date,'home');
 if(!den)return at(production,date,'pv');
 const fraction=integral(a.date,date,'home')/den;
 const pv=a.value+totalHouse*fraction-(nt-n0);
 // Preserve genuine production readings; never fabricate a falling production index.
 if(pv<a.value-0.01||pv>b.value+0.01)return at(production,date,'pv');
 return pv;
}
function readingAt(kind,date){
 if(kind==='water')return waterAt(date);
 if(kind==='pv')return pvAt(date);
 return at(meterList[kind](),date,kind);
}
function netSince(a,b){const x=readingAt('network',a),y=readingAt('network',b);return x==null||y==null?null:y-x}
function latest(){return sorted().at(-1)}
function monthEnds(){const last=latest()?.date;if(!last)return[];let d=new Date('2025-12-31T12:00:00');const end=parseDate(last);let arr=[];while(d<end){arr.push(dateISO(d));d=new Date(d.getFullYear(),d.getMonth()+2,0,12)}arr.push(last);return arr}
function monthly(){const dates=['2025-12-12',...monthEnds()],out=[];for(let i=1;i<dates.length;i++){const a=dates[i-1],b=dates[i];const n=netSince(a,b),pv0=readingAt('pv',a),pv1=readingAt('pv',b),w0=readingAt('water',a),w1=readingAt('water',b),events=poolEventsBetween(a,b),pool=events.reduce((s,e)=>s+e.amount,0);out.push({date:b,a,net:n,pv:pv0!=null&&pv1!=null?pv1-pv0:null,water:w0!=null&&w1!=null?w1-w0:null,pool,exact:['network','pv','water'].every(k=>meterList[k]().some(v=>v.date===b))})}return out}
function show(page){document.body.dataset.section=page;$$('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+page));$$('[data-go]').forEach(el=>el.classList.toggle('active',el.dataset.go===page));const names={accueil:"Vue d'ensemble",electricite:'Électricité',solaire:'Photovoltaïque',eau:'Consommation d’eau',mazout:'Mazout',releves:'Mes relevés',analyses:'Analyses détaillées',reglages:'Réglages'};$('#page-title').textContent=names[page];history.replaceState(null,'','#'+page);window.scrollTo(0,0);render()}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
$$('[data-go][role="button"]').forEach(b=>b.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();show(b.dataset.go)}
}));
function nextMonthEnd(){const now=new Date();return new Date(now.getFullYear(),now.getMonth()+1,0)}
function render(){syncPeriodControls();const n=net(),pv=vals('pv'),w=vals('water'),reference=n.find(r=>r.date===REFERENCE),lastNet=n.at(-1),balance=reference&&lastNet?lastNet.value-reference.value:null;
$('#balance-value').textContent=balance==null?'—':fmt(Math.abs(balance))+' kWh';$('#balance-value').classList.toggle('negative',balance>0);$('#balance-status').textContent=balance==null?'Sans référence':balance<0?'d’avance sur le bilan annuel':balance>0?'au-dessus de la référence':'à l’équilibre';$('#balance-date').textContent='Dernier relevé : '+(lastNet?label(lastNet.date):'—');
$('#recent-trend').textContent=lastNet?fmt(lastNet.value)+' kWh':'—';$('#trend-label').textContent='Total jour + nuit';$('#trend-duration').textContent=lastNet?'Relevé du '+label(lastNet.date):'Aucun relevé';
const pvDelta=pv.length>1?pv.at(-1).value-pv[0].value:null;const netDelta=n.length>1?n.at(-1).value-n[0].value:null;const house=pvDelta!=null&&netDelta!=null?pvDelta+netDelta:null;const waterDelta=w.length>1?w.at(-1).value-w[0].value:null;
$('#pv-produced').innerHTML=fmt(pvDelta)+' <span class="unit">kWh</span>';$('#home-consumption').innerHTML=fmt(house)+' <span class="unit">kWh</span>';$('#water-consumed').innerHTML=fmt(waterDelta,2)+' <span class="unit">m³</span>';
const waterCaption=$('#home-water-caption');if(waterCaption)waterCaption.textContent='Depuis l’entrée';
renderChart('balance-chart','network',REFERENCE);renderHistory();renderAnalysis();renderEvents();renderCategoryPages();renderOil()}
function renderHistory(){
 const base=sorted(),oilLevels=oilReadings(),oilFills=oilDeliveries();
 const byDay=new Map(base.map(r=>[r.date,r]));
 const dates=[...new Set([...base.map(r=>r.date),...oilLevels.map(r=>r.date),...oilFills.map(r=>r.date)])].sort().reverse();
 const number=k=>k==null?'<span class="muted">—</span>':fmt(k);
 $('#history-table').innerHTML=dates.map(date=>{
  const r=byDay.get(date),levels=oilLevels.filter(x=>x.date===date),fills=oilFills.filter(x=>x.date===date);
  const oilBits=[
   ...levels.map(x=>'<span class="history-oil-index">'+fmt(x.liters)+' L'+(fills.length?'<small>'+(x.phase==='after'?'après':'avant')+'</small>':'')+'</span>'),
   ...fills.map(x=>'<span class="history-oil-fill">+'+fmt(x.liters)+' L<small>livraison</small></span>')
  ];
  const oilHtml=oilBits.length?'<button type="button" class="history-oil-button" data-history-oil="'+date+'" aria-label="Voir les détails du mazout du '+label(date)+'">'+oilBits.join('')+'</button>':'<span class="muted">—</span>';
  const actions=(r?'<button class="mini-btn" title="Modifier les index" data-edit="'+date+'">✎</button><button class="mini-btn danger" title="Supprimer les index" data-delete="'+date+'">×</button>':'')+
   (oilBits.length?'<button class="mini-btn oil-history-open" title="Voir le mazout" data-history-oil="'+date+'">↗</button>':'');
  return '<tr'+(!r&&oilBits.length?' class="history-oil-row"':'')+'><td>'+label(date)+'</td>'+
   '<td>'+number(r?.day)+'</td><td>'+number(r?.night)+'</td>'+
   '<td>'+(r?.day!=null&&r?.night!=null?fmt(r.day+r.night):'<span class="muted">—</span>')+'</td>'+
   '<td>'+number(r?.pv)+'</td>'+
   '<td>'+(r?.water==null?'<span class="muted">—</span>':fmt(r.water,2))+'</td>'+
   '<td class="history-oil-cell">'+oilHtml+'</td>'+
   '<td><div class="row-actions">'+actions+'</div></td></tr>';
 }).join('');
}

function chartSeries(kind,start){const data=meterList[kind]();if(!data.length)return[];const from=start||data[0].date,base=readingAt(kind,from);if(base==null)return[];const dates=[from,...monthEnds().filter(d=>d>from&&d<=data.at(-1).date),data.at(-1).date,...data.filter(r=>r.date>=from).map(r=>r.date)];return [...new Set(dates)].sort().map(d=>({date:d,value:readingAt(kind,d)-base,exact:data.some(r=>r.date===d)})).filter(p=>p.value!=null)}

/* A single time frame is shared by electricity, solar production, water and detailed analyses. */
function addMonths(ym,step){
 const [year,month]=ym.split('-').map(Number);
 const d=new Date(year,month-1+step,1,12);
 return dateISO(d).slice(0,7);
}
function monthEnd(ym){const [y,m]=ym.split('-').map(Number);return dateISO(new Date(y,m,0,12))}
function latestMeterDate(){return sorted().at(-1)?.date||'2026-10-07'}
function periodRange(){
 if(periodPreset==='calendar')return {start:calendarYear+'-01-01',end:calendarYear+'-12-31',heading:String(calendarYear)};
 const latest=latestMeterDate();
 const from=addMonths(latest.slice(0,7),-11);
 return {start:from+'-01',end:latest,heading:'Dernière année'};
}
function periodWindows(){
 const r=periodRange(),months=[];
 for(let ym=r.start.slice(0,7);ym<=r.end.slice(0,7);ym=addMonths(ym,1)){
  const [y,m]=ym.split('-').map(Number);
  months.push({start:dateISO(new Date(y,m-1,0,12)),end:monthEnd(ym),
   label:parseDate(ym+'-01').toLocaleDateString('fr-BE',{month:'short'}),
   shortDate:parseDate(ym+'-01').toLocaleDateString('fr-BE',{month:'short',year:'2-digit'})});
 }
 if(granularity==='month')return months;
 if(granularity==='half'){
  const result=[];
  for(let k=0;k<months.length;k+=6){
   const first=months[k],last=months[Math.min(k+5,months.length-1)];
   result.push({start:first.start,end:last.end,label:first.label+'–'+last.label,detail:first.shortDate+' – '+last.shortDate});
  }
  return result;
 }
 const first=months[0],last=months.at(-1);
 return first&&last?[{start:first.start,end:last.end,label:periodPreset==='calendar'?String(calendarYear):'12 mois',detail:periodRange().heading}]:[];
}

function seriesDomain(kind){
 if(kind==='house'){
  const n=net(),pv=vals('pv');
  return n.length&&pv.length?{start: n[0].date>pv[0].date?n[0].date:pv[0].date,
   end:n.at(-1).date<pv.at(-1).date?n.at(-1).date:pv.at(-1).date}:null;
 }
 const data=meterList[kind]?.();
 return data?.length?{start:data[0].date,end:data.at(-1).date}:null;
}
function readKind(kind,date){
 if(kind==='house'){
  const n=readingAt('network',date),pv=readingAt('pv',date);
  return n==null||pv==null?null:n+pv;
 }
 return readingAt(kind,date);
}
function exactKind(kind,date){
 if(kind==='house')return net().some(r=>r.date===date)&&vals('pv').some(r=>r.date===date);
 return meterList[kind]().some(r=>r.date===date);
}
function deltaWindow(kind,win){
 const domain=seriesDomain(kind);if(!domain)return {value:null,measured:false,start:null,end:null};
 const start=win.start>domain.start?win.start:domain.start;
 const end=win.end<domain.end?win.end:domain.end;
 if(start>=end)return {value:null,measured:false,start,end};
 const v0=readKind(kind,start),v1=readKind(kind,end);
 return {value:v0==null||v1==null?null:v1-v0,measured:exactKind(kind,start)&&exactKind(kind,end),start,end};
}
function periodBuckets(){
 return periodWindows().map(win=>{
  const n=deltaWindow('network',win),p=deltaWindow('pv',win),w=deltaWindow('water',win),house=deltaWindow('house',win);
  const pool=w.value!=null?poolEventsBetween(w.start,w.end).reduce((total,e)=>total+e.amount,0):0;
  return {...win,date:win.end,net:n.value,pv:p.value,water:w.value,house:house.value,pool,
   measured:{net:n.measured,pv:p.measured,water:w.measured,house:house.measured},
   partial:[n,p,w].some(v=>v.value!=null&&(v.start>win.start||v.end<win.end))};
 });
}
function cumulativePoints(kind,start){
 const domain=seriesDomain(kind);if(!domain)return[];
 const range=periodRange(),earliest=[range.start,domain.start,start].sort().at(-1),latest=[range.end,domain.end].sort()[0];
 const base=readKind(kind,start);
 if(earliest>=latest||base==null)return[];
 const dates=new Set([earliest,latest]);
 for(const win of periodWindows()){
  if(win.end>=earliest&&win.end<=latest)dates.add(win.end);
  if(win.start>=earliest&&win.start<=latest)dates.add(win.start);
 }
 const originals=kind==='house'?[...net(),...vals('pv')]:meterList[kind]();
 for(const r of originals)if(r.date>=earliest&&r.date<=latest)dates.add(r.date);
 return [...dates].sort().map(date=>({date,value:readKind(kind,date)-base,exact:exactKind(kind,date)}))
  .filter(p=>Number.isFinite(p.value));
}
function syncPeriodControls(){
 const r=periodRange();
 $$('[data-granularity]').forEach(b=>b.classList.toggle('active',b.dataset.granularity===granularity));
 $$('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===periodPreset));
 $$('.period-switch').forEach(group=>group.classList.remove('hidden'));
 $$('.period-navigation').forEach(group=>group.classList.toggle('hidden',periodPreset!=='calendar'));
 $$('.period-navigation-label').forEach(el=>el.textContent=r.heading);
 $$('[data-period-nav="next"]').forEach(btn=>{
  btn.disabled=periodPreset==='calendar'&&calendarYear>=Number(latestMeterDate().slice(0,4));
 });
 $$('[data-period-nav="prev"]').forEach(btn=>{
  btn.disabled=periodPreset==='calendar'&&calendarYear<=Number(sorted()[0]?.date?.slice(0,4)||2025);
 });
}

// Lock viewport scale (pinch, Safari gesture events and rapid double tap)
// while keeping ordinary single-finger scrolling and all form interactions.
const stopZoom=e=>{if(e.cancelable)e.preventDefault()};
for(const event of ['gesturestart','gesturechange','gestureend'])document.addEventListener(event,stopZoom,{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches?.length>1)stopZoom(e)},{passive:false});
let lastTouchTime=0,lastTouchX=0,lastTouchY=0;
document.addEventListener('touchend',e=>{
 if(e.touches?.length||e.changedTouches?.length!==1)return;
 const t=e.changedTouches[0],now=Date.now();
 if(now-lastTouchTime<340&&Math.hypot(t.clientX-lastTouchX,t.clientY-lastTouchY)<30)stopZoom(e);
 lastTouchTime=now;lastTouchX=t.clientX;lastTouchY=t.clientY;
},{passive:false});
document.addEventListener('dblclick',stopZoom,{passive:false});
window.addEventListener('wheel',e=>{if(e.ctrlKey)stopZoom(e)},{passive:false});
window.addEventListener('keydown',e=>{
 const zoomKey=['+','=','-','_','0','Add','Subtract'].includes(e.key)||['NumpadAdd','NumpadSubtract','Numpad0'].includes(e.code);
 if((e.ctrlKey||e.metaKey)&&zoomKey)stopZoom(e);
},{capture:true});
let latestLayoutWidth=window.innerWidth||0;
window.addEventListener('resize',()=>{
 const width=window.innerWidth||0;
 if(Math.abs(width-latestLayoutWidth)<3)return;
 latestLayoutWidth=width;
 if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(()=>render());
 else render();
});
$$('[data-granularity]').forEach(button=>button.addEventListener('click',()=>{
 granularity=button.dataset.granularity;render();
}));
$$('[data-period]').forEach(button=>button.addEventListener('click',()=>{
 periodPreset=button.dataset.period;render();
}));
$$('[data-period-nav]').forEach(button=>button.addEventListener('click',()=>{
 const change=button.dataset.periodNav==='prev'?-1:1;
 calendarYear+=change;
 render();
}));

function renderChart(id,kind,start){const el=$('#'+id);if(!el)return;let points=cumulativePoints(kind,start);
if(points.length<2){el.innerHTML='<div class="empty-state">Données insuffisantes pour ce graphique.</div>';return}
const rawWidth=el.clientWidth||((window.innerWidth||390)-60),w=Math.max(235,Math.round(rawWidth)),h=326,p={left:w<475?38:60,right:w<475?7:14,top:24,bottom:38},ys=points.map(a=>a.value),min=Math.min(0,...ys),max=Math.max(0,...ys),spread=Math.max(1,max-min),low=min-spread*.09,high=max+spread*.12;const x0=parseDate(points[0].date).getTime(),x1=parseDate(points.at(-1).date).getTime(),X=d=>p.left+(parseDate(d).getTime()-x0)/Math.max(1,x1-x0)*(w-p.left-p.right),Y=v=>p.top+(high-v)/(high-low)*(h-p.top-p.bottom);
const yTicks=Array.from({length:5},(_,i)=>low+(high-low)*i/4);const axis=yTicks.map(v=>'<line class="chart-grid" x1="'+p.left+'" x2="'+(w-p.right)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text class="chart-axis" text-anchor="end" x="'+(p.left-10)+'" y="'+(Y(v)+4)+'">'+fmt(v,0)+'</text>').join('');
const major=points.filter((v,i)=>i===0||i===points.length-1||v.date.endsWith('-31')||v.date.endsWith('-30')||v.date.endsWith('-28')).filter((v,i)=>i===0||i===points.length-1||i%2===0).filter((v,i,arr)=>w>=475||i===0||i===arr.length-1||i%3===0);const xlabels=major.map(v=>'<text class="chart-axis" text-anchor="middle" x="'+X(v.date)+'" y="'+(h-8)+'">'+monthLabel(v.date)+'</text>').join('');
const segs=points.slice(1).map((v,i)=>'<path class="'+((v.exact&&points[i].exact)?'chart-real':'chart-estimated')+'" d="M'+X(points[i].date)+','+Y(points[i].value)+' L'+X(v.date)+','+Y(v.value)+'"/>').join('');
const d='M'+points.map(v=>X(v.date)+','+Y(v.value)).join(' L');const area='<path class="chart-area" d="'+d+' L'+X(points.at(-1).date)+','+Y(0)+' L'+X(points[0].date)+','+Y(0)+' Z"/>';
const circles=points.filter(r=>r.exact).map(v=>'<circle class="chart-point" cx="'+X(v.date)+'" cy="'+Y(v.value)+'" r="4" data-tip="'+esc(label(v.date)+' : '+fmt(v.value,kind==='water'?2:0)+' '+(kind==='water'?'m³':'kWh'))+'"/>').join('');
el.innerHTML='<div class="chart-wrapper"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Évolution '+esc(kind)+'"><defs><clipPath id="clip-'+id+'"><rect x="'+p.left+'" y="'+p.top+'" width="'+(w-p.left-p.right)+'" height="'+(h-p.top-p.bottom)+'"/></clipPath></defs>'+axis+'<line class="chart-zero" x1="'+p.left+'" x2="'+(w-p.right)+'" y1="'+Y(0)+'" y2="'+Y(0)+'"/><g clip-path="url(#clip-'+id+')">'+area+segs+circles+'</g>'+xlabels+'</svg><div class="chart-tooltip hidden"></div></div>';el.querySelectorAll('[data-tip]').forEach(dot=>{dot.addEventListener('pointerenter',()=>{const t=el.querySelector('.chart-tooltip');t.textContent=dot.dataset.tip;t.classList.remove('hidden');t.style.left=Math.min(75,100*Number(dot.getAttribute('cx'))/w)+'%';t.style.top=Math.max(0,100*Number(dot.getAttribute('cy'))/h-16)+'%'});dot.addEventListener('pointerleave',()=>el.querySelector('.chart-tooltip').classList.add('hidden'))})}
function renderAnalysis(){
 const scale=granularity==='month'?'mensuelle':granularity==='half'?'semestrielle':'annuelle';
 const titles={
  network:['AVEC PV','Solde cumulé du réseau','Index jour + nuit, référence 24/03/2026'],
  pv:['PHOTOVOLTAÏQUE','Production cumulée','Production photovoltaïque depuis le 12/12/2025'],
  water:['SWDE','Eau cumulée','Lecture du compteur d’eau depuis le 12/12/2025'],
  house:['CONSOMMATION','Électricité du logement','Production photovoltaïque + bilan du réseau']
 };
 const [over,title,sub]=titles[chartMode];
 $('#analysis-overline').textContent=over+' · VUE '+(granularity==='month'?'MENSUELLE':granularity==='half'?'6 MOIS':'ANNUELLE');
 $('#analysis-title').textContent=title;
 $('#analysis-detail-title').textContent=granularity==='month'?'Détail des mois':granularity==='half'?'Détail par semestre':'Bilan annuel';
 $('#analysis-subtitle').textContent=sub;
 renderChart('analysis-chart',chartMode,chartMode==='network'?REFERENCE:'2025-12-12');
 $$('.analysis-tab').forEach(x=>x.classList.toggle('active',x.dataset.chart===chartMode));
 const data=periodBuckets();
 $('#monthly-body').innerHTML=data.map(r=>'<tr><td>'+esc(r.label)+(r.partial?' *':'')+'</td>'+
  '<td>'+(r.net==null?'—':(r.net>0?'+':'')+fmt(r.net))+'</td>'+
  '<td>'+fmt(r.pv)+'</td><td>'+fmt(r.water,2)+'</td></tr>').join('');
 const matching=chartMode==='network'?net():chartMode==='house'?net():vals(chartMode);
 $('#analysis-summary').innerHTML='<div class="summary-item"><span>Échelle</span><strong>'+esc(scale)+'</strong></div>'+
 '<div class="summary-item"><span>Premier index mesuré</span><strong>'+label(matching[0]?.date||'2025-12-12')+'</strong></div>'+
 '<div class="summary-item"><span>Dernier index mesuré</span><strong>'+label(matching.at(-1)?.date||'2025-12-12')+'</strong></div>';
}


/* Mazout: dated stock snapshots, fill-ups and an explicitly provisional seasonal model. */
const oilMillis=s=>Date.parse(s+'T12:00:00Z');
const oilDays=(start,end)=>Math.round((oilMillis(end)-oilMillis(start))/86400000);
function oilAddDays(date,days){return new Date(oilMillis(date)+days*86400000).toISOString().slice(0,10)}
function oilHeatingWeight(date){
 if(date>='2025-12-12'&&date<(db.oilStopDate||'2026-03-01')){
  if(date>='2026-02-21')return .23;
  if(date>='2026-02-15')return .88;
  const month=Number(date.slice(5,7));
  return month===1?1.23:month===2?1.08:1;
 }
 return 0;
}
function oilReadings(){return [...db.oilReadings].filter(r=>r&&r.date&&Number.isFinite(+r.liters)&&+r.liters>=0).map(r=>({...r,liters:Number(r.liters),phase:r.phase==='after'?'after':'before'})).sort((a,b)=>a.date.localeCompare(b.date)||(a.phase==='before'?-1:1))}
function oilDeliveries(){return [...db.oilDeliveries].filter(r=>r&&r.date&&Number.isFinite(+r.liters)&&+r.liters>0).map(r=>({...r,liters:Number(r.liters)})).sort((a,b)=>a.date.localeCompare(b.date))}
function oilAnchors(){
 const actual=oilReadings(),deliveries=oilDeliveries(),derived=[];
 for(const date of new Set(deliveries.map(d=>d.date))){
  const before=actual.findLast(r=>r.date===date&&r.phase==='before'),after=actual.some(r=>r.date===date&&r.phase==='after');
  if(before&&!after){
   const filled=deliveries.filter(d=>d.date===date).reduce((total,d)=>total+d.liters,0);
   derived.push({id:'derived-'+date,date,liters:before.liters+filled,phase:'after',derived:true});
  }
 }
 return [...actual,...derived].sort((a,b)=>a.date.localeCompare(b.date)||(a.phase==='before'?-1:1));
}
function oilDeliveryInSegment(prev,next){
 const ord=p=>p.phase==='after'?2:0;
 return oilDeliveries().filter(del=>
  (del.date>prev.date||(del.date===prev.date&&1>ord(prev)))&&
  (del.date<next.date||(del.date===next.date&&1<ord(next)))
 ).reduce((sum,d)=>sum+d.liters,0)
}
function oilModel(){
 const anchors=oilAnchors(),spans=[],daily=new Map();
 for(let i=1;i<anchors.length;i++){
  const from=anchors[i-1],to=anchors[i],ndays=oilDays(from.date,to.date);
  const filled=oilDeliveryInSegment(from,to);
  const consumed=from.liters+filled-to.liters;
  if(consumed<-.001)continue;
  if(ndays<=0){spans.push({from,to,consumed:Math.max(0,consumed),days:0,delivered:filled});continue}
  const weight=[],dates=[];
  for(let day=0;day<ndays;day++){const d=oilAddDays(from.date,day);dates.push(d);weight.push(oilHeatingWeight(d))}
  const hotwater=Math.min(OIL_HOTWATER_ASSUMPTION,consumed/ndays);
  const heatTotal=Math.max(0,consumed-hotwater*ndays),weightTotal=weight.reduce((a,b)=>a+b,0);
  for(let day=0;day<ndays;day++){
   const portion=weightTotal>0?heatTotal*weight[day]/weightTotal:heatTotal/ndays;
   daily.set(dates[day],{hotwater:hotwater+(weightTotal?0:heatTotal/ndays),heating:weightTotal?portion:0,total:hotwater+portion+(weightTotal?0:heatTotal/ndays)});
  }
  spans.push({from,to,consumed,days:ndays,delivered:filled});
 }
 const consumed=spans.reduce((total,p)=>total+p.consumed,0),delivered=oilDeliveries().reduce((total,d)=>total+d.liters,0);
 return {anchors,spans,daily,consumed,delivered};
}
function oilDailySum(daily,from,to){
 let total=0,days=0;for(let date=from;date<to;date=oilAddDays(date,1)){
  const info=daily.get(date);if(info){total+=info.total;days++}
 }
 return {liters:total,days,perDay:days?total/days:0}
}
function oilInitialPeriod(model){
 const first=model.anchors[0]?.date,stop=db.oilStopDate||'2026-03-01',end='2026-09-21';
 if(!first||first>=stop)return null;
 return {heated:oilDailySum(model.daily,first,stop),off:oilDailySum(model.daily,stop,end)};
}
function oilLastKnown(model){
 return model.anchors.at(-1)||null;
}
function oilForecast(model){
 const last=oilLastKnown(model),cap=OIL_NOT_REHEATED_THROUGH;
 if(!last||last.date>cap)return null;
 // This projection assumes no central heating or additional deliveries after the dated fill-up.
 if(last.date!=='2026-09-21'||last.phase!=='after')return null;
 const elapsed=oilDays(last.date,cap);
 return {date:cap,liters:Math.max(0,last.liters-OIL_HOTWATER_ASSUMPTION*elapsed),elapsed};
}
function oilPlot(model){
 const anchors=model.anchors,points=[];
 if(!anchors.length)return points;
 for(const [i,a] of anchors.entries()){
  if(i>0&&a.date>anchors[i-1].date){
   const previous=anchors[i-1];let level=previous.liters;
   for(let day=previous.date;day<a.date;day=oilAddDays(day,1)){
    const current=model.daily.get(day);if(current)level-=current.total;
    const newDate=oilAddDays(day,1);
    const refill=oilDeliveries().filter(d=>d.date===newDate&&(newDate<a.date||a.phase==='after')).reduce((sum,d)=>sum+d.liters,0);
    if(refill>0){
     points.push({date:newDate,liters:level,kind:'model'});
     level+=refill;
     points.push({date:newDate,liters:level,kind:'derived'});
    }else if(newDate<a.date&&(newDate.endsWith('-01')||newDate.endsWith('-15'))){
     points.push({date:newDate,liters:level,kind:'model'});
    }
   }
  }
  points.push({date:a.date,liters:a.liters,kind:a.derived?'derived':'measured',phase:a.phase});
 }
 const proj=oilForecast(model);if(proj)points.push({...proj,kind:'projection'});
 return points;
}

function oilUsageTotals(model){
 const totals={heating:0,hotwater:0};
 for(const value of model.daily.values()){
  totals.heating+=Number(value.heating)||0;
  totals.hotwater+=Number(value.hotwater)||0;
 }
 return totals;
}
function renderOilUsage(model){
 const target=$('#oil-usage-chart');if(!target)return;
 const daily=model.daily,anchors=model.anchors;
 if(!daily.size||anchors.length<2){
  target.innerHTML='<div class="empty-state">Ajoute au moins deux relevés de cuve pour comparer les consommations.</div>';
  $('#oil-usage-detail').textContent='Relevés insuffisants pour séparer les usages.';
  return;
 }
 const first=anchors[0].date,last=[...daily.keys()].sort().at(-1);
 const end=oilAddDays(last,1),points=[{date:first,heat:0,water:0}];
 let heating=0,hotwater=0,date=first;
 while(date<end){
  const dailyUse=daily.get(date);
  if(dailyUse){heating+=dailyUse.heating||0;hotwater+=dailyUse.hotwater||0}
  date=oilAddDays(date,1);
  points.push({date,heat:heating,water:hotwater});
 }
 const measuredWidth=target.clientWidth||window.innerWidth-60,W=Math.max(260,Math.round(measuredWidth)),H=272;
 const p={l:W<390?35:50,r:W<390?9:15,t:21,b:49},max=Math.ceil(Math.max(1,heating,hotwater)*1.15/200)*200;
 const X=day=>p.l+(oilMillis(day)-oilMillis(first))/Math.max(1,oilMillis(end)-oilMillis(first))*(W-p.l-p.r);
 const Y=l=>p.t+(max-l)/max*(H-p.t-p.b);
 const grids=[0,1,2,3,4].map(i=>{
  const value=max*i/4,y=Y(value);
  return '<line x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#ecf0f0"/>'+
   '<text class="oil-axis-label" text-anchor="end" x="'+(p.l-6)+'" y="'+(y+3).toFixed(1)+'">'+fmt(value)+'</text>';
 }).join('');
 const series=(key,color)=>'<path class="oil-usage-line '+color+'" d="'+points.map((r,i)=>(i?'L':'M')+X(r.date).toFixed(1)+' '+Y(r[key]).toFixed(1)).join(' ')+'"/>';
 const stop=db.oilStopDate||'2026-03-01',stopX=X(stop);
 const stopMarker=stop>first&&stop<end?'<line x1="'+stopX.toFixed(1)+'" y1="'+p.t+'" x2="'+stopX.toFixed(1)+'" y2="'+(H-p.b)+'" stroke="#d7c6b2" stroke-dasharray="3 5"/><text class="oil-stop-label" text-anchor="middle" x="'+stopX.toFixed(1)+'" y="'+(p.t+11)+'">Arrêt chauffe ≈</text>':'';
 const tickDates=[{date:first,label:'Déc. 25'},{date:'2026-02-15',label:'Fév. 26'},{date:'2026-04-01',label:'Avr.'},{date:'2026-06-01',label:'Juin'},{date:end,label:'Sept. 26'}]
  .filter((r,i,a)=>r.date>=first&&r.date<=end);
 const ticks=tickDates.map(t=>'<text class="oil-date-label" text-anchor="'+(t.date===first?'start':t.date===end?'end':'middle')+'" x="'+X(t.date).toFixed(1)+'" y="'+(H-15)+'">'+t.label+'</text>').join('');
 const markers='<circle class="oil-usage-end heat" cx="'+X(end).toFixed(1)+'" cy="'+Y(heating).toFixed(1)+'" r="4"/><circle class="oil-usage-end hotwater" cx="'+X(end).toFixed(1)+'" cy="'+Y(hotwater).toFixed(1)+'" r="4"/>';
 target.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Consommations cumulées en litres : chauffage central et eau chaude du 12 décembre 2025 au 21 septembre 2026">'+
  '<text class="oil-axis-label" x="'+p.l+'" y="12">L</text>'+grids+stopMarker+
  series('heat','heat')+series('water','hotwater')+markers+ticks+'</svg>';
 const cumulative=heating+hotwater;
 $('#oil-usage-detail').innerHTML='<strong>≈ '+fmt(Math.round(heating/10)*10)+' L</strong> chauffage + '+
  '<strong>≈ '+fmt(Math.round(hotwater/10)*10)+' L</strong> eau chaude · <b>'+fmt(model.consumed)+' L consommés</b> d’après les relevés';
}
function syncOilChartView(){
 const byUse=oilChartMode==='usage';
 $('#oil-usage-view').classList.toggle('hidden',!byUse);
 $('#oil-level-view').classList.toggle('hidden',byUse);
 $$('[data-oil-chart]').forEach(btn=>btn.classList.toggle('active',btn.dataset.oilChart===oilChartMode));
 $('#oil-chart-overline').textContent=byUse?'CONSOMMATION · LITRES':'NIVEAU DE CUVE · LITRES';
 $('#oil-chart-title').textContent=byUse?'Chauffage & eau chaude':'Évolution de la réserve';
 $('#oil-chart-description').textContent=byUse?'Deux courbes cumulées, réparties entre tes relevés.':'Points pleins : relevés · Sauts verts : livraisons.';
}
$$('[data-oil-chart]').forEach(btn=>btn.addEventListener('click',()=>{
 oilChartMode=btn.dataset.oilChart;
 syncOilChartView();
 const model=oilModel();
 if(oilChartMode==='usage')renderOilUsage(model);else renderOilTimeline(model);
}));
function renderOilTimeline(model){
 const el=$('#oil-timeline');if(!el)return;
 const data=oilPlot(model);if(data.length<2){el.innerHTML='<div class="empty-state">Ajoute au moins deux niveaux de cuve.</div>';return}
 const actualWidth=el.clientWidth||window.innerWidth-65,W=Math.max(265,Math.round(actualWidth)),H=263;
 const margins={l:W<400?37:52,r:W<400?10:18,t:19,b:46};
 const first=data[0].date,last=data.at(-1).date,lo=0,hi=Math.ceil(Math.max(1050,...data.map(d=>d.liters))*1.08/250)*250;
 const X=date=>margins.l+(oilMillis(date)-oilMillis(first))/Math.max(1,oilMillis(last)-oilMillis(first))*(W-margins.l-margins.r);
 const Y=volume=>margins.t+(hi-volume)/hi*(H-margins.t-margins.b);
 const grid=[0,250,500,750,1000].filter(v=>v<=hi).map(v=>'<line x1="'+margins.l+'" x2="'+(W-margins.r)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="#e7edf0"/><text x="'+(margins.l-7)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" class="oil-axis-label">'+fmt(v)+'</text>').join('');
 let paths='';
 for(let i=1;i<data.length;i++){
  const before=data[i-1],current=data[i],sameDay=before.date===current.date;
  const type=sameDay?'delivery':current.kind==='projection'?'projection':'consumption';
  paths+='<path d="M'+X(before.date).toFixed(1)+' '+Y(before.liters).toFixed(1)+' L'+X(current.date).toFixed(1)+' '+Y(current.liters).toFixed(1)+'" class="oil-path '+type+'"/>';
 }
 const spots=data.filter(d=>['measured','derived','projection'].includes(d.kind)).map(d=>{
  const x=X(d.date),y=Y(d.liters),rad=d.kind==='measured'?5:4;
  return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+rad+'" class="oil-spot '+d.kind+'"><title>'+esc(label(d.date)+' : '+fmt(d.liters,0)+' L '+(d.kind==='measured'?'relevés':d.kind==='projection'?'projection':'après livraison'))+'</title></circle>';
 }).join('');
 const ticks=[{date:data[0].date,label:'Déc. 25'},{date:'2026-02-15',label:'Fév. 26'},{date:'2026-09-21',label:'Sept. 26'}]
 .filter(t=>t.date>=first&&t.date<=last).map(t=>'<text text-anchor="middle" x="'+X(t.date).toFixed(1)+'" y="'+(H-14)+'" class="oil-date-label">'+t.label+'</text>').join('');
 const fill=oilDeliveries().filter(d=>d.date>=first&&d.date<=last).map(d=>{
  const x=X(d.date),anchor=data.findLast(a=>a.date===d.date&&(a.kind==='derived'||a.phase==='after'));
  return anchor?'<text text-anchor="'+(d.date===first?'start':'end')+'" x="'+(d.date===first?x+7:x-3).toFixed(1)+'" y="'+(Y(anchor.liters)-13).toFixed(1)+'" class="oil-fill-label">+'+fmt(d.liters)+' L</text>':'';
 }).join('');
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Historique des niveaux de mazout et livraison">'+
  '<text x="'+margins.l+'" y="11" class="oil-axis-label">L</text>'+grid+paths+spots+fill+ticks+'</svg>';
 const lastMeasured=oilReadings().at(-1),lastFill=oilDeliveries().at(-1);
 $('#oil-timeline-detail').textContent=oilDeliveries().length?
  oilDeliveries().map(d=>label(d.date)+' : +'+fmt(d.liters)+' L').join(' · ')+' · niveaux intermédiaires calculés':
  'Points pleins : relevés enregistrés. Niveaux intermédiaires calculés.';
}
function renderOil(){
 const model=oilModel(),last=oilLastKnown(model),forecast=oilForecast(model),period=oilInitialPeriod(model);
 const output=(id,value)=>{const node=$('#'+id);if(node)node.textContent=value};
 output('oil-home-level',last?'≈ '+fmt(last.liters)+' L':'—');
 output('oil-level-after',last?'≈ '+fmt(last.liters)+' L':'—');
 output('oil-last-date',last?label(last.date)+' · '+(last.derived?'après livraison · niveau actuel non mesuré':'dernier relevé de cuve'):'Niveau inconnu');
 output('oil-level-label',last?.derived?'Niveau après livraison (non remesuré)':'Dernier niveau mesuré');
 output('oil-used',fmt(model.consumed)+' L');
 output('oil-delivered','+'+fmt(model.delivered)+' L');
 const usage=oilUsageTotals(model);
 const usageTotal=Math.max(1,usage.heating+usage.hotwater);
 output('oil-heat-used',model.daily.size?'≈ '+fmt(Math.round(usage.heating/10)*10)+' L':'—');
 output('oil-hotwater-used',model.daily.size?'≈ '+fmt(Math.round(usage.hotwater/10)*10)+' L':'—');
 output('oil-heat-range',model.daily.size?'Jusqu’au '+label(db.oilStopDate||'2026-03-01'):'Pas assez de données');
 output('oil-hotwater-range',model.daily.size?'Toute la période · environ 3 adultes':'Pas assez de données');
 output('oil-heat-rate',model.daily.size?'≈ '+fmt(usage.heating/usageTotal*100,0)+' % du mazout consommé':'');
 output('oil-hotwater-rate',model.daily.size?'≈ '+fmt(usage.hotwater/usageTotal*100,0)+' % du mazout consommé':'');
 $('#oil-heat-fill').style.width=(100*usage.heating/usageTotal).toFixed(2)+'%';
 $('#oil-hotwater-fill').style.width=(100*usage.hotwater/usageTotal).toFixed(2)+'%';
 output('oil-estimated-remaining',forecast?'≈ '+fmt(Math.round(forecast.liters/10)*10)+' L':'—');
 output('oil-estimated-date',forecast?'Estimation au '+label(forecast.date):'Pas d’estimation après le dernier relevé');
 const oilDate=$('#oil-home-date');if(oilDate)oilDate.textContent=last?'Au '+label(last.date)+(last.derived?' · après livraison':' · relevé de cuve'):'Aucun relevé';
 const stop=$('#oil-stop-date');if(stop)stop.value=db.oilStopDate||'2026-03-01';
 syncOilChartView();
 renderOilUsage(model);
 renderOilTimeline(model);
 const allEntries=[...oilReadings().map(r=>({...r,kind:'reading'})),...oilDeliveries().map(r=>({...r,kind:'delivery'}))]
  .sort((a,b)=>b.date.localeCompare(a.date)||(a.kind==='delivery'?-1:1));
 $('#oil-history').innerHTML=allEntries.map(r=>'<div class="oil-entry">'+
  '<div class="oil-entry-date">'+label(r.date)+'</div><div class="oil-entry-icon '+(r.kind==='delivery'?'fill':'')+'">'+(r.kind==='delivery'?'↑':'●')+'</div>'+
  '<div class="oil-entry-detail"><strong>'+(r.kind==='delivery'?'Livraison de mazout':'Niveau de cuve')+'</strong><small>'+(
   r.kind==='delivery'?'Remplissage':r.phase==='before'&&oilDeliveries().some(d=>d.date===r.date)?'Avant livraison':'Relevé effectué')+'</small></div>'+
  '<strong class="oil-entry-value">'+(r.kind==='delivery'?'+':'')+fmt(r.liters)+' L</strong>'+
  '<div class="oil-entry-actions"><button type="button" class="mini-btn" data-oil-edit="'+esc(r.id)+'" data-oil-kind="'+r.kind+'" title="Modifier">✎</button><button type="button" class="mini-btn danger" data-oil-remove="'+esc(r.id)+'" data-oil-kind="'+r.kind+'" title="Supprimer">×</button></div></div>').join('')||'<p class="empty-state">Aucune mesure.</p>';
}

function renderCategoryPages(){
 const n=net(),p=vals('pv'),water=vals('water');
 const reference=n.find(r=>r.date===REFERENCE),last=n.at(-1);
 const delta=reference&&last?last.value-reference.value:null;
 const production=p.length>1?p.at(-1).value-p[0].value:null;
 const wdelta=water.length>1?water.at(-1).value-water[0].value:null;
 const set=(id,value)=>{const el=$('#'+id);if(el)el.textContent=value};
 set('elec-metric-balance',delta==null?'—':fmt(Math.abs(delta))+' kWh');
 set('elec-index-reference',reference?fmt(reference.value)+' kWh':'—');
 set('elec-index-current',last?fmt(last.value)+' kWh':'—');
 set('elec-index-current-label',last?'Index du '+label(last.date):'Dernier index');
 set('pv-metric-total',production==null?'—':fmt(production)+' kWh');
 set('water-metric-total',wdelta==null?'—':fmt(wdelta,2)+' m³');
 set('pv-last-date',p.length?'Relevé du '+label(p.at(-1).date):'Aucun relevé');
 set('water-last-date',water.length?'Relevé du '+label(water.at(-1).date):'Aucun relevé');
 set('elec-credit-explain',delta==null?'Pas de relevé de référence':delta<0?"d’avance grâce aux PV":delta>0?'de consommation nette au-delà de la référence':'Compteur à l’équilibre');
 const scale=granularity==='month'?'par mois':granularity==='half'?'par semestre':'annuel';
 const withPV=electricBarMode==='net';
 $('#electric-bar-title').textContent=withPV?'Bilan du réseau '+scale:'Consommation du logement '+scale;
 $('#electric-bar-overline').textContent=withPV?'AVEC PV · KWH':'SANS EFFET PV · KWH';
 $('#electric-bar-description').textContent=withPV?'Surplus net ou prélèvement net du réseau.':'L’énergie consommée par la maison, quelle que soit son origine.';
 $('#page-solaire .bar-panel h2').textContent='Production '+scale;
 $('#page-eau .bar-panel h2').textContent='Consommation '+scale;
 drawMonthlyBars('monthly-electricity-chart',electricBarMode);
 drawMonthlyBars('monthly-pv-chart','pv');
 drawMonthlyBars('monthly-water-chart','water');
}
function drawMonthlyBars(id,kind){
 const el=$('#'+id);if(!el)return;
 const entries=periodBuckets(),known=entries.filter(e=>Number.isFinite(e[kind]));
 el.classList.toggle('compact-period',granularity!=='month');
 if(!known.length){el.innerHTML='<div class="no-chart-data">Pas de mesures disponibles pour cette période.</div>';return}
 // A compact but true-to-scale SVG: all 12 calendar slots must fit on the phone.
 const measuredWidth=el.clientWidth||el.getBoundingClientRect?.().width||0;
 const viewport=window.innerWidth||390;
 const W=Math.max(230,Math.round(measuredWidth||(viewport<=750?viewport-63:viewport-375)));
 const narrow=W<475,H=316,L=narrow?37:58,R=narrow?7:17,T=24,B=45;
 const plotH=H-T-B,step=(W-L-R)/entries.length;
 const barW=granularity==='month'?Math.max(9,Math.min(narrow?20:42,step*.67)):
   granularity==='half'?Math.min(116,step*.39):Math.min(155,step*.46);
 const vals=known.map(r=>r[kind]),bottom=Math.min(0,...vals),top=Math.max(0,...vals);
 const hi=Math.max(1,top>0?top*1.15:0),lo=bottom<0?bottom*1.15:0;
 const Y=v=>T+(hi-v)/(hi-lo)*plotH,Y0=Y(0);
 const monthAbbr=['Ja','Fé','Mr','Av','Ma','Jn','Jl','Ao','Se','Oc','No','Dé'];
 const labelMarkup=(r,center)=>{
  const y=H-19,full=esc(r.label);
  if(granularity!=='month')return '<text class="bar-x-label" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+full+'</text>';
  const month=Number(r.date.slice(5,7)),short=esc(monthAbbr[month-1]||r.label);
  return '<text class="bar-x-label bar-x-full" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+full+'</text>'+
   '<text class="bar-x-label bar-x-short" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+short+'</text>';
 };
 const formatTick=v=>narrow&&Math.abs(v)>=1000?fmt(v/1000,1)+'k':fmt(v,kind==='water'&&Math.abs(v)<100?1:0);
 const ticks=Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4).map(v=>{
  const y=Y(v);
  return '<line class="monthly-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>'+
   '<text class="bar-y-label" text-anchor="end" x="'+(L-(narrow?4:9))+'" y="'+(y+3.5).toFixed(1)+'">'+formatTick(v)+'</text>';
 }).join('');
 const barGroups=entries.map((r,i)=>{
  const x=L+(i+.5)*step-barW/2,center=x+barW/2,v=r[kind];
  const readable=(r.detail||r.label)+(v==null?' : aucune donnée':' : '+fmt(v,kind==='water'?2:0)+' '+(kind==='water'?'m³':'kWh'));
  const prefix='<g tabindex="0" role="button" data-bar="'+i+'" aria-label="'+esc(readable)+'">';
  if(v==null)return prefix+'<line x1="'+(center-4).toFixed(1)+'" x2="'+(center+4).toFixed(1)+'" y1="'+(Y0+2).toFixed(1)+'" y2="'+(Y0+2).toFixed(1)+'" stroke="#c8d5dc" stroke-width="2" stroke-linecap="round"/>'+labelMarkup(r,center)+'</g>';
  const measured=r.measured?.[kind],border=measured?'none':'#ffffff8a';
  let rects='';
  if(kind==='water'){
    const pool=Math.max(0,Math.min(v,r.pool)),domestic=Math.max(0,v-pool);
    const yHome=Y(domestic),yTotal=Y(v);
    if(domestic>0)rects+='<rect class="monthly-bar" x="'+x.toFixed(1)+'" y="'+yHome.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(1,Y0-yHome).toFixed(1)+'" rx="'+Math.min(4,barW/4).toFixed(1)+'" fill="#5b95be" stroke="'+border+'" stroke-width="0.4"/>';
    if(pool>0)rects+='<rect class="monthly-bar" x="'+x.toFixed(1)+'" y="'+yTotal.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(1,yHome-yTotal).toFixed(1)+'" rx="'+Math.min(4,barW/4).toFixed(1)+'" fill="#e6b166" stroke="'+border+'" stroke-width="0.4"/>';
  }else{
    const fill=kind==='net'?(v<=0?'#269a80':'#d68c79'):kind==='pv'?'#299d82':'#d58c4e';
    const y=Math.min(Y0,Y(v)),height=Math.max(1,Math.abs(Y(v)-Y0));
    rects='<rect class="monthly-bar" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+height.toFixed(1)+'" rx="'+Math.min(4,barW/4).toFixed(1)+'" fill="'+fill+'" stroke="'+border+'" stroke-width="0.4"/>';
  }
  const marker=measured?'':'<circle cx="'+center.toFixed(1)+'" cy="'+(H-5)+'" r="'+(narrow?'1.3':'2')+'" fill="#bdcbd2"/>';
  return prefix+rects+'<rect class="monthly-tap" x="'+(L+i*step).toFixed(1)+'" y="'+T+'" width="'+step.toFixed(1)+'" height="'+plotH.toFixed(1)+'"/>'+
   labelMarkup(r,center)+marker+'</g>';
 }).join('');
 const unit=kind==='water'?'m³':'kWh',period=periodRange().heading;
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="group" aria-label="'+esc(period)+', histogramme de '+esc(kind)+'">'+
  '<text class="bar-axis-unit" x="'+L+'" y="12">'+unit+'</text>'+ticks+
  '<line class="monthly-zero" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y0.toFixed(1)+'" y2="'+Y0.toFixed(1)+'"/>'+
  barGroups+'</svg><div class="bar-selection" aria-live="polite"></div>';
 const out=el.querySelector('.bar-selection');
 const select=index=>{
  const r=entries[index],v=r[kind],partialNote=r.partial?' · période partielle':'';
  if(v==null)out.innerHTML='<strong>'+esc(r.label)+'</strong> : aucun relevé couvrant cette période';
  else if(kind==='water'){
   out.innerHTML='<strong>'+esc(r.label)+'</strong> : '+fmt(v,2)+' m³'+partialNote;
  }else{
   out.innerHTML='<strong>'+esc(r.label)+'</strong> : ≈ '+(kind==='house'?'':v>0?'+':'')+fmt(v)+' '+unit+
    (kind==='net'?(v<0?' · avance gagnée':v>0?' · avance consommée':' · stable'):'')+partialNote;
  }
  el.querySelectorAll('[data-bar]').forEach((bar,i)=>bar.querySelectorAll('.monthly-bar').forEach(rect=>rect.classList.toggle('monthly-selected',i===index)));
 };
 el.querySelectorAll('[data-bar]').forEach((bar,i)=>{
  bar.addEventListener('click',()=>select(i));
  bar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i)}});
 });
 select(entries.findLastIndex(r=>r[kind]!=null));
}

$$('[data-electric-bar]').forEach(button=>button.addEventListener('click',()=>{
 electricBarMode=button.dataset.electricBar;
 $$('[data-electric-bar]').forEach(b=>b.classList.toggle('active',b.dataset.electricBar===electricBarMode));
 const withPV=electricBarMode==='net';
 $('#electric-net-legend').classList.toggle('hidden',!withPV);
 $('#electric-house-legend').classList.toggle('hidden',withPV);
 $('#electric-house-note').classList.toggle('hidden',withPV);
 $('#page-electricite').classList.toggle('view-house',!withPV);
 $('#electric-net-chart-toggle').classList.toggle('hidden',!withPV);
 if(!withPV){
  $('#elec-view-mensuel').classList.remove('hidden');
  $('#elec-view-bilan').classList.add('hidden');
  $$('[data-elec-view]').forEach(b=>b.classList.toggle('active',b.dataset.elecView==='mensuel'));
 }
 renderCategoryPages();
}));
$$('[data-elec-view]').forEach(button=>button.addEventListener('click',()=>{
 const mode=button.dataset.elecView;
 $$('.view-toggle-btn').forEach(el=>el.classList.toggle('active',el.dataset.elecView===mode));
 $('#elec-view-mensuel').classList.toggle('hidden',mode!=='mensuel');
 $('#elec-view-bilan').classList.toggle('hidden',mode!=='bilan');
 // Measure and draw only after the chosen graph has its full container width.
 if(mode==='bilan')renderChart('balance-chart','network',REFERENCE);
 else drawMonthlyBars('monthly-electricity-chart',electricBarMode);
}));

/* A mazout reading is occasional: keep it separate from the monthly four-meter form. */
function openOilEntry(kind='reading',entry=null){
 const form=$('#oil-form');form.reset();
 $('#oil-entry-id').value=entry?.id||'';
 $('#oil-entry-kind').value=kind;
 $('#oil-entry-date').value=entry?.date||today();
 $('#oil-entry-amount').value=entry?.liters??'';
 $('#oil-entry-phase').value=entry?.phase==='after'?'after':'before';
 $('#oil-entry-title').textContent=entry?'Modifier '+(kind==='delivery'?'une livraison':'un relevé'):'Ajouter '+(kind==='delivery'?'une livraison':'un relevé');
 syncOilForm();modal('oil-overlay');
}
function syncOilForm(){
 const reading=$('#oil-entry-kind').value==='reading';
 $('#oil-entry-phase-wrap').classList.toggle('hidden',!reading);
 $('#oil-entry-amount-label').textContent=reading?'Niveau de cuve (L)':'Quantité livrée (L)';
}
$('#add-oil-entry').onclick=()=>openOilEntry();
$('#oil-entry-kind').onchange=syncOilForm;
$('#oil-form').onsubmit=e=>{
 e.preventDefault();
 const id=$('#oil-entry-id').value,kind=$('#oil-entry-kind').value,date=$('#oil-entry-date').value,liters=Number($('#oil-entry-amount').value);
 if(!date||!Number.isFinite(liters)||liters<0||kind==='delivery'&&liters===0)return toast('Renseigne la date et une quantité valide.');
 const collection=kind==='delivery'?'oilDeliveries':'oilReadings';
 const original=id?db[collection].find(x=>x.id===id):null;
 const entry={id:id||'oil-entry-'+Date.now(),date,liters};
 if(kind==='reading')entry.phase=$('#oil-entry-phase').value;
 if(id){
  // The entry kind cannot be changed implicitly when editing. Explicitly move it instead.
  db.oilReadings=db.oilReadings.filter(x=>x.id!==id);
  db.oilDeliveries=db.oilDeliveries.filter(x=>x.id!==id);
 }
 db[collection].push(entry);
 if(save()){modal('oil-overlay',false);render();toast(kind==='reading'?'Niveau de cuve enregistré':'Livraison enregistrée')}
 else{
  db[collection]=db[collection].filter(x=>x.id!==entry.id);
  if(original)db[collection].push(original);
 }
};
$('#oil-history').addEventListener('click',e=>{
 const edit=e.target.closest('[data-oil-edit]'),del=e.target.closest('[data-oil-remove]');
 if(edit){
  const type=edit.dataset.oilKind,list=type==='delivery'?db.oilDeliveries:db.oilReadings;
  const entry=list.find(x=>x.id===edit.dataset.oilEdit);
  if(entry)openOilEntry(type,entry);
 }
 if(del){
  const type=del.dataset.oilKind,list=type==='delivery'?'oilDeliveries':'oilReadings';
  if(confirm('Supprimer '+(type==='delivery'?'cette livraison':'ce niveau de cuve')+' ?')){
   db[list]=db[list].filter(x=>x.id!==del.dataset.oilRemove);
   save();render();toast('Élément supprimé');
  }
 }
});
$('#oil-stop-date').onchange=value=>{
 const date=typeof value==='string'?value:$('#oil-stop-date').value;
 db.oilStopDate=date;
 save();render();
};

function renderEvents(){$('#special-events').innerHTML=db.events.map(e=>'<div class="event-row"><div><strong>'+esc(e.label)+'</strong><p>'+ (e.approx?'Juillet 2026 · date indicative':label(e.date))+'</p></div><div><b>'+fmt(e.amount,2)+' m³</b><button class="mini-btn danger" title="Supprimer" data-remove-event="'+esc(e.id)+'">×</button></div></div>').join('')}
$$('.analysis-tab').forEach(b=>b.addEventListener('click',()=>{chartMode=b.dataset.chart;renderAnalysis()}));
function modal(id,on=true){$('#'+id).classList.toggle('hidden',!on)}
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>modal(b.dataset.close,false)));
$$('.modal-overlay').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)modal(b.id,false)}));
const today=()=>dateISO(new Date());
function openReading(r){$('#reading-form').reset();$('#reading-id').value=r?.date||'';$('#reading-date').value=r?.date||today();for(const k of ['day','night','pv','water'])$('#reading-'+k).value=r?.[k]??'';pendingPhotos=r?.photos?{...r.photos}:{};photoFlags();$('#reading-heading').textContent=r?'Modifier le relevé':'Nouveau relevé';modal('reading-overlay')}
function photoFlags(){$('#photo-flags').innerHTML=Object.keys(pendingPhotos).map(k=>'<span class="photo-flag">Photo '+esc(({day:'jour',night:'nuit',pv:'PV',water:'eau'})[k])+'</span>').join('')}
$('#new-reading').onclick=()=>openReading();
$('#reading-form').onsubmit=e=>{e.preventDefault();const date=$('#reading-date').value,id=$('#reading-id').value,r={date};let count=0;for(const k of ['day','night','pv','water']){const value=$('#reading-'+k).value;if(value.trim()!==''){r[k]=Number(value);count++}}if(!count)return toast('Renseigne au moins un index.');if((r.day==null)!==(r.night==null))return toast('Pour le bilan réseau, renseigne jour et nuit ensemble.');if(Object.keys(pendingPhotos).length)r.photos=pendingPhotos;if(db.readings.some(v=>v.date===date&&v.date!==id))return toast('Un relevé existe déjà à cette date.');db.readings=db.readings.filter(v=>v.date!==id);db.readings.push(r);if(!id){calendarYear=Number(date.slice(0,4));}if(!save()){db.readings=db.readings.filter(v=>v.date!==date);if(id)db.readings.push(sorted().find(v=>v.date===id));return}modal('reading-overlay',false);render();toast('Relevé enregistré')};
$('#history-table').addEventListener('click',e=>{const oil=e.target.closest('[data-history-oil]'),edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(oil){show('mazout');return}if(edit)openReading(db.readings.find(r=>r.date===edit.dataset.edit));if(del&&confirm('Supprimer les index du '+label(del.dataset.delete)+' ?')){db.readings=db.readings.filter(r=>r.date!==del.dataset.delete);save();render()}});
const exportBlob=(content,type,name)=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)};
$('#export-data').onclick=()=>exportBlob(JSON.stringify({version:1,exportedAt:new Date().toISOString(),...db},null,2),'application/json','flux-sauvegarde-'+today()+'.json');
$('#export-csv').onclick=()=>{
 const originals=sorted(),oil=oilReadings(),fills=oilDeliveries(),byDay=new Map(originals.map(r=>[r.date,r]));
 const allDates=[...new Set([...originals.map(r=>r.date),...oil.map(r=>r.date),...fills.map(r=>r.date)])].sort();
 const rows=allDates.map(date=>{
  const other=byDay.get(date),tank=oil.filter(r=>r.date===date).sort((a,b)=>a.phase==='before'?-1:1);
  const delivery=fills.filter(r=>r.date===date).reduce((sum,r)=>sum+r.liters,0);
  return [date,other?.day??'',other?.night??'',other?.pv??'',other?.water??'',tank.map(x=>x.liters).join('/'),delivery||''].join(';');
 });
 exportBlob('\ufeffdate;jour_kwh;nuit_kwh;production_kwh;eau_m3;mazout_niveau_L;livraison_mazout_L\n'+rows.join('\n'),'text/csv','flux-releves-'+today()+'.csv');
};
$('#import-data').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.readings)||!d.readings.every(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)))throw Error('Fichier incorrect');if(confirm('Remplacer tous les relevés de cet appareil par ceux du fichier ?')){db={readings:d.readings,events:Array.isArray(d.events)?d.events:[],oilReadings:Array.isArray(d.oilReadings)?d.oilReadings.map(r=>({...r})):DEFAULT_OIL_READINGS.map(r=>({...r})),oilDeliveries:Array.isArray(d.oilDeliveries)?d.oilDeliveries.map(r=>({...r})):DEFAULT_OIL_DELIVERIES.map(r=>({...r})),oilStopDate:d.oilStopDate||'2026-03-01'};const initial=db.oilReadings.find(r=>r.id==='oil-2025-12-12'&&r.date==='2025-12-12');if(initial&&Number(initial.liters)===1000)initial.liters=0;if(initial&&Number(initial.liters)===0&&!db.oilDeliveries.some(x=>x.date==='2025-12-12'&&Number(x.liters)===1000))db.oilDeliveries.push({...DEFAULT_OIL_DELIVERIES[0]});save();render();toast('Import terminé')}}catch(err){toast('Fichier JSON invalide')}e.target.value=''};
$('#new-event').onclick=()=>{$('#event-form').reset();$('#event-date').value=today();modal('event-overlay')};
$('#event-form').onsubmit=e=>{e.preventDefault();db.events.push({id:String(Date.now()),date:$('#event-date').value,label:$('#event-label').value,amount:Number($('#event-amount').value)});save();modal('event-overlay',false);render()};
$('#special-events').addEventListener('click',e=>{const b=e.target.closest('[data-remove-event]');if(b&&confirm('Supprimer cet événement ?')){db.events=db.events.filter(v=>v.id!==b.dataset.removeEvent);save();render()}});
$('#calendar-reminder').onclick=()=>{const now=new Date(),first=new Date(now.getFullYear(),now.getMonth()+1,0);let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Flux Energie//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];for(let m=0;m<24;m++){const d=new Date(first.getFullYear(),first.getMonth()+m+1,0),ds=dateISO(d).replace(/-/g,'');lines.push('BEGIN:VEVENT','UID:flux-'+ds+'@energie','DTSTART;VALUE=DATE:'+ds,'DTEND;VALUE=DATE:'+dateISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)).replace(/-/g,''),'SUMMARY:Relever les compteurs - Flux','DESCRIPTION:Electricite jour et nuit, panneaux photovoltaïques et eau.','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Releve des compteurs','TRIGGER:-PT9H','END:VALARM','END:VEVENT')}lines.push('END:VCALENDAR');exportBlob(lines.join('\r\n'),'text/calendar','flux-rappels-mensuels.ics');toast('Calendrier des 24 prochains mois créé')};
let to=null;function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(to);to=setTimeout(()=>el.classList.remove('show'),3000)}
$('#scan-in-form').onclick=()=>$('#scan-file').click();
$('#scan-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;pendingImage=await imageData(f);$('#scan-preview').src=pendingImage;$('#scan-value').value='';$('#scan-meter').value='day';$('#scan-message').textContent='Analyse de l’image…';modal('scan-overlay');if('TextDetector' in window){try{const detector=new TextDetector(),bitmap=await createImageBitmap(f),parts=await detector.detect(bitmap),text=parts.map(p=>p.rawValue).join(' '),numbers=text.match(/\d{3,}(?:[.,]\d{1,3})?/g)||[];if(numbers.length){$('#scan-value').value=Number(numbers.sort((a,b)=>b.length-a.length)[0].replace(',','.'));$('#scan-message').textContent='Lecture proposée. Vérifie le type et tous les chiffres avant validation.'}else $('#scan-message').textContent='Chiffres non détectés : saisis l’index visible sur la photo.'}catch{$('#scan-message').textContent='Lecture indisponible sur ce navigateur : saisis manuellement l’index.'}}else{$('#scan-message').textContent='OCR non pris en charge sur ce navigateur. Photo conservée : vérifie et saisis l’index.'}e.target.value=''};
function imageData(f){return new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(f)})}
$('#confirm-scan').onclick=()=>{const k=$('#scan-meter').value,v=$('#scan-value').value;if(v.trim()===''||!Number.isFinite(Number(v)))return toast('Valide un index numérique.');$('#reading-'+k).value=v;pendingPhotos[k]=pendingImage;photoFlags();modal('scan-overlay',false);modal('reading-overlay',true);toast('Photo et index prêts pour validation')};
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(['accueil','electricite','solaire','eau','mazout','releves','analyses','reglages'].includes(p))show(p)});
const firstPage=['accueil','electricite','solaire','eau','mazout','releves','analyses','reglages'].includes(location.hash.slice(1))?location.hash.slice(1):'accueil';show(firstPage);
})();