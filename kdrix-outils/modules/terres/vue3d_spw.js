/* KDRIX Terres — reconnaissance 3D depuis les altitudes ponctuelles officielles du SPW.
   La grille interpole implicitement entre sondages : ce n'est PAS le MNT raster 50 cm. */
const SPW_IDENTIFY='https://geoservices.wallonie.be/arcgis/rest/services/RELIEF/WALLONIE_MNT_2021_2022/MapServer/identify';
const EARTH=6378137, RAD=Math.PI/180, GRID_N=19, REQUESTS=GRID_N*GRID_N;
const byId=id=>document.getElementById(id);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const insideRing=(p,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside};
function round(v,n=1){return Number(v).toLocaleString('fr-BE',{maximumFractionDigits:n})}
export function planGrid(st,n=GRID_N){
 const rings=(st?.polygons||[]).filter(p=>Array.isArray(p)&&p.length>=3);
 if(!rings.length)throw Error('Dessinez et enregistrez d’abord le contour de la carrière sur la carte.');
 const points=rings.flat();if(points.some(p=>!Array.isArray(p)||!finite(Number(p[0]))||!finite(Number(p[1]))))throw Error('Coordonnées du contour invalides.');
 const lat0=points.reduce((acc,p)=>acc+Number(p[0]),0)/points.length;
 const lon0=points.reduce((acc,p)=>acc+Number(p[1]),0)/points.length;
 const scaleLon=EARTH*RAD*Math.cos(lat0*RAD),scaleLat=EARTH*RAD;
 if(scaleLon<10000)throw Error('Coordonnées du terrain non prises en charge.');
 const xy=p=>[(Number(p[1])-lon0)*scaleLon,(Number(p[0])-lat0)*scaleLat];
 const polygon=rings.map(r=>r.map(xy)),exclusions=(st.exclusions||[]).filter(r=>r.length>=3).map(r=>r.map(xy));
 const all=polygon.flat(),rawX0=Math.min(...all.map(p=>p[0])),rawX1=Math.max(...all.map(p=>p[0]));
 const rawY0=Math.min(...all.map(p=>p[1])),rawY1=Math.max(...all.map(p=>p[1]));
 const dx=rawX1-rawX0,dy=rawY1-rawY0;
 if(dx<1||dy<1)throw Error('Emprise trop petite ou géométrie non valide pour les sondages SPW.');
 if(dx*dy>16e6)throw Error('Emprise trop étendue : divisez la zone pour garder une reconnaissance raisonnable.');
 const pad=Math.max(7,Math.min(40,Math.max(dx,dy)*.06));
 const x0=rawX0-pad,x1=rawX1+pad,y0=rawY0-pad,y1=rawY1+pad;
 const coords=[];let needed=0;
 for(let row=0;row<n;row++)for(let col=0;col<n;col++){
  const x=x0+col/(n-1)*(x1-x0),y=y1-row/(n-1)*(y1-y0),p=[x,y];
  const neededHere=polygon.some(r=>insideRing(p,r))&&!exclusions.some(r=>insideRing(p,r));
  if(neededHere)needed++;
  coords.push({lat:lat0+y/scaleLat,lon:lon0+x/scaleLon,inside:neededHere});
 }
 if(needed<4)throw Error('Emprise trop étroite pour cette grille. Agrandissez le contour ou importez un MNT.');
 return {n,nx:n,ny:n,x0,x1,y0,y1,lat0,lon0,coords,needed,spacing:Math.max((x1-x0)/(n-1),(y1-y0)/(n-1))};
}
export async function identifySPW(lat,lon,signal,fetchFn=fetch){
 const extent=0.003;const q=new URLSearchParams({f:'json',geometry:`${lon},${lat}`,geometryType:'esriGeometryPoint',sr:'4326',layers:'all:0',tolerance:'0',mapExtent:`${lon-extent},${lat-extent},${lon+extent},${lat+extent}`,imageDisplay:'600,600,96',returnGeometry:'false'});
 const res=await fetchFn(SPW_IDENTIFY+'?'+q,{signal,mode:'cors',cache:'no-store'});
 if(!res.ok)throw Error('HTTP '+res.status);
 const json=await res.json();if(json?.error)throw Error(json.error.message||'Réponse du service SPW en erreur');
 const result=json?.results?.find(x=>x?.layerId===0)||json?.results?.[0];const attrs=result?.attributes||{};
 // Identique a la cle utilisee par le GeoViewer officiel ; jamais de lecture des couleurs WMS.
 const raw=attrs['Stretch.Pixel Value']??attrs['Pixel Value']??attrs['Pixel value'];
 if(raw===null||raw===undefined||String(raw).trim()==='')return null;
 const val=Number(String(raw).replace(',','.'));
 return Number.isFinite(val)&&val>-500&&val<1500?val:null;
}
export async function collectGrid(plan,{signal,fetchFn=fetch,onProgress=()=>{},concurrency=5}={}){
 const z=new Float32Array(plan.coords.length).fill(NaN);
 let next=0,done=0,failed=0,received=0,hit=0,firstError='';
 async function worker(){while(next<plan.coords.length){
  if(signal?.aborted)throw new DOMException('Requête annulée','AbortError');
  const i=next++,c=plan.coords[i];
  try{const val=await identifySPW(c.lat,c.lon,signal,fetchFn);if(val!==null){z[i]=val;received++;if(c.inside)hit++}else failed++}
  catch(err){if(signal?.aborted)throw err;failed++;if(!firstError)firstError=String(err?.message||err)}
  done++;if(done%3===0||done===plan.coords.length)onProgress({done,total:plan.coords.length,received,failed,coverage:hit/plan.needed});
 }}
 await Promise.all(Array.from({length:Math.min(concurrency,plan.coords.length)},worker));
 const coverage=hit/plan.needed,overall=received/plan.coords.length;
 if(coverage<.9||overall<.8)throw Error(`Couverture insuffisante : ${round(coverage*100,0)} % de l’emprise, ${received}/${plan.coords.length} altitudes reçues. ${firstError||'Retentez ou importez un GeoTIFF.'}`);
 const values=Array.from(z).filter(Number.isFinite);
 return {z,coverage,overall,received,failed,zmin:Math.min(...values),zmax:Math.max(...values)};
}
async function savePatch(dbName,patch){return new Promise((resolve,reject)=>{
 if(!indexedDB)throw Error('Stockage local IndexedDB non disponible');
 const req=indexedDB.open(dbName,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('patches'))req.result.createObjectStore('patches',{keyPath:'siteId'})};
 req.onerror=()=>reject(req.error||Error('Impossible d’ouvrir IndexedDB'));
 req.onsuccess=()=>{const db=req.result,tx=db.transaction('patches','readwrite');tx.objectStore('patches').put(patch);
  tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error||Error('Échec de l’enregistrement'))};tx.onabort=()=>{db.close();reject(tx.error||Error('Enregistrement annulé'))};
 };
})}
export function setupSpwSampling({siteId,storeKey,terrainDb,getStudy,geometryStamp,reload,sourceIsImported=()=>false}){
 const start=byId('spwAutoFetch'),again=byId('spwRefresh'),cancel=byId('spwAbort'),status=byId('spwStatus'),progress=byId('spwProgress');
 if(!start)return;
 let controller=null;
 const setStatus=msg=>{if(status)status.textContent=msg};
 const setBusy=busy=>{start.disabled=busy;if(again)again.disabled=busy;if(cancel)cancel.hidden=!busy;if(progress){progress.hidden=!busy;if(!busy)progress.value=0}};
 cancel?.addEventListener('click',()=>{controller?.abort();setStatus('Annulation demandée…')});
 async function run(){
  if(controller)return;
  const study=getStudy();let plan;
  try{plan=planGrid(study)}catch(e){setStatus(e.message);byId('missingText').textContent=e.message;return}
  if(sourceIsImported()&&!confirm('Un MNT numérique importé est déjà chargé. Le remplacer par une reconnaissance plus grossière de sondages SPW ?'))return;
  controller=new AbortController();setBusy(true);
  const timer=setTimeout(()=>controller?.abort(),180000);
  setStatus(`Interrogation des altitudes SPW : 0/${plan.coords.length}. Maille de reconnaissance ≈ ${round(plan.spacing)} m.`);
  try{
   const response=await collectGrid(plan,{signal:controller.signal,concurrency:5,onProgress:p=>{
    if(progress)progress.value=Math.round(p.done/p.total*100);
    setStatus(`Sondages SPW : ${p.done}/${p.total} · ${p.received} altitudes reçues · ${p.failed} indisponibles · ${round(p.coverage*100,0)} % de la fosse sondée`);
   }});
   const sampled=true,source={name:`SPW MNT 2021–2022 · ${response.received} altitudes ponctuelles`,kind:'Sondages altimétriques interpolés',sampled,
    description:`Grille de reconnaissance ≈ ${round(plan.spacing)} m, non assimilable au MNT raster original de 0,5 m`,
    acquisition:'Acquisition LiDAR 2021–2022 ; date locale du dernier remaniement non connue',
    service:SPW_IDENTIFY};
   const patch={siteId,siteName:byId('siteTitle')?.textContent||siteId,geometryStamp:geometryStamp(study),storedAt:new Date().toISOString(),
    source,nx:plan.nx,ny:plan.ny,x0:plan.x0,x1:plan.x1,y0:plan.y0,y1:plan.y1,lat0:plan.lat0,lon0:plan.lon0,
    z:response.z,coverage:response.coverage,covered:response.overall,zmin:response.zmin,zmax:response.zmax,displayCellSize:plan.spacing};
   await savePatch(terrainDb,patch);
   const db=JSON.parse(localStorage.getItem(storeKey)||'{}');
   const localStudy=db.studies?.[siteId];
   if(localStudy&&geometryStamp(localStudy)===patch.geometryStamp){
    const vals=Array.from(response.z).filter(Number.isFinite).sort((a,b)=>a-b),highZ=vals[Math.floor(.90*(vals.length-1))];
    const q=localStudy.quick||(localStudy.quick={depth:8,depthDelta:2,delta:2});
    if(q.level===undefined||q.level===null||q.level==='')q.level=Math.round(highZ*2)/2;
    q.mode='spw';localStudy.terrain3D={source,storedAt:patch.storedAt,coverage:patch.coverage,displayCellSize:patch.displayCellSize};
    db.updatedAt=new Date().toISOString();localStorage.setItem(storeKey,JSON.stringify(db));
   }
   setStatus(`Relief SPW chargé : ${response.received} altitudes, maille ≈ ${round(plan.spacing)} m, couverture de la fosse ${round(response.coverage*100,0)} %. Reconnaissance indicative.`);
   try{window.opener?.postMessage({type:'KDRIX_3D_SPW_READY',siteId},location.origin)}catch{}
   await reload();
  }catch(e){const canceled=controller?.signal.aborted;
   setStatus(canceled?'Chargement annulé ou délai dépassé. Le précédent relief enregistré reste inchangé.':`Impossible de récupérer le relief : ${e?.message||e}. Vérifiez la connexion/SPW ou importez un GeoTIFF.`);
  }finally{clearTimeout(timer);controller=null;setBusy(false)}
 }
 start.addEventListener('click',run);again?.addEventListener('click',run);
}