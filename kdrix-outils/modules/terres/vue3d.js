/* KDRIX - Vue 3D LiDAR : uniquement un MNT numerique continu preleve sur la fiche.
 * Le niveau final est commun avec le dossier local et la coupe A-B.
 */
import {setupSpwSampling} from './vue3d_spw.js';
const STORE_KEY='kdrix_prospection_v3',TERRAIN_DB='kdrix-terres-terrain-v1';
const params=new URLSearchParams(location.search),siteId=params.get('site')||'',siteName=params.get('name')||'Site non renseigné';
const $=id=>document.getElementById(id);
$('siteTitle').textContent=siteName;
$('returnLink').href='index.html?site='+encodeURIComponent(siteId)+'&tab=cubature';
$('missingBack').href=$('returnLink').href;
let THREE=null,OrbitControls=null,scene=null,renderer=null,camera=null,orbit=null,patch=null,geometryData=null;
let terrainObject=null,fillObject=null,wireObject=null,viewMode='compare',activeScenario='center',verticalFactor=1,loading=false,refreshHandle=null,transientLevel=null,transientScenario=null;
const nf=(x,d=0)=>Number.isFinite(Number(x))?new Intl.NumberFormat('fr-BE',{maximumFractionDigits:d}).format(Number(x)):'—';
function readDb(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}catch{return {}}}
function getStudy(db=readDb()){return db.studies?.[siteId]||null}
function settings(db=readDb()){const q=getStudy(db)?.quick||{};return{...q,level:Number.isFinite(Number(q.level))&&q.level!==null?Number(q.level):null}}
function currentLevels(q=settings()) {const lev=q.level,delta=Math.max(0,Number(q.delta)||2);return {low:q.lowLevel!==null&&q.lowLevel!==undefined&&q.lowLevel!==''&&Number.isFinite(Number(q.lowLevel))?Number(q.lowLevel):lev===null?null:lev-delta,center:lev,high:q.highLevel!==null&&q.highLevel!==undefined&&q.highLevel!==''&&Number.isFinite(Number(q.highLevel))?Number(q.highLevel):lev===null?null:lev+delta}}
function valueOfScenario(q=settings()){return transientLevel!==null&&transientScenario===activeScenario?transientLevel:currentLevels(q)[activeScenario]}
function writeLevel(scenario,value){if(!Number.isFinite(value))return;const db=readDb(),st=db.studies?.[siteId];if(!st){missing('Dossier manquant','Le dossier est introuvable dans le stockage local de ce navigateur. Retourner à la fiche du site.');return}
 const q=st.quick||(st.quick={mode:'simple',level:null,delta:2,depth:8,depthDelta:2});
 const prev=currentLevels(q),newLevels={...prev,[scenario]:value};
 if(newLevels.low!==null&&newLevels.center!==null&&newLevels.high!==null&&(newLevels.low>newLevels.center||newLevels.center>newLevels.high)){
  alert('Cotes incohérentes : le Z bas doit être inférieur ou égal au Z central, lui-même inférieur ou égal au Z haut.');updateControls();return;
 }
 if(scenario==='center')q.level=value;else if(scenario==='low')q.lowLevel=value;else q.highLevel=value;
 q.mode='spw';db.updatedAt=new Date().toISOString();
 try{localStorage.setItem(STORE_KEY,JSON.stringify(db))}catch{missing('Sauvegarde impossible','Le navigateur refuse d’enregistrer la cote Z. Vérifiez l’espace disponible puis réessayez.');return}
 updateControls();scheduleFill();
}
function missing(title,message){$('missing').hidden=false;$('missing').querySelector('h2').textContent=title;$('missingText').textContent=message}
function hideMissing(){$('missing').hidden=true}
async function readPatch(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('IndexedDB désactivé'));return}
 const req=indexedDB.open(TERRAIN_DB,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('patches'))req.result.createObjectStore('patches',{keyPath:'siteId'})};
 req.onerror=()=>reject(req.error||Error('Lecture de la base locale impossible'));
 req.onsuccess=()=>{const db=req.result,tx=db.transaction('patches','readonly'),get=tx.objectStore('patches').get(siteId);get.onsuccess=()=>{db.close();resolve(get.result||null)};get.onerror=()=>{db.close();reject(get.error||Error('Données 3D indisponibles'))}};
})}
function geometryStamp(st){return JSON.stringify([st?.polygons||[],st?.exclusions||[]])}
async function loadPatch(){if(loading)return;loading=true;try{
 const p=await readPatch(),study=getStudy();
 if(!study){missing('Aucun dossier local','Ouvrir d’abord une fiche du module Terres pour créer la géométrie et enregistrer les données.');return}
 if(!p){missing('Relief numérique à récupérer','Cliquez sur « Récupérer automatiquement le relief SPW » pour une reconnaissance indicative. Pour une étude plus détaillée, importez un MNT GeoTIFF ou ASC depuis la fiche.');return}
 if(p.geometryStamp!==geometryStamp(study)){missing('La surface a été modifiée','La géométrie de la carrière a changé depuis la préparation de cet extrait. Retournez à la fiche et rouvrez la 3D pour mettre le MNT à jour.');return}
 if(!p.z||!p.nx||!p.ny||p.coverage<.9){missing('MNT incomplet','L’extrait ne contient pas suffisamment d’altitudes numériques pour représenter le terrain.');return}
 patch=p;hideMissing();$('terrainInfo').textContent=`${p.source?.name||'MNT numérique'} · maillage de visualisation ${nf(p.displayCellSize,1)} m · ${nf(p.coverage*100,0)} % de la fosse couvert`;
 $('sourceDetails').textContent=p.source?.sampled?`${p.source.name} · ${p.source.description} · couverture ${nf(p.coverage*100,0)} %. Sondages ponctuels SPW interpolés : précision limitée, non équivalente au MNT raster de 0,5 m.`:`${p.source?.name||'MNT importé'} · ${p.source?.description||''} · grille d’affichage ${nf(p.displayCellSize,1)} m · ${nf(p.coverage*100,0)} % de la fosse couverte. Date d’acquisition à vérifier. Relief du sol si le fichier importé est un MNT.`;
 if(!THREE){try{THREE=await import('three');({OrbitControls}=await import('three/addons/controls/OrbitControls.js'))}catch(e){missing('Moteur 3D indisponible','Impossible de charger Three.js. Une connexion Internet autorisant cdn.jsdelivr.net est nécessaire. '+String(e?.message||e));return}}
 if(!renderer)initialize3D();buildTerrain();updateControls();scheduleFill();
}catch(err){missing('Erreur de chargement',String(err?.message||err))}finally{loading=false}}
function localOf(latlon){const earth=6378137,rad=Math.PI/180,lat0=patch.lat0,lon0=patch.lon0;return [(latlon[1]-lon0)*rad*earth*Math.cos(lat0*rad),(latlon[0]-lat0)*rad*earth]}
function polyXY(){const st=getStudy(),convert=ring=>ring.map(localOf);return {outer:(st?.polygons||[]).map(convert),holes:(st?.exclusions||[]).map(convert)}}
function pointInside(pt,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>pt[1])!== (b[1]>pt[1]) &&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function clipPolygon(poly,axis,bound,greater){if(!poly.length)return [];const inside=p=>greater?p[axis]>=bound-1e-9:p[axis]<=bound+1e-9;let out=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);if(ia!==ib){const d=b[axis]-a[axis];if(Math.abs(d)>1e-14){const t=(bound-a[axis])/d;out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])}}if(ib)out.push(b)}return out}
function clipArea(poly,x0,y0,x1,y1){if(poly.length<3)return 0;let q=clipPolygon(poly,0,x0,true);q=clipPolygon(q,0,x1,false);q=clipPolygon(q,1,y0,true);q=clipPolygon(q,1,y1,false);if(q.length<3)return 0;let area=0;for(let i=0;i<q.length;i++){let p=q[i],b=q[(i+1)%q.length];area+=p[0]*b[1]-b[0]*p[1]}return Math.abs(area)/2}
function getZ(ix,iy){if(ix<0||iy<0||ix>=patch.nx||iy>=patch.ny)return null;const z=patch.z[iy*patch.nx+ix];return Number.isFinite(z)?z:null}
function zAt(x,y){const fx=(x-patch.x0)/(patch.x1-patch.x0)*(patch.nx-1),fy=(patch.y1-y)/(patch.y1-patch.y0)*(patch.ny-1),ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
 if(ix<0||iy<0||ix+1>=patch.nx||iy+1>=patch.ny)return null;const a=getZ(ix,iy),b=getZ(ix+1,iy),c=getZ(ix,iy+1),d=getZ(ix+1,iy+1);return [a,b,c,d].every(Number.isFinite)?(a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty):null}
function computeCells(){const {outer,holes}=polyXY(),nx=patch.nx,ny=patch.ny,dx=(patch.x1-patch.x0)/(nx-1),dy=(patch.y1-patch.y0)/(ny-1),list=[];
 for(let iy=0;iy<ny-1;iy++){const top=patch.y1-iy*dy,bottom=top-dy;
  for(let ix=0;ix<nx-1;ix++){const left=patch.x0+ix*dx,right=left+dx;
   let area=outer.reduce((t,poly)=>t+clipArea(poly,left,bottom,right,top),0)-holes.reduce((t,poly)=>t+clipArea(poly,left,bottom,right,top),0);
   area=Math.max(0,Math.min(dx*dy,area));if(area<.00001)continue;
   const zs=[getZ(ix,iy),getZ(ix+1,iy),getZ(ix,iy+1),getZ(ix+1,iy+1)];
   // Ne pas extrapoler a travers les zones sans mesure.
   const ground=zs.every(Number.isFinite)?zs.reduce((a,b)=>a+b,0)/4:null;
   list.push({ix,iy,left,right,top,bottom,area,ground,valid:ground!==null});
  }
 }
 return list}
function volumesFor(level){if(!patch||!geometryData||!Number.isFinite(level))return null;let v=0,fillArea=0,covered=0,total=0,maxDepth=0;
 for(const cell of geometryData.cells){total+=cell.area;if(!cell.valid)continue;covered+=cell.area;const diff=level-cell.ground;if(diff>0){v+=diff*cell.area;fillArea+=cell.area;maxDepth=Math.max(maxDepth,diff)}}
 return {volume:v,area:total,fillArea,meanDepth:fillArea?v/fillArea:0,maxDepth,coverage:total?covered/total:0}}
function yAt(z){return (z-patch.zmin)*verticalFactor}
function pos(x,y,z){const cx=(patch.x0+patch.x1)/2,cy=(patch.y0+patch.y1)/2;return [x-cx,yAt(z),-(y-cy)]}
function ramp(v){const t=Math.min(.9999,Math.max(0,(v-patch.zmin)/Math.max(1,patch.zmax-patch.zmin))),stops=[[34,83,145],[53,143,171],[66,159,107],[208,196,99],[213,133,69],[141,83,75]],v2=t*(stops.length-1),i=Math.floor(v2),k=v2-i;return new THREE.Color().setRGB(...stops[i].map((x,j)=>(x+(stops[i+1][j]-x)*k)/255))}
function initialize3D(){scene=new THREE.Scene();scene.background=new THREE.Color('#102d3a');const el=$('scene');camera=new THREE.PerspectiveCamera(40,el.clientWidth/Math.max(1,el.clientHeight),.05,120000);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.setSize(el.clientWidth,el.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;el.append(renderer.domElement);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.screenSpacePanning=true;orbit.maxPolarAngle=Math.PI*.52;orbit.minDistance=4;orbit.maxDistance=50000;
 scene.add(new THREE.HemisphereLight('#ffffff','#567b87',2.1));const dir=new THREE.DirectionalLight('#fff0d7',1.9);dir.position.set(-300,950,320);scene.add(dir);
 window.addEventListener('resize',resize3D);requestAnimationFrame(animate3D);
}
function resize3D(){if(!renderer||!camera)return;const el=$('scene'),w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
function animate3D(){requestAnimationFrame(animate3D);if(document.hidden||!renderer)return;orbit?.update();renderer.render(scene,camera)}
function disposeGroup(group){if(!group)return;scene.remove(group);group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}
function buildTerrain(){if(!patch||!scene)return;disposeGroup(terrainObject);disposeGroup(fillObject);disposeGroup(wireObject);terrainObject=new THREE.Group();wireObject=new THREE.Group();fillObject=null;
 const nx=patch.nx,ny=patch.ny,dx=(patch.x1-patch.x0)/(nx-1),dy=(patch.y1-patch.y0)/(ny-1);
 const vertices=new Float32Array(nx*ny*3),colors=new Float32Array(nx*ny*3),indices=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const idx=j*nx+i,z=getZ(i,j),p=pos(patch.x0+i*dx,patch.y1-j*dy,z===null?patch.zmin:z),c=ramp(z===null?patch.zmin:z);
  vertices.set(p,idx*3);colors.set([c.r,c.g,c.b],idx*3);
 }
 for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
  const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
  if([getZ(i,j),getZ(i+1,j),getZ(i,j+1),getZ(i+1,j+1)].every(Number.isFinite))indices.push(a,c,b,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});terrainObject.add(new THREE.Mesh(geometry,mat));
 const {outer,holes}=polyXY();function addOutline(poly,color){const points=poly.map(([x,y])=>{let z=zAt(x,y);return new THREE.Vector3(...pos(x,y,z===null?patch.zmin:z+.35))});if(points.length<3)return;const obj=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,linewidth:2}));wireObject.add(obj)}
 for(const poly of outer)addOutline(poly,0x36e6cd);for(const poly of holes)addOutline(poly,0xffba84);
 scene.add(terrainObject,wireObject);geometryData={cells:computeCells()};const dim=Math.max(patch.x1-patch.x0,patch.y1-patch.y0),heights=Math.max(10,patch.zmax-patch.zmin);
 const dist=Math.max(dim*1.55,heights*3,65);orbit.target.set(0,yAt(patch.zmin+heights*.35),0);camera.position.set(dist*.7,dist*.78,dist*.74);camera.near=Math.max(.05,dist/2500);camera.far=dist*120;camera.updateProjectionMatrix();orbit.update();resize3D();}
function fillGeometryFor(level){const cells=geometryData.cells.filter(c=>c.valid&&c.ground<level),activeCells=new Set(cells.map(c=>c.iy+':'+c.ix));const top=[],wall=[];
 const pushTri=(arr,a,b,c)=>arr.push(...a,...b,...c);
 for(const c of cells){const a=pos(c.left,c.top,level),b=pos(c.right,c.top,level),d=pos(c.left,c.bottom,level),e=pos(c.right,c.bottom,level);pushTri(top,a,d,b);pushTri(top,b,d,e);
  // Le front de remblai n'est materialise que sur les cellules en bordure.
  const borders=[{di:0,dj:-1,x1:c.left,y1:c.top,x2:c.right,y2:c.top},{di:1,dj:0,x1:c.right,y1:c.top,x2:c.right,y2:c.bottom},{di:0,dj:1,x1:c.right,y1:c.bottom,x2:c.left,y2:c.bottom},{di:-1,dj:0,x1:c.left,y1:c.bottom,x2:c.left,y2:c.top}];
  for(const side of borders){if(activeCells.has((c.iy+side.dj)+':'+(c.ix+side.di)))continue;const zg1=zAt(side.x1,side.y1),zg2=zAt(side.x2,side.y2);if(zg1===null||zg2===null)continue;
   const u=pos(side.x1,side.y1,level),v=pos(side.x2,side.y2,level),w=pos(side.x1,side.y1,Math.min(level,zg1)),x=pos(side.x2,side.y2,Math.min(level,zg2));pushTri(wall,u,v,w);pushTri(wall,v,x,w);
  }
 }
 const group=new THREE.Group();function meshOf(coords,material){if(!coords.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.computeVertexNormals();group.add(new THREE.Mesh(g,material))}
 meshOf(top,new THREE.MeshPhongMaterial({color:0x3ab3a1,side:THREE.DoubleSide,transparent:viewMode==='compare',opacity:viewMode==='compare'?.63:.98,depthWrite:viewMode!=='compare'}));
 meshOf(wall,new THREE.MeshPhongMaterial({color:0x198d82,side:THREE.DoubleSide,transparent:true,opacity:viewMode==='compare'?.27:.68}));return group;
}
function scheduleFill(){clearTimeout(refreshHandle);refreshHandle=setTimeout(redrawFill,75)}
function redrawFill(){if(!patch||!scene||!geometryData)return;disposeGroup(fillObject);fillObject=null;
 const z=valueOfScenario();if(z!==null&&Number.isFinite(z)&&viewMode!=='terrain'){fillObject=fillGeometryFor(z);scene.add(fillObject)}
 const stats=volumesFor(z);
 if(stats&&stats.coverage<.995){
  $('volume').textContent='— m³';$('area').textContent=nf(stats.area,0)+' m²';$('depth').textContent='—';$('money').textContent='—';
  $('volumeMethod').textContent='Couverture altimétrique partielle ('+nf(stats.coverage*100,1)+' %) : le volume global est masqué pour ne pas présenter un volume partiel comme une capacité totale. Importer un MNT plus complet ou réduire l’emprise.';
  return;
 }
 if(stats){$('volume').textContent=nf(Math.round(stats.volume/100)*100)+' m³';$('area').textContent=nf(stats.area,0)+' m²';$('depth').textContent=nf(stats.meanDepth,1)+' m';
  const db=readDb(),prices=db.prices||{low:40,high:80};const euros=n=>n>=1e6?nf(n/1e6,2)+' M€':nf(n/1000,0)+' k€';$('money').textContent=euros(stats.volume*(Number(prices.low)||40))+' – '+euros(stats.volume*(Number(prices.high)||80));
  $('volumeMethod').textContent=patch.source?.sampled?`Reconnaissance par sondages SPW interpolés espacés d’environ ${nf(patch.displayCellSize,1)} m, couverture ${nf(stats.coverage*100,1)} %. Volume seulement indicatif : pas une cubature sur le raster original 50 cm.`:`Maillage numérique d'environ ${nf(patch.displayCellSize,1)} m issu d'un MNT importé, ${nf(stats.coverage*100,1)} % de l'emprise couverte. Surface projet horizontale, exclusions déduites. Ordre de grandeur, indépendant de l'exagération verticale.`;
 }else $('volume').textContent='— m³';
}
function updateControls(){if(!patch)return;const q=settings(),levels=currentLevels(q),lev=levels[activeScenario];
 for(const b of $('scenarioButtons').querySelectorAll('button'))b.classList.toggle('active',b.dataset.scenario===activeScenario);
 for(const b of $('displayModes').querySelectorAll('button'))b.classList.toggle('active',b.dataset.display===viewMode);
 for(const b of $('exagButtons').querySelectorAll('button'))b.classList.toggle('active',Number(b.dataset.exag)===verticalFactor);
 $('zLow').value=levels.low??'';$('zCentral').value=levels.center??'';$('zHigh').value=levels.high??'';
 $('zValue').value=lev??'';const slider=$('zSlider');const min=Math.floor(Math.min(patch.zmin-5,lev??patch.zmin)-5),max=Math.ceil(Math.max(patch.zmax+10,lev??patch.zmax)+5);slider.min=min;slider.max=max;slider.value=lev??min;
}
function setScenario(k){transientLevel=null;transientScenario=null;activeScenario=k;updateControls();scheduleFill()}
function setMode(k){viewMode=k;updateControls();scheduleFill()}
function resetCamera(top=false){if(!patch||!orbit)return;const dim=Math.max(patch.x1-patch.x0,patch.y1-patch.y0),dist=Math.max(70,dim*1.6,(patch.zmax-patch.zmin)*3);
 camera.position.set(top?0:dist*.7,top?dist*1.1:dist*.75,top?0.001:dist*.7);camera.up.set(0,1,0);orbit.update();}
function wireUI(){document.querySelectorAll('[data-display]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.display)));
 document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>setScenario(b.dataset.scenario)));
 document.querySelectorAll('[data-exag]').forEach(b=>b.addEventListener('click',()=>{verticalFactor=Number(b.dataset.exag);updateControls();buildTerrain();scheduleFill()}));
 $('viewTop').onclick=()=>resetCamera(true);$('viewPersp').onclick=()=>resetCamera(false);$('viewCenter').onclick=()=>resetCamera(false);
 $('zDown').onclick=()=>{const v=valueOfScenario();if(v!==null)writeLevel(activeScenario,Math.round((v-.5)*2)/2)};
 $('zUp').onclick=()=>{const v=valueOfScenario();if(v!==null)writeLevel(activeScenario,Math.round((v+.5)*2)/2)};
 $('zValue').onchange=e=>writeLevel(activeScenario,Number(e.target.value));
 $('zSlider').oninput=e=>{transientScenario=activeScenario;transientLevel=Number(e.target.value);$('zValue').value=transientLevel;scheduleFill()};$('zSlider').onchange=e=>{const z=Number(e.target.value);transientLevel=null;transientScenario=null;writeLevel(activeScenario,z)};
 for(const [input,scenario]of [['zLow','low'],['zCentral','center'],['zHigh','high']])$(input).onchange=e=>writeLevel(scenario,Number(e.target.value));
 window.addEventListener('storage',e=>{if(e.key!==STORE_KEY)return;const st=getStudy();if(patch&&st&&patch.geometryStamp!==geometryStamp(st)){missing('La surface a changé','L’emprise a été modifiée dans la fiche. Rouvrir la vue 3D pour préparer un nouveau MNT.');return}updateControls();scheduleFill()});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.siteId!==siteId)return;if(e.data?.type==='KDRIX_3D_PATCH_READY')loadPatch();if(e.data?.type==='KDRIX_3D_PATCH_ERROR')missing('MNT 3D indisponible',String(e.data.message))});
}
setupSpwSampling({siteId,storeKey:STORE_KEY,terrainDb:TERRAIN_DB,getStudy,geometryStamp,reload:async()=>{patch=null;await loadPatch()},sourceIsImported:()=>!!patch&&!patch.source?.sampled});
wireUI();loadPatch();
// Recharge apres transfert IndexedDB de la fiche, meme si l'onglet etait ouvert plus vite que l'ecriture.
for(const ms of [1500,4000,8000])setTimeout(()=>{if(!patch)loadPatch()},ms);