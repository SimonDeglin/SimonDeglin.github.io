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
// The monohourly index is the source of truth for new data. Old day/night readings remain readable.
const networkTotal=r=>r&&Number.isFinite(r.total)?r.total:r&&Number.isFinite(r.day)&&Number.isFinite(r.night)?r.day+r.night:null;
const net=()=>sorted().map(r=>({date:r.date,value:networkTotal(r)})).filter(r=>r.value!=null);
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

/* Monthly equivalent over the latest 365 days or the shorter observed history.
   Use the overlap of the known dates, never extrapolate future consumption. */
function monthlyAverage(kind){
 const domain=seriesDomain(kind);
 if(!domain)return null;
 const yearAgo=dateISO(new Date(parseDate(domain.end).getTime()-365*86400000));
 const start=domain.start>yearAgo?domain.start:yearAgo,end=domain.end;
 const duration=days(start,end);
 if(duration<10)return null;
 const a=readKind(kind,start),b=readKind(kind,end);
 if(!Number.isFinite(a)||!Number.isFinite(b))return null;
 return {value:(b-a)/duration*(365.2425/12),duration,start,end};
}
function showMonthlyAverage(id,captionId,kind,unit){
 const data=monthlyAverage(kind),el=$('#'+id),cap=$('#'+captionId);
 if(data){
  el.innerHTML=fmt(data.value,unit==='m³'?1:0)+' <span class="unit">'+unit+'</span><span class="monthly-inline">moy./mois</span>';
  if(cap)cap.textContent=data.duration>=360?'12 derniers mois':'sur '+fmt(data.duration/30.437,1)+' mois suivis';
 }else{
  el.innerHTML='— <span class="unit">'+unit+'</span>';
  if(cap)cap.textContent='Données insuffisantes';
 }
}
function niceAxis(minimum,maximum,includeZero=true){
 let min=Number.isFinite(minimum)?minimum:0,max=Number.isFinite(maximum)?maximum:1;
 if(min>max)[min,max]=[max,min];
 if(includeZero){min=Math.min(0,min);max=Math.max(0,max)}
 if(max-min<1e-9){const pad=Math.max(1,Math.abs(max)*.25);min-=includeZero&&min>=0?0:pad;max+=pad;}
 const family=[1,2.5,5,10];
 let magnitude=Math.floor(Math.log10(Math.max(1e-8,(max-min)/5)));
 let axis=null;
 for(let pass=0;pass<20;pass++){
  const candidate=family[pass%4]*Math.pow(10,magnitude+Math.floor(pass/4));
  if(candidate<=0)continue;
  let lo=Math.floor((min+candidate*1e-10)/candidate)*candidate;
  let hi=Math.ceil((max-candidate*1e-10)/candidate)*candidate;
  if(Math.abs(hi-lo)<candidate*.5)hi=lo+candidate;
  const count=Math.round((hi-lo)/candidate)+1;
  if(count<=6){axis={lo:+lo.toFixed(7),hi:+hi.toFixed(7),step:candidate};break;}
 }
 if(!axis){const step=Math.pow(10,magnitude+2);axis={lo:Math.floor(min/step)*step,hi:Math.ceil(max/step)*step,step};}
 const ticks=[];for(let i=0;i<9;i++){const v=axis.lo+i*axis.step;if(v>axis.hi+axis.step*.001)break;ticks.push(Math.abs(v)<axis.step*1e-6?0:+v.toFixed(7))}
 return {...axis,ticks};
}
/* Denser electricity grid: optional 125 kWh bands where they fit legibly. */
function electricAxis(min,max){
 const span=max-min;
 if(Number.isFinite(span)&&span>=250&&span<=1100){
  const step=125,lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step;
  const count=Math.round((hi-lo)/step)+1;
  if(count>=4&&count<=10){
   return {lo,hi,step,ticks:Array.from({length:count},(_,i)=>lo+i*step)};
  }
 }
 return niceAxis(min,max);
}
const axisLabel=(v,compact=false)=>compact&&Math.abs(v)>=1000?
 fmt(v/1000,Math.abs(v)%1000===0?0:Math.abs(v)%500===0?1:2)+'k':fmt(v,Number.isInteger(v)?0:1);

function render(){syncPeriodControls();syncCompactControls();const nextDate=$('#next-reading-date');if(nextDate)nextDate.textContent=label(dateISO(nextMonthEnd()));const n=net(),pv=vals('pv'),w=vals('water'),reference=n.find(r=>r.date===REFERENCE),lastNet=n.at(-1),balance=reference&&lastNet?lastNet.value-reference.value:null;
$('#balance-value').textContent=balance==null?'—':fmt(Math.abs(balance))+' kWh';$('#balance-value').classList.toggle('negative',balance>0);$('#balance-status').textContent=balance==null?'Sans référence':balance<0?'d’avance sur le bilan annuel':balance>0?'au-dessus de la référence':'à l’équilibre';$('#balance-date').textContent='Dernier relevé : '+(lastNet?label(lastNet.date):'—');
$('#recent-trend').textContent=lastNet?fmt(lastNet.value)+' kWh':'—';$('#trend-label').textContent='Total jour + nuit';$('#trend-duration').textContent=lastNet?'Relevé du '+label(lastNet.date):'Aucun relevé';
showMonthlyAverage('home-consumption','home-electric-caption','house','kWh');
showMonthlyAverage('pv-produced','home-pv-caption','pv','kWh');
showMonthlyAverage('water-consumed','home-water-caption','water','m³');
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
   '<td class="history-network-cell">'+number(networkTotal(r))+'</td>'+
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

function syncCompactControls(){
 $$('select[data-compact]').forEach(el=>{
  const which=el.dataset.compact;
  const value=which==='granularity'?granularity:which==='period'?periodPreset:
   which==='electric-mode'?electricBarMode:
   ($('#elec-view-bilan').classList.contains('hidden')?'mensuel':'bilan');
  if(el.value!==value)el.value=value;
  if(which==='electric-view')el.disabled=electricBarMode==='house';
 });
 $$('.compact-year-controls').forEach(el=>el.classList.toggle('hidden',periodPreset!=='calendar'));
 $$('[data-compact-year]').forEach(el=>el.textContent=String(calendarYear));
 const maxYear=Number(latestMeterDate().slice(0,4));
 const minYear=Number(sorted()[0]?.date?.slice(0,4)||2025);
 $$('[data-compact-nav="next"]').forEach(b=>b.disabled=calendarYear>=maxYear);
 $$('[data-compact-nav="prev"]').forEach(b=>b.disabled=calendarYear<=minYear);
}
$$('select[data-compact]').forEach(el=>el.addEventListener('change',()=>{
 const attr={
  granularity:'data-granularity',period:'data-period',
  'electric-mode':'data-electric-bar','electric-view':'data-elec-view'
 }[el.dataset.compact];
 const button=attr?document.querySelector('['+attr+'="'+el.value+'"]'):null;
 if(button)button.click();
 syncCompactControls();
}));
$$('[data-compact-nav]').forEach(el=>el.addEventListener('click',()=>{
 const btn=$('[data-period-nav="'+el.dataset.compactNav+'"]');
 if(btn&&!btn.disabled)btn.click();
 syncCompactControls();
}));

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
const rawWidth=el.clientWidth||((window.innerWidth||390)-60),w=Math.max(235,Math.round(rawWidth)),h=285,p={left:w<475?40:60,right:w<475?7:14,top:19,bottom:34},ys=points.map(a=>a.value),min=Math.min(0,...ys),max=Math.max(0,...ys),scale=kind==='network'||kind==='house'?electricAxis(min<0?min*1.06:0,max>0?max*1.06:0):niceAxis(min<0?min*1.06:0,max>0?max*1.06:0),low=scale.lo,high=scale.hi;const x0=parseDate(points[0].date).getTime(),x1=parseDate(points.at(-1).date).getTime(),X=d=>p.left+(parseDate(d).getTime()-x0)/Math.max(1,x1-x0)*(w-p.left-p.right),Y=v=>p.top+(high-v)/(high-low)*(h-p.top-p.bottom);
const yTicks=scale.ticks;const axis=yTicks.map(v=>'<line class="chart-grid" x1="'+p.left+'" x2="'+(w-p.right)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text class="chart-axis" text-anchor="end" x="'+(p.left-7)+'" y="'+(Y(v)+4)+'">'+axisLabel(v,w<475)+'</text>').join('');
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
/* Monthly stacked bars: water heating forfait and central heating attributed seasonally.
   Based on oilModel daily reconstructions, NOT additional measurements. */
function renderOilUsage(model){
 const target=$('#oil-usage-chart');if(!target)return;
 const first=model.anchors[0]?.date,lastKnown=model.anchors.at(-1)?.date;
 const forecast=oilForecast(model),end=forecast?.date||lastKnown;
 if(!first||!end||first>=end||!model.daily.size){
  target.innerHTML='<div class="empty-state">Ajoute des relevés pour voir la consommation mensuelle.</div>';return;
 }
 const map=new Map();
 for(let date=first;date<end;date=oilAddDays(date,1)){
  const real=model.daily.get(date),projected=Boolean(forecast&&date>=lastKnown&&date<forecast.date);
  if(!real&&!projected)continue;
  const ym=date.slice(0,7),v=map.get(ym)||{ym,hotwater:0,heating:0,projected:false,days:0};
  v.hotwater+=real?real.hotwater:OIL_HOTWATER_ASSUMPTION;
  v.heating+=real?real.heating:0;
  v.projected=v.projected||projected;v.days++;
  map.set(ym,v);
 }
 const bars=[...map.values()].sort((a,b)=>a.ym.localeCompare(b.ym)).slice(-12);
 if(!bars.length){target.innerHTML='<div class="empty-state">Aucune période disponible.</div>';return}
 const W=Math.max(255,Math.round(target.clientWidth||window.innerWidth-50)),H=266,narrow=W<460;
 const p={l:narrow?37:54,r:narrow?6:15,t:18,b:35},plot=H-p.t-p.b,step=(W-p.l-p.r)/bars.length;
 const bw=Math.min(narrow?20:33,step*.7),peak=Math.max(1,...bars.map(b=>b.hotwater+b.heating));
 const scale=niceAxis(0,peak*1.07);
 const Y=v=>p.t+(scale.hi-v)/(scale.hi-scale.lo)*plot,Y0=Y(0);
 const grid=scale.ticks.map(v=>'<line x1="'+p.l+'" x2="'+(W-p.r)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="#eceee8"/>'+
  '<text class="oil-axis-label" x="'+(p.l-5)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end">'+axisLabel(v,narrow)+'</text>').join('');
 const names=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
 const initials=['J','F','M','A','M','J','J','A','S','O','N','D'];
 const shapes=bars.map((r,i)=>{
  const x=p.l+(i+.5)*step-bw/2,cx=x+bw/2,topWater=Y(r.hotwater),topTotal=Y(r.hotwater+r.heating);
  const month=Number(r.ym.slice(5,7))-1;
  const title=names[month]+' '+r.ym.slice(0,4)+' : '+fmt(r.hotwater+r.heating)+' L dont '+fmt(r.hotwater)+' L eau chaude, '+fmt(r.heating)+' L chauffage';
  return '<g data-oil-month="'+i+'" role="button" tabindex="0" aria-label="'+esc(title)+'">'+
   (r.hotwater>0?'<rect class="oil-month-water" x="'+x+'" y="'+topWater+'" width="'+bw+'" height="'+Math.max(1,Y0-topWater)+'" rx="3" fill="#659bb7"/>':'')+
   (r.heating>0?'<rect class="oil-month-heat" x="'+x+'" y="'+topTotal+'" width="'+bw+'" height="'+Math.max(1,topWater-topTotal)+'" rx="3" fill="#b98659"/>':'')+
   '<rect x="'+(p.l+i*step)+'" y="'+p.t+'" width="'+step+'" height="'+plot+'" fill="transparent"/>'+
   '<text class="oil-date-label" x="'+cx+'" y="'+(H-14)+'" text-anchor="middle">'+initials[month]+'</text>'+
   (r.projected?'<circle cx="'+cx+'" cy="'+(H-5)+'" r="1.7" fill="#b89d7e"/>':'')+'</g>';
 }).join('');
 target.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Consommation de mazout : chauffage brun et eau chaude bleue, par mois">'+
  '<text class="oil-axis-label" x="'+p.l+'" y="11">L</text>'+grid+shapes+'</svg>';
 const detail=$('#oil-usage-detail');
 const select=i=>{
  const r=bars[i],month=parseDate(r.ym+'-01').toLocaleDateString('fr-BE',{month:'long',year:'numeric'});
  detail.innerHTML='<strong>'+esc(month)+'</strong> · '+fmt(r.hotwater+r.heating)+' L : '+
   '<span class="oil-detail-hotwater">'+fmt(r.hotwater)+' L eau chaude</span> + '+
   '<span class="oil-detail-heating">'+fmt(r.heating)+' L chauffage</span>'+
   (r.projected?' · partie estimée':'')+(r.days<27?' · mois partiel':'');
  target.querySelectorAll('[data-oil-month]').forEach((el,j)=>el.classList.toggle('oil-month-selected',i===j));
 };
 target.querySelectorAll('[data-oil-month]').forEach((el,i)=>{
  el.addEventListener('click',()=>select(i));
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i)}});
 });
 select(bars.length-1);
}
function syncOilChartView(){
 $('#oil-level-view').classList.remove('hidden');
 $('#oil-usage-view').classList.remove('hidden');
 $('#oil-chart-overline').textContent='CITERNE · LITRES';
 $('#oil-chart-title').textContent='Évolution du niveau';
 $('#oil-chart-description').textContent='Points de mesure, livraisons et évolution reconstituée.';
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
 const margins={l:W<400?39:52,r:W<400?10:18,t:25,b:46};
 const first=data[0].date,last=data.at(-1).date,highest=Math.max(1250,...data.map(d=>d.liters));
 const hi=Math.ceil(highest/250)*250,scale={lo:0,hi,step:250,ticks:Array.from({length:Math.round(hi/250)+1},(_,i)=>i*250)};
 const X=date=>margins.l+(oilMillis(date)-oilMillis(first))/Math.max(1,oilMillis(last)-oilMillis(first))*(W-margins.l-margins.r);
 const Y=volume=>margins.t+(hi-volume)/hi*(H-margins.t-margins.b);
 const grid=scale.ticks.map(v=>'<line x1="'+margins.l+'" x2="'+(W-margins.r)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" stroke="#e7edf0"/><text x="'+(margins.l-7)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" class="oil-axis-label">'+fmt(v)+'</text>').join('');
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
 const display=forecast?Math.round(forecast.liters/10)*10:last?.liters;
 output('oil-home-level',display==null?'—':'≈ '+fmt(display)+' L');
 output('oil-level-after',display==null?'—':'≈ '+fmt(display)+' L');
 output('oil-last-date',forecast?'Estimation au '+label(forecast.date)+' · dernier niveau relevé le '+label(last.date):last?'Au '+label(last.date)+' · '+(last.derived?'après livraison':'niveau mesuré'):'Niveau inconnu');
 output('oil-level-label',forecast?'Reste estimé dans la citerne':last?.derived?'Niveau après livraison':'Dernier niveau mesuré');
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
 const oilDate=$('#oil-home-date');if(oilDate)oilDate.textContent=forecast?'Est. au '+label(forecast.date):last?'Au '+label(last.date)+(last.derived?' · après livraison':' · relevé'):'Aucun relevé';
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
 syncCompactControls();
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
 const narrow=W<475,H=274,L=narrow?39:58,R=narrow?6:15,T=20,B=35;
 const plotH=H-T-B,step=(W-L-R)/entries.length;
 const barW=granularity==='month'?Math.max(9,Math.min(narrow?20:42,step*.67)):
   granularity==='half'?Math.min(116,step*.39):Math.min(155,step*.46);
 const vals=known.map(r=>r[kind]),bottom=Math.min(0,...vals),top=Math.max(0,...vals);
 const lowBound=bottom<0?bottom*1.06:0,highBound=top>0?top*1.06:0;
 const axis=kind==='water'?{lo:0,hi:30,step:5,ticks:[0,5,10,15,20,25,30]}:
  (kind==='net'||kind==='house'?electricAxis(lowBound,highBound):niceAxis(lowBound,highBound));
 const hi=axis.hi,lo=axis.lo;
 const Y=v=>T+(hi-v)/(hi-lo)*plotH,Y0=Y(0);
 const monthAbbr=['Ja','Fé','Mr','Av','Ma','Jn','Jl','Ao','Se','Oc','No','Dé'];
 const labelMarkup=(r,center)=>{
  const y=H-19,full=esc(r.label);
  if(granularity!=='month')return '<text class="bar-x-label" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+full+'</text>';
  const month=Number(r.date.slice(5,7)),short=esc(monthAbbr[month-1]||r.label);
  return '<text class="bar-x-label bar-x-full" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+full+'</text>'+
   '<text class="bar-x-label bar-x-short" text-anchor="middle" x="'+center.toFixed(1)+'" y="'+y+'">'+short+'</text>';
 };
 const formatTick=v=>axisLabel(v,narrow);
 const ticks=axis.ticks.map(v=>{
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
    // Fixed 0–30 m³ chart. Values beyond 30 show a cap + their real value, not a hidden overflow.
    const shown=Math.min(30,Math.max(0,v)),ratio=v>0?shown/v:1;
    const yHome=Y(domestic*ratio),yTotal=Y(shown);
    if(domestic>0)rects+='<rect class="monthly-bar" x="'+x.toFixed(1)+'" y="'+yHome.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(1,Y0-yHome).toFixed(1)+'" rx="'+Math.min(4,barW/4).toFixed(1)+'" fill="#5b95be" stroke="'+border+'" stroke-width="0.4"/>';
    if(pool>0)rects+='<rect class="monthly-bar" x="'+x.toFixed(1)+'" y="'+yTotal.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(1,yHome-yTotal).toFixed(1)+'" rx="'+Math.min(4,barW/4).toFixed(1)+'" fill="#e6b166" stroke="'+border+'" stroke-width="0.4"/>';
    if(v>30)rects+='<path d="M'+(center-4).toFixed(1)+' '+(T+3)+' L'+center.toFixed(1)+' '+(T-2)+' L'+(center+4).toFixed(1)+' '+(T+3)+'" class="water-overflow-marker"/>'+
      '<text class="water-overflow-value" x="'+center.toFixed(1)+'" y="'+(T-7)+'" text-anchor="middle">'+fmt(v,1)+'</text>';
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
 const overflowInfo=kind==='water'&&known.some(r=>r.water>30)?
  '<div class="water-overflow-note">↑ Valeur supérieure à 30 m³ : barre plafonnée, valeur réelle indiquée.</div>':'';
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="group" aria-label="'+esc(period)+', histogramme de '+esc(kind)+'">'+
  '<text class="bar-axis-unit" x="'+L+'" y="12">'+unit+'</text>'+ticks+
  '<line class="monthly-zero" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y0.toFixed(1)+'" y2="'+Y0.toFixed(1)+'"/>'+
  barGroups+'</svg>'+overflowInfo+'<div class="bar-selection" aria-live="polite"></div>';
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
 syncCompactControls();
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
 const previousOilReadings=[...db.oilReadings],previousOilDeliveries=[...db.oilDeliveries];
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
  db.oilReadings=previousOilReadings;
  db.oilDeliveries=previousOilDeliveries;
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
   const previous=db[list];
   db[list]=db[list].filter(x=>x.id!==del.dataset.oilRemove);
   if(save()){render();toast('Élément supprimé')}else db[list]=previous;
  }
 }
});
$('#oil-stop-date').onchange=value=>{
 const date=typeof value==='string'?value:$('#oil-stop-date').value;
 const previous=db.oilStopDate;db.oilStopDate=date;
 if(save())render();else db.oilStopDate=previous;
};

function renderEvents(){$('#special-events').innerHTML=db.events.map(e=>'<div class="event-row"><div><strong>'+esc(e.label)+'</strong><p>'+ (e.approx?'Juillet 2026 · date indicative':label(e.date))+'</p></div><div><b>'+fmt(e.amount,2)+' m³</b><button class="mini-btn danger" title="Supprimer" data-remove-event="'+esc(e.id)+'">×</button></div></div>').join('')}
$$('.analysis-tab').forEach(b=>b.addEventListener('click',()=>{chartMode=b.dataset.chart;renderAnalysis()}));
function modal(id,on=true){$('#'+id).classList.toggle('hidden',!on)}
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>modal(b.dataset.close,false)));
$$('.modal-overlay').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)modal(b.id,false)}));
const today=()=>dateISO(new Date());
const roundWater=v=>Math.round((Number(v)+Number.EPSILON)*10)/10;
$('#reading-water').addEventListener('change',()=>{
 const field=$('#reading-water');if(field.value!==''&&Number.isFinite(Number(field.value)))field.value=roundWater(field.value).toFixed(1);
});
function openReading(r){
 $('#reading-form').reset();
 $('#reading-id').value=r?.date||'';
 $('#reading-date').value=r?.date||today();
 const total=networkTotal(r);
 $('#reading-total').value=total==null?'':total;
 for(const k of ['pv','water'])$('#reading-'+k).value=r?.[k]==null?'':k==='water'?roundWater(r[k]).toFixed(1):r[k];
 pendingPhotos=r?.photos?{...r.photos}:{};
 photoFlags();
 $('#reading-heading').textContent=r?'Modifier le relevé':'Nouveau relevé';
 modal('reading-overlay');
}
function photoFlags(){
 $('#photo-flags').innerHTML=Object.keys(pendingPhotos).map(k=>'<span class="photo-flag">Photo '+esc(({electric:'électricité',day:'jour',night:'nuit',pv:'PV',water:'eau'})[k]||k)+'</span>').join('');
}
$('#new-reading').onclick=()=>openReading();
$('#reading-form').onsubmit=e=>{
 e.preventDefault();
 const date=$('#reading-date').value,id=$('#reading-id').value,r={date};let count=0;
 for(const k of ['total','pv','water']){
  const value=$('#reading-'+k).value;
  if(value.trim()!==''){
   const numeric=Number(value);
   if(!Number.isFinite(numeric)||numeric<0)return toast('Vérifie les index avant de les enregistrer.');
   if(k!=='water'&&!Number.isInteger(numeric))return toast('Électricité et PV : uniquement des kWh entiers.');
   r[k]=k==='water'?roundWater(numeric):numeric;
   count++;
  }
 }
 if(!count)return toast('Renseigne au moins un index.');
 if(Object.keys(pendingPhotos).length)r.photos={...pendingPhotos};
 if(db.readings.some(v=>v.date===date&&v.date!==id))return toast('Un relevé existe déjà à cette date.');
 const previousReadings=[...db.readings];
 db.readings=db.readings.filter(v=>v.date!==id);
 db.readings.push(r);
 if(!save()){db.readings=previousReadings;return}
 if(!id)calendarYear=Number(date.slice(0,4));
 modal('reading-overlay',false);render();toast('Relevé enregistré');
};
$('#history-table').addEventListener('click',e=>{const oil=e.target.closest('[data-history-oil]'),edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(oil){show('mazout');return}if(edit)openReading(db.readings.find(r=>r.date===edit.dataset.edit));if(del&&confirm('Supprimer les index du '+label(del.dataset.delete)+' ?')){const previous=db.readings;db.readings=db.readings.filter(r=>r.date!==del.dataset.delete);if(save())render();else db.readings=previous}});
const exportBlob=(content,type,name)=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)};
$('#export-data').onclick=()=>exportBlob(JSON.stringify({version:1,exportedAt:new Date().toISOString(),...db},null,2),'application/json','owatt-sauvegarde-'+today()+'.json');
$('#export-csv').onclick=()=>{
 const originals=sorted(),oil=oilReadings(),fills=oilDeliveries(),byDay=new Map(originals.map(r=>[r.date,r]));
 const allDates=[...new Set([...originals.map(r=>r.date),...oil.map(r=>r.date),...fills.map(r=>r.date)])].sort();
 const rows=allDates.map(date=>{
  const other=byDay.get(date),tank=oil.filter(r=>r.date===date).sort((a,b)=>a.phase==='before'?-1:1);
  const delivery=fills.filter(r=>r.date===date).reduce((sum,r)=>sum+r.liters,0);
  return [date,networkTotal(other)??'',other?.pv??'',other?.water??'',tank.map(x=>x.liters).join('/'),delivery||''].join(';');
 });
 exportBlob('\ufeffdate;electricite_monohoraire_kwh;production_kwh;eau_m3;mazout_niveau_L;livraison_mazout_L\n'+rows.join('\n'),'text/csv','owatt-releves-'+today()+'.csv');
};
/* JSON backups are local to one device. Check structural integrity before replacing
   memory; never report success if persisting the restored backup fails. */
function validBackupDate(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(parseDate(value).getTime())&&dateISO(parseDate(value))===value;
}
function validBackupNumber(value){
 return value==null||(typeof value==='number'&&Number.isFinite(value)&&value>=0);
}
function checkBackup(data){
 if(!data||!Array.isArray(data.readings))return false;
 const dates=new Set();
 for(const r of data.readings){
  if(!r||!validBackupDate(r.date)||dates.has(r.date)||
    !['total','day','night','pv','water'].every(k=>validBackupNumber(r[k])))return false;
  dates.add(r.date);
  if(r.photos!=null&&(!r.photos||typeof r.photos!=='object'||Array.isArray(r.photos)||
    Object.values(r.photos).some(v=>typeof v!=='string')))return false;
 }
 for(const k of ['oilReadings','oilDeliveries']){
  if(data[k]!==undefined&&!Array.isArray(data[k]))return false;
  if(Array.isArray(data[k])&&!data[k].every(r=>r&&validBackupDate(r.date)&&
     validBackupNumber(r.liters)&&r.liters!=null&&
     (k!=='oilReadings'||r.phase==null||r.phase==='before'||r.phase==='after')))return false;
 }
 if(data.events!==undefined&&(!Array.isArray(data.events)||
   !data.events.every(e=>e&&validBackupDate(e.date)&&typeof e.label==='string'&&
    validBackupNumber(e.amount)&&e.amount!=null)))return false;
 if(data.oilStopDate!=null&&!validBackupDate(data.oilStopDate))return false;
 return true;
}
$('#import-data').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const d=JSON.parse(await file.text());
  if(!checkBackup(d))throw new Error('Fichier incorrect');
  if(confirm('Remplacer les relevés de cet appareil par ceux de ce fichier ? Pense à exporter une sauvegarde avant.')){
   const previous=db;
   const imported={
    readings:d.readings.map(r=>({...r})),
    events:Array.isArray(d.events)?d.events.map(r=>({...r})):[],
    oilReadings:Array.isArray(d.oilReadings)?d.oilReadings.map(r=>({...r})):DEFAULT_OIL_READINGS.map(r=>({...r})),
    oilDeliveries:Array.isArray(d.oilDeliveries)?d.oilDeliveries.map(r=>({...r})):DEFAULT_OIL_DELIVERIES.map(r=>({...r})),
    oilStopDate:d.oilStopDate||'2026-03-01'
   };
   const first=imported.oilReadings.find(r=>r.id==='oil-2025-12-12'&&r.date==='2025-12-12');
   if(first&&Number(first.liters)===1000)first.liters=0;
   if(first&&Number(first.liters)===0&&!imported.oilDeliveries.some(x=>x.date==='2025-12-12'&&Number(x.liters)===1000))
    imported.oilDeliveries.push({...DEFAULT_OIL_DELIVERIES[0]});
   db=imported;
   if(save()){
    calendarYear=Number(sorted().at(-1)?.date.slice(0,4)||new Date().getFullYear());
    render();toast('Sauvegarde restaurée');
   }else db=previous;
  }
 }catch(err){toast('Fichier JSON invalide ou incomplet')}
 e.target.value='';
};
$('#new-event').onclick=()=>{$('#event-form').reset();$('#event-date').value=today();modal('event-overlay')};
$('#event-form').onsubmit=e=>{e.preventDefault();const entry={id:String(Date.now()),date:$('#event-date').value,label:$('#event-label').value,amount:Number($('#event-amount').value)};if(!entry.date||!entry.label.trim()||!Number.isFinite(entry.amount)||entry.amount<=0)return toast('Vérifie la date et le volume.');const previous=db.events;db.events=[...db.events,entry];if(save()){modal('event-overlay',false);render()}else db.events=previous;};
$('#special-events').addEventListener('click',e=>{const b=e.target.closest('[data-remove-event]');if(b&&confirm('Supprimer cet événement ?')){const previous=db.events;db.events=db.events.filter(v=>v.id!==b.dataset.removeEvent);if(save())render();else db.events=previous}});
$('#calendar-reminder').onclick=()=>{const now=new Date(),first=new Date(now.getFullYear(),now.getMonth()+1,0);let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Owatt Energie//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];for(let m=0;m<24;m++){const d=new Date(first.getFullYear(),first.getMonth()+m+1,0),ds=dateISO(d).replace(/-/g,'');lines.push('BEGIN:VEVENT','UID:owatt-'+ds+'@energie','DTSTART;VALUE=DATE:'+ds,'DTEND;VALUE=DATE:'+dateISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)).replace(/-/g,''),'SUMMARY:Relever les compteurs - Ôwatt','DESCRIPTION:Electricite jour et nuit, panneaux photovoltaïques et eau.','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Releve des compteurs','TRIGGER:PT8H','END:VALARM','END:VEVENT')}lines.push('END:VCALENDAR');exportBlob(lines.join('\r\n'),'text/calendar','owatt-rappels-mensuels.ics');toast('Calendrier des 24 prochains mois créé')};
let to=null;function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(to);to=setTimeout(()=>el.classList.remove('show'),3000)}

/* On-device photo reading. Type is selected BEFORE capture; OCR is never saved without confirmation. */
let scanKind='electric',scanCrop=null,scanBusy=false,scanLastText='',scanLastData=null,scanRequest=0;
let ocrScriptPromise=null,ocrWorkerPromise=null;
$$('[data-scan-kind]').forEach(button=>button.addEventListener('click',()=>{
 scanKind=button.dataset.scanKind;
 $('#scan-file').value='';
 $('#scan-file').click();
}));
function electricInputs(){
 const day=$('#scan-day').value,night=$('#scan-night').value;
 const ok=v=>/^\d{1,7}$/.test(v)&&Number.isSafeInteger(Number(v));
 return ok(day)&&ok(night)?{day:Number(day),night:Number(night),total:Number(day)+Number(night)}:null;
}
function refreshElectricSum(){
 const values=electricInputs();
 $('#scan-total').textContent=values?fmt(values.total)+' kWh':'— kWh';
 const confirm=$('#confirm-scan');
 if(scanKind==='electric')confirm.disabled=!values;
 return values;
}
['scan-day','scan-night'].forEach(k=>$('#'+k).addEventListener('input',refreshElectricSum));
function updateScanHint(){
 const hints={
  electric:'Lune en haut = nuit, soleil en bas = jour. Seuls les chiffres noirs comptent. Encadre les deux lignes si nécessaire.',
  pv:'Itron : six chiffres noirs et un rouge (dixième). Arrondi au kWh. Encadre les chiffres si nécessaire.',
  water:'Eau : chiffres noirs et rouges. Arrondi au dixième de m³.'
 };
 $('#scan-hint').textContent=hints[scanKind]||'';
}
function showScanKind(){
 const electric=scanKind==='electric';
 $('#scan-electric').classList.toggle('hidden',!electric);
 $('#scan-single-field').classList.toggle('hidden',electric);
 $('#scan-overlay').classList.toggle('electric-scan',electric);
 $('#scan-value').step=scanKind==='water'?'0.1':'1';
 $('#confirm-scan').textContent=electric?'Utiliser ce total':'Utiliser cet index';
 updateScanHint();
 if(electric)refreshElectricSum();
 else $('#confirm-scan').disabled=false;
}
$('#scan-meter').onchange=()=>{
 scanKind=$('#scan-meter').value;
 $('#scan-value').value='';
 $('#scan-day').value='';
 $('#scan-night').value='';
 showScanKind();
 if(pendingImage&&$('#scan-preview').complete){scanCrop=null;findMeterDisplay();detectIndexFromImage();}
};
function capturePhotoData(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(new Error('lecture du fichier impossible'));
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>reject(new Error('image non prise en charge'));
   img.onload=()=>{
    const ratio=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    resolve(canvas.toDataURL('image/jpeg',.82));
   };
   img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}
function ocrLibrary(){
 if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
 if(ocrScriptPromise)return ocrScriptPromise;
 ocrScriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  script.async=true;
  script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('Module OCR absent'));
  script.onerror=()=>reject(new Error('Module OCR non téléchargé'));
  document.head.appendChild(script);
 }).catch(err=>{ocrScriptPromise=null;throw err});
 return ocrScriptPromise;
}
async function ocrWorker(){
 const engine=await ocrLibrary();
 if(!ocrWorkerPromise)ocrWorkerPromise=engine.createWorker('eng',1,{
  logger:m=>{
   if(scanBusy&&m?.status==='recognizing text'){
    const pct=Math.round((m.progress||0)*100);
    $('#scan-message').textContent='Lecture des chiffres… '+pct+' %';
   }
  }
 }).catch(err=>{ocrWorkerPromise=null;throw err});
 return ocrWorkerPromise;
}
function scanPreviousIndex(kind){
 const desiredDate=$('#reading-date').value||today();
 const list=sorted().filter(r=>r[kind]!=null);
 const eligible=list.filter(r=>r.date<=desiredDate);
 return (eligible.at(-1)||list.at(-1))?.[kind]??null;
}
function proposeScanIndex(text,kind){
 if(!text||!kind)return null;
 const tokens=text.replace(/[Oo]/g,'0').replace(/[Il|]/g,'1').match(/\d+(?:[.,]\d+)?/g)||[];
 const expected=scanPreviousIndex(kind),candidates=[];
 const add=(raw,quality)=>{
  if(!Number.isFinite(raw)||raw<0)return;
  const number=kind==='water'?roundWater(raw):Math.round(raw);
  if(kind==='water'&&number>99999||kind!=='water'&&number>9999999)return;
  const diff=expected==null?0:Math.abs(number-expected);
  let score=quality-(expected==null?0:Math.min(kind==='pv'?150:75,Math.log1p(diff)*9));
  if(kind==='water'&&expected!=null&&number<expected-.5)score-=12;
  if(kind!=='water'&&number<1000)score-=25;
  candidates.push({number,score});
 };
 if(kind==='water'){
  // Mechanical water meter: black digits = m3, three red digits = thousandths.
  // For 00220675, the reading is 220.675, rounded to 220.7 for display.
  for(const token of tokens){
   const part=token.replace(',','.');
   if(part.includes('.')){
    const match=part.match(/^(\d{1,6})\.(\d{1,3})$/);
    if(match)add(Number(part),96);
   }else if(/^\d{6,9}$/.test(part)){
    const base=part.slice(0,-3),fraction=part.slice(-3);
    if(base.length<=6)add(Number(base)+Number(fraction)/1000,90);
   } // Black-only digits are not enough to confirm the tenths on an analog water meter.
  }
  for(let i=0;i+1<tokens.length;i++){
   const first=tokens[i],second=tokens[i+1];
   if(/^\d{2,6}$/.test(first)&&/^\d{1,3}$/.test(second)){
    const combined=Number(first)+Number(second.padEnd(3,'0'))/1000;
    add(combined,77);
   }
  }
 }else if(kind==='pv'){
  // Itron photovoltaic meter: six BLACK whole-kWh wheels followed by one RED tenth.
  // Never concatenate all seven digits into a whole-kWh index.
  // Some OCR engines split the seven wheels into single separated characters.
  for(const line of text.replace(/[Oo]/g,'0').replace(/[Il|]/g,'1').split(/\r?\n/)){
   const singleDigits=line.match(/(?:\b\d\s+){6}\d\b/g)||[];
   for(const raw of singleDigits){
    const digits=raw.replace(/\s/g,'');
    if(digits.length===7)add(Number(digits.slice(0,6))+Number(digits[6])/10,119);
   }
  }
  for(let i=0;i<tokens.length;i++){
   const token=tokens[i].replace(',','.');
   if(/^\d{6}\.\d$/.test(token)){
    add(Number(token),126);
   }else if(/^\d{7}$/.test(token)){
    add(Number(token.slice(0,6))+Number(token.slice(6))/10,125);
   }else if(/^\d{6}$/.test(token)){
    const red=tokens[i+1];
    if(red&&/^\d$/.test(red))add(Number(token)+Number(red)/10,120);
    add(Number(token),95);
    // A photo may drop the initial leading 0, joining five black digits + one red.
    if(expected!=null&&Number(token)>expected*3&&Math.abs(Number(token)/10-expected)<Math.abs(Number(token)-expected))
     add(Number(token)/10,111);
   }else if(/^\d{5}\.\d$/.test(token)){
    add(Number(token),109);
   }else if(/^\d{5}$/.test(token)){
    const red=tokens[i+1];
    if(red&&/^\d$/.test(red))add(Number(token)+Number(red)/10,100);
   }
  }
 }else{
  for(const token of tokens){
   const digits=token.replace(/[,.].*$/,'');
   if(/^\d{4,7}$/.test(digits))add(Number(digits),70);
  }
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>b.score-a.score);
 if(candidates[0].score<15)return null;
 return kind==='water'?candidates[0].number.toFixed(1):String(candidates[0].number);
}

/* Schlumberger S16XDs: upper ☾ row = night, lower ☀ row = day.
   Each row has six black whole-kWh wheels plus one red fractional wheel.
   We never add that last red wheel to the whole-kWh value. */
function parseElectricWheel(raw,kind){
 const expected=scanPreviousIndex(kind);
 const cleaned=String(raw||'').replace(/[Oo]/g,'0').replace(/[Il|]/g,'1');
 const tokens=cleaned.match(/\d+(?:[.,]\d+)?/g)||[],candidates=[];
 const add=(digits,quality)=>{
  const number=Number(digits);
  if(!Number.isSafeInteger(number)||number<1000||number>999999)return;
  const target=expected??(kind==='night'?25336:30215);
  const distance=Math.abs(number-target);
  if(distance>Math.max(18000,target*.55))return;
  const score=quality-Math.min(125,Math.log1p(distance)*11);
  candidates.push({value:number,score});
 };
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i].replace(',','.');
  if(/^\d{5,6}\.\d$/.test(token))add(token.split('.')[0],125);
  else if(/^\d{7}$/.test(token))add(token.slice(0,6),123);
  else if(/^\d{6}$/.test(token)){
   add(token,109);
   // A missing leading zero can leave five whole wheels + the red one.
   add(token.slice(0,5),96);
   if(tokens[i+1]&&/^\d$/.test(tokens[i+1]))add(token,119);
  }else if(/^\d{5}$/.test(token)){
   add(token,96);
   if(tokens[i+1]&&/^\d$/.test(tokens[i+1]))add(token,105);
  }
 }
 // OCR may deliver "0 2 5 3 3 6 3" as individual words.
 if(tokens.length>=5&&tokens.length<=7&&tokens.every(t=>/^\d$/.test(t))){
  const combined=tokens.join('');
  if(combined.length===7)add(combined.slice(0,6),115);
  if(combined.length===6){add(combined,104);add(combined.slice(0,5),88)}
  if(combined.length===5)add(combined,84);
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>b.score-a.score);
 return candidates[0].score>0?candidates[0]:null;
}
function electricRowsFromWords(words){
 const grouped=[];
 for(const word of (words||[])){
  const bbox=word.bbox;if(!bbox||!/\d/.test(word.text||''))continue;
  const cy=(bbox.y0+bbox.y1)/2,ht=Math.max(8,bbox.y1-bbox.y0);
  let row=grouped.find(r=>Math.abs(r.cy-cy)<Math.max(13,Math.min(30,.57*Math.max(r.height,ht))));
  if(!row){row={cy,height:ht,parts:[]};grouped.push(row)}
  row.parts.push({x:bbox.x0,text:word.text});
  row.cy=(row.cy*(row.parts.length-1)+cy)/row.parts.length;
  row.height=Math.max(row.height,ht);
 }
 return grouped.map(r=>({y:r.cy,text:r.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')})).sort((a,b)=>a.y-b.y);
}
function recognizeElectricPair(ocr){
 if(!ocr)return null;
 // Tesseract.js 5 reports bounding boxes via nested blocks > paragraphs > lines > words.
 const blocks=Array.isArray(ocr.blocks)?ocr.blocks:[];
 const nestedLines=blocks.flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
 const nestedWords=nestedLines.flatMap(line=>line.words||[]);
 const lineRows=(Array.isArray(ocr.lines)&&ocr.lines.length?ocr.lines:nestedLines)
  .filter(r=>r?.text).map(r=>({text:r.text,y:r.bbox?.y0??null,x:r.bbox?.x0??null}))
  .filter(r=>/\d/.test(r.text));
 const wordRows=electricRowsFromWords(Array.isArray(ocr.words)&&ocr.words.length?ocr.words:nestedWords);
 const textRows=String(ocr.text||'').split(/\r?\n/).filter(t=>/\d/.test(t)).map((text,i)=>({text,y:i*100,x:null}));
 const collections=[lineRows,wordRows,textRows];
 let best=null;
 const lastNetwork=net().at(-1)?.value??null;
 for(let source=0;source<collections.length;source++){
  const rows=collections[source].flatMap((row,i)=>{
   const candidates=[];
   // Recognizers may put both counters on one line separated by whitespace.
   const chunks=(row.text||'').match(/\d{5,7}(?:[.,]\d)?/g)||[];
   if(chunks.length>=2){
    chunks.forEach((chunk,k)=>candidates.push({...row,text:chunk,y:(row.y??i*100)+k*3,ordinal:i+k/10}));
   }else candidates.push({...row,ordinal:i});
   return candidates;
  }).filter(r=>r.text);
  if(rows.length<2)continue;
  rows.sort((a,b)=>(a.y??a.ordinal)-(b.y??b.ordinal));
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
   const night=parseElectricWheel(rows[i].text,'night');
   const day=parseElectricWheel(rows[j].text,'day');
   if(!night||!day)continue;
   const total=night.value+day.value;
   const networkPenalty=lastNetwork==null?0:Math.min(90,Math.log1p(Math.abs(total-lastNetwork))*5);
   const sequentialBonus=j===i+1?16:0;
   const positionalBonus=rows[i].x!=null&&rows[j].x!=null?
    Math.max(-15,12-Math.abs(rows[i].x-rows[j].x)/20):0;
   const geometryPenalty=source!==2&&rows[i].y===rows[j].y?40:0;
   const score=night.score+day.score+sequentialBonus+positionalBonus
    -networkPenalty-geometryPenalty+(night.value<=day.value?8:-15);
   if(!best||score>best.score)best={night:night.value,day:day.value,total,score,source};
  }
 }
 return best&&best.score>10?best:null;
}
function fillElectricFromOcr(data){
 const match=recognizeElectricPair(data);
 if(match){
  $('#scan-night').value=match.night;
  $('#scan-day').value=match.day;
  refreshElectricSum();
  $('#scan-message').textContent='Lecture proposée : vérifie Nuit (haut), Jour (bas) et leur somme.';
  return true;
 }
 refreshElectricSum();
 $('#scan-message').textContent='Deux index non reconnus avec certitude. Encadre les deux lignes, ou remplis Nuit et Jour manuellement.';
 return false;
}


/* Image-space auto detection. The red fractional wheels locate the mechanical
   index; old meter values are NOT used to synthesize or replace OCR readings. */
let scanAutoZones=null,scanAutoConfidence='none',scanLastMethod='manual';
function scanUnion(zones){
 if(!zones?.length)return null;
 const x0=Math.min(...zones.map(z=>z.left)),y0=Math.min(...zones.map(z=>z.top));
 const x1=Math.max(...zones.map(z=>z.left+z.width)),y1=Math.max(...zones.map(z=>z.top+z.height));
 return {left:x0,top:y0,width:x1-x0,height:y1-y0};
}
function displayImageSpaceCrop(rect){
 const img=$('#scan-preview');if(!rect||!img?.naturalWidth)return;
 const wrap=$('#scan-preview-wrap'),imageRect=img.getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect();
 const scale=Math.min(imageRect.width/img.naturalWidth,imageRect.height/img.naturalHeight);
 const dx=imageRect.left-wrapRect.left+(imageRect.width-img.naturalWidth*scale)/2;
 const dy=imageRect.top-wrapRect.top+(imageRect.height-img.naturalHeight*scale)/2;
 displayScanCrop({x:dx+rect.left*scale,y:dy+rect.top*scale},
  {x:dx+(rect.left+rect.width)*scale,y:dy+(rect.top+rect.height)*scale});
}
function findMeterDisplay(){
 scanAutoZones=null;scanAutoConfidence='none';scanLastMethod='manual';
 const img=$('#scan-preview');
 if(!pendingImage||!img?.complete||!img.naturalWidth||!window.OwattScan?.locate)return false;
 try{
  const can=document.createElement('canvas'),width=384,height=Math.round(img.naturalHeight*width/img.naturalWidth);
  can.width=width;can.height=height;
  const ctx=can.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,width,height);
  const out=window.OwattScan.locate(ctx.getImageData(0,0,width,height),scanKind);
  if(!out?.zones?.length)return false;
  scanAutoZones=out.zones.map(z=>({
   left:z.left*img.naturalWidth,top:z.top*img.naturalHeight,
   width:z.width*img.naturalWidth,height:z.height*img.naturalHeight
  })).filter(z=>z.width>25&&z.height>15);
  if(!scanAutoZones.length){scanAutoZones=null;return false}
  scanCrop=scanUnion(scanAutoZones);scanAutoConfidence=out.confidence||'low';
  scanLastMethod=out.method||'automatic';
  displayImageSpaceCrop(scanCrop);
  return true;
 }catch(error){scanAutoZones=null;scanAutoConfidence='none';return false;}
}
function scanSourceImage(rect=scanCrop,negative=false){
 const img=$('#scan-preview');
 if(!rect||!img.complete||!img.naturalWidth)return pendingImage;
 const x=Math.max(0,Math.round(rect.left)),y=Math.max(0,Math.round(rect.top));
 const w=Math.min(img.naturalWidth-x,Math.max(1,Math.round(rect.width)));
 const h=Math.min(img.naturalHeight-y,Math.max(1,Math.round(rect.height)));
 const factor=Math.min(3,Math.max(1,1200/Math.max(w,h)));
 const can=document.createElement('canvas');can.width=Math.max(1,Math.round(w*factor));can.height=Math.max(1,Math.round(h*factor));
 const ctx=can.getContext('2d',{willReadFrequently:negative});
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(img,x,y,w,h,0,0,can.width,can.height);
 if(negative){
  const data=ctx.getImageData(0,0,can.width,can.height),pixels=data.data;
  // White rolling numbers on dark wheels become dark text on a pale field.
  for(let i=0;i<pixels.length;i+=4){
   const v=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]);
   const negativeValue=255-v;
   pixels[i]=negativeValue;pixels[i+1]=negativeValue;pixels[i+2]=negativeValue;
  }
  ctx.putImageData(data,0,0);
 }
 return can.toDataURL('image/png');
}
function scanManualZones(){
 if(!scanCrop)return null;
 if(scanKind!=='electric')return [scanCrop];
 const half=scanCrop.height/2;
 return [
  {left:scanCrop.left,top:scanCrop.top,width:scanCrop.width,height:half},
  {left:scanCrop.left,top:scanCrop.top+half,width:scanCrop.width,height:half}
 ];
}
function scanAcceptedSingle(raw,kind){
 const clean=String(raw||'').replace(/[Oo]/g,'0').replace(/[Il|]/g,'1');
 // Require the full digit-window pattern. A short serial-number fragment
 // must never become an index just because it is near a historic reading.
 if(kind==='pv'&&!/(?:^|[^\d])\d{7}(?!\d)|\d{6}[.,]\d(?!\d)/m.test(clean.replace(/\s+(?=\d)/g,'')))return null;
 if(kind==='water'&&!/\d{6,9}(?!\d)|\d{2,6}[.,]\d{1,3}/.test(clean.replace(/\s+(?=\d)/g,'')))return null;
 return proposeScanIndex(clean,kind);
}
function scanRecordDiagnostics(details,preview){
 const raw=details.map((v,i)=>'Essai '+(i+1)+' · '+v.description+'\n'+(v.text||'(aucun chiffre détecté)')).join('\n\n');
 $('#scan-raw-text').textContent=raw||'Aucune lecture.';
 const img=$('#scan-analysis');if(preview)img.src=preview;
}
async function withScanDeadline(work,ms=18000){
 let timer;
 try{
  return await Promise.race([
   work,
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OCR_TIMEOUT')),ms)})
  ]);
 }finally{clearTimeout(timer)}
}
async function recognizeScanZone(worker,engine,rect,negative,kind){
 const mode=kind==='electric'||rect?engine.PSM?.SINGLE_LINE||'7':engine.PSM?.SPARSE_TEXT||'11';
 await worker.setParameters({tessedit_char_whitelist:'0123456789,.',tessedit_pageseg_mode:mode});
 const source=scanSourceImage(rect,negative);
 const result=await withScanDeadline(worker.recognize(source,{}, {text:true}),18000);
 return {text:result?.data?.text||'',confidence:result?.data?.confidence??null,source};
}
async function detectIndexFromImage(){
 if(scanBusy||!pendingImage)return;
 scanBusy=true;const id=++scanRequest;
 const retry=$('#scan-retry');retry.disabled=true;
 const diagnostics=[];const preview=scanSourceImage();
 $('#scan-analysis').src=preview||pendingImage;
 $('#scan-raw-text').textContent='Analyse en cours…';
 $('#scan-message').textContent=scanCrop?'Analyse des chiffres détectés ou encadrés…':'Recherche des chiffres sur la photo…';
 try{
  const engine=await withScanDeadline(ocrLibrary(),18000);
  const worker=await withScanDeadline(ocrWorker(),22000);
  if(id!==scanRequest)return;
  const zones=scanAutoZones||scanManualZones();
  let result=null;
  if(scanKind==='electric'&&zones?.length===2){
   const values=[];
   for(let i=0;i<2;i++){
    const kind=i===0?'night':'day',zone=zones[i];
    const first=await recognizeScanZone(worker,engine,zone,false,'electric');
    diagnostics.push({description:kind==='night'?'Nuit / brut':'Jour / brut',text:first.text});
    let guess=parseElectricWheel(first.text,kind);
    if(!guess){
     const alternate=await recognizeScanZone(worker,engine,zone,true,'electric');
     diagnostics.push({description:kind==='night'?'Nuit / contraste':'Jour / contraste',text:alternate.text});
     guess=parseElectricWheel(alternate.text,kind);
    }
    values.push(guess?.value??null);
   }
   if(id!==scanRequest)return;
   $('#scan-night').value=values[0]??'';
   $('#scan-day').value=values[1]??'';
   refreshElectricSum();
   if(values.every(v=>v!==null)){
    $('#scan-message').textContent='Lecture proposée, à vérifier sur la photo : Nuit en haut, Jour en bas.';
   }else{
    $('#scan-message').textContent='Lecture incertaine : vérifie et complète les chiffres affichés. La zone peut être redessinée au doigt.';
   }
  }else if(scanKind!=='electric'){
   const zone=zones?.[0]||null;
   const first=await recognizeScanZone(worker,engine,zone,false,scanKind);
   diagnostics.push({description:'Index / brut',text:first.text});
   let chosen=scanAcceptedSingle(first.text,scanKind);
   if(chosen===null){
    const alternate=await recognizeScanZone(worker,engine,zone,true,scanKind);
    diagnostics.push({description:'Index / contraste',text:alternate.text});
    chosen=scanAcceptedSingle(alternate.text,scanKind);
   }
   if(id!==scanRequest)return;
   $('#scan-value').value=chosen??'';
   $('#scan-message').textContent=chosen===null?
    'Index non reconnu de façon fiable : recadre la fenêtre des chiffres ou saisis l’index manuellement.':
    'Index proposé : contrôle tous les chiffres avant de confirmer.';
  }else{
   // No suitable auto-detected index. Preserve the existing manual workflow.
   const all=await recognizeScanZone(worker,engine,scanCrop||null,false,'full');
   diagnostics.push({description:'Image complète (aucun cadrage fiable)',text:all.text});
   if(id!==scanRequest)return;
   fillElectricFromOcr({text:all.text});
   $('#scan-message').textContent='Zone non repérée : recadre les deux lignes Jour/Nuit, ou saisis les index manuellement.';
  }
  scanLastText=diagnostics.map(v=>v.text).join('\n');
  scanLastData={text:scanLastText};
  scanRecordDiagnostics(diagnostics,preview);
 }catch(err){
  if(id===scanRequest){
   scanRecordDiagnostics([...diagnostics,{description:'Erreur technique',text:String(err?.message||err)}],preview);
   $('#scan-message').textContent=String(err?.message)==='OCR_TIMEOUT'?
    'Délai de lecture dépassé. Encadre les chiffres ou saisis-les manuellement.':
    'Lecture automatique indisponible : saisis l’index manuellement. La photo reste disponible.';
   if(String(err?.message)==='OCR_TIMEOUT'){
    const old=ocrWorkerPromise;ocrWorkerPromise=null;
    old?.then(w=>w.terminate?.()).catch(()=>{});
   }
  }
 }finally{scanBusy=false;retry.disabled=false;}
}
$('#scan-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  pendingImage=await capturePhotoData(file);
  scanCrop=null;scanAutoZones=null;scanAutoConfidence='none';scanLastText='';scanLastData=null;
  $('#scan-preview').src=pendingImage;
  $('#scan-crop-box').classList.add('hidden');
  $('#scan-meter').value=scanKind;
  $('#scan-value').value='';
  $('#scan-day').value='';
  $('#scan-night').value='';
  showScanKind();
  $('#scan-message').textContent='Préparation de la lecture…';
  modal('scan-overlay');
  const image=$('#scan-preview');if(!image.complete)await new Promise(ok=>{image.onload=ok;image.onerror=ok});
  findMeterDisplay();
  await detectIndexFromImage();
 }catch(err){toast('Impossible de lire cette photo.')}
 e.target.value='';
};
$('#scan-retry').onclick=()=>detectIndexFromImage();
$('#scan-reset-crop').onclick=()=>{
 scanCrop=null;scanAutoZones=null;$('#scan-crop-box').classList.add('hidden');detectIndexFromImage();
};
let scanPointer=null;
function scanPoint(ev){
 const wrap=$('#scan-preview-wrap'),rect=wrap.getBoundingClientRect();
 return {x:Math.max(0,Math.min(rect.width,ev.clientX-rect.left)),y:Math.max(0,Math.min(rect.height,ev.clientY-rect.top))};
}
function displayScanCrop(start,end){
 const box=$('#scan-crop-box'),x=Math.min(start.x,end.x),y=Math.min(start.y,end.y);
 box.style.left=x+'px';box.style.top=y+'px';box.style.width=Math.abs(start.x-end.x)+'px';box.style.height=Math.abs(start.y-end.y)+'px';box.classList.remove('hidden');
}
$('#scan-preview-wrap').addEventListener('pointerdown',ev=>{
 if(scanBusy)return;const p=scanPoint(ev);scanPointer={id:ev.pointerId,start:p,end:p};
 ev.currentTarget.setPointerCapture?.(ev.pointerId);ev.preventDefault();
});
$('#scan-preview-wrap').addEventListener('pointermove',ev=>{
 if(!scanPointer||ev.pointerId!==scanPointer.id)return;
 scanPointer.end=scanPoint(ev);displayScanCrop(scanPointer.start,scanPointer.end);ev.preventDefault();
});
$('#scan-preview-wrap').addEventListener('pointerup',ev=>{
 if(!scanPointer||ev.pointerId!==scanPointer.id)return;
 const selection=scanPointer;scanPointer=null;selection.end=scanPoint(ev);
 const a=selection.start,b=selection.end;
 if(Math.abs(a.x-b.x)<14||Math.abs(a.y-b.y)<8){$('#scan-crop-box').classList.add('hidden');return}
 const img=$('#scan-preview'),rect=img.getBoundingClientRect();
 if(!img.naturalWidth||!img.naturalHeight)return;
 // Respect the letterbox introduced by object-fit: contain.
 const scale=Math.min(rect.width/img.naturalWidth,rect.height/img.naturalHeight);
 const shownW=img.naturalWidth*scale,shownH=img.naturalHeight*scale;
 const insetX=(rect.width-shownW)/2+(rect.left-$('#scan-preview-wrap').getBoundingClientRect().left);
 const insetY=(rect.height-shownH)/2+(rect.top-$('#scan-preview-wrap').getBoundingClientRect().top);
 const fromX=Math.max(0,Math.min(img.naturalWidth,(Math.min(a.x,b.x)-insetX)/scale));
 const fromY=Math.max(0,Math.min(img.naturalHeight,(Math.min(a.y,b.y)-insetY)/scale));
 const toX=Math.max(0,Math.min(img.naturalWidth,(Math.max(a.x,b.x)-insetX)/scale));
 const toY=Math.max(0,Math.min(img.naturalHeight,(Math.max(a.y,b.y)-insetY)/scale));
 if(toX-fromX<15||toY-fromY<8)return;
 scanCrop={left:fromX,top:fromY,width:toX-fromX,height:toY-fromY};
 scanAutoZones=null;scanAutoConfidence='manual';
 displayScanCrop(a,b);detectIndexFromImage();
});
$('#scan-preview-wrap').addEventListener('pointercancel',()=>{scanPointer=null});
$('#confirm-scan').onclick=()=>{
 const k=$('#scan-meter').value;
 if(k==='electric'){
  const values=electricInputs();
  if(!values)return toast('Vérifie les index Nuit et Jour avant de confirmer.');
  $('#reading-total').value=String(values.total);
  // For new readings we retain the official monohourly sum, not the two registers.
  pendingPhotos.electric=pendingImage;
 }else{
  const v=$('#scan-value').value;
  if(v.trim()===''||!Number.isFinite(Number(v))||Number(v)<0)return toast('Vérifie l’index avant de confirmer.');
  $('#reading-'+k).value=k==='water'?roundWater(v).toFixed(1):String(Math.round(Number(v)));
  pendingPhotos[k]=pendingImage;
 }
 photoFlags();
 modal('scan-overlay',false);modal('reading-overlay',true);
 toast(k==='electric'?'Total monohoraire prêt à enregistrer.':'Index ajouté au formulaire.');
};
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(['accueil','electricite','solaire','eau','mazout','releves','analyses','reglages'].includes(p))show(p)});
const firstPage=['accueil','electricite','solaire','eau','mazout','releves','analyses','reglages'].includes(location.hash.slice(1))?location.hash.slice(1):'accueil';show(firstPage);
})();