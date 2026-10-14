/* MarchéRadar KDRIX — index public des adjudications belges.
 * Navigation publique https://www.publicprocurement.be/bda sans connexion privée.
 * Les réponses sont récupérées au fil des pages via les commandes du site,
 * sans reproduire les en-têtes/cookies ni contourner un contrôle d'accès.
 * Ne pas lancer avec une fréquence élevée (la planification est 3 fois/jour).
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const bosa=require('./bosa-public.cjs');
const profile=require('./kdrix-profile.cjs');
const DATA=path.resolve(__dirname,'../data.json');
const URL='https://www.publicprocurement.be/bda';
const API='/api/sea/search/publications';
const MAX_PAGES=Number(process.env.BOSA_MAX_PAGES||80);
const DAYS=Number(process.env.BOSA_DAYS||14);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function currentISO(){return new Date().toISOString().slice(0,10)}
function publicationDate(item){return String(item.publicationDate||item.dispatchDate||'').slice(0,10)}
function parseItems(payload){
 if(!payload||!Array.isArray(payload.publications)||!Number.isInteger(Number(payload.totalCount)))throw Error('Schéma de recherche BOSA inattendu');
 return payload.publications;
}
function performanceDate(item){
 const dates=[item.vaultSubmissionDeadline,item.tenderSubmissionDeadline,item.dossier?.submissionDeadline].filter(Boolean);
 return dates.map(x=>String(x).slice(0,10)).filter(x=>/^20\d{2}-\d\d-\d\d$/.test(x)).sort()[0]||'';
}
async function launch(){
 const command=cp.spawnSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'});
 const binary=(command.stdout||'').trim().split('\n')[0];
 if(!binary)throw Error('Navigateur Chrome absent du runner GitHub');
 return chromium.launch({executablePath:binary,headless:true,args:['--disable-dev-shm-usage','--no-sandbox']});
}
/* Les tuiles publiques du bulletin indiquent souvent une date limite
   que la réponse sommaire JSON ne transmet pas. La lire sur la même page,
   uniquement lorsqu'elle est affichée explicitement. */
async function visibleDeadlines(page,items){
 const first=items?.[0]?.publicationWorkspaceId;
 if(first){
  await page.waitForFunction(id=>!!document.querySelector('a[href*="'+id+'"]'),first,{timeout:8000}).catch(()=>{});
 }
 return page.evaluate(()=>{
  const result={};
  for(const link of document.querySelectorAll('a[href*="/publication-workspaces/"]')){
   const id=link.href.match(/publication-workspaces\/([a-f0-9-]{36})/i)?.[1];
   if(!id)continue;
   const t=link.innerText||'';
   const m=t.match(/(?:Date limite de soumission|Submission deadline)\s*(\d{2})\/(\d{2})\/(\d{4})/i);
   if(m)result[id]=m[3]+'-'+m[2]+'-'+m[1];
  }
  return result;
 });
}
async function collectBrowser(options={}){
 const maxPages=options.maxPages||MAX_PAGES;
 const lookback=options.days||DAYS;
 const cutoff=new Date(Date.now()-lookback*86400000).toISOString().slice(0,10);
 const all=[],seen=new Set(),log=[];
 let browser;
 try{
  browser=await (options.launch||launch)();
  const page=await browser.newPage({locale:'fr-BE',timezoneId:'Europe/Brussels',viewport:{width:1280,height:850}});
  page.setDefaultTimeout(20000);
  const notices=()=>page.waitForResponse(r=>r.url().includes(API)&&r.request().method()==='POST',{timeout:35000});
  const first=notices();
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:35000});
  const firstResponse=await first;
  if(!firstResponse.ok())throw Error('Bulletin BOSA indisponible : HTTP '+firstResponse.status());
  let body=await firstResponse.json();
  let completed=false,oldest='';
  // Le bandeau de cookies ne doit pas masquer le bouton de page suivante.
  const cookies=page.getByRole('button',{name:'Accepter les cookies'});
  if(await cookies.count()&&await cookies.isVisible())await cookies.click().catch(()=>{});
  for(let index=1;index<=maxPages;index++){
   const current=parseItems(body);
   if(!current.length){completed=true;break}
   let added=0,minDate='9999-99-99',maxDate='';
   const deadlines=await visibleDeadlines(page,current);
   for(const item of current){
    if(deadlines[item.publicationWorkspaceId]&&!item.vaultSubmissionDeadline)
      item.vaultSubmissionDeadline=deadlines[item.publicationWorkspaceId];
    const day=publicationDate(item);
    if(day&&day<minDate)minDate=day;
    if(day>maxDate)maxDate=day;
    if(day&&day<cutoff)continue;
    const id=String(item.publicationWorkspaceId||item.procedureId||'');
    const key=id+'|'+String(item.referenceNumber||'')+'|'+String(item.noticeSubType||'');
    if(id&&!seen.has(key)){seen.add(key);all.push(item);added++}
   }
   oldest=minDate==='9999-99-99'?'':minDate;
   log.push({page:index,received:current.length,newRelevantPeriod:added,newest:maxDate,oldest,reportedTotal:Number(body.totalCount||0)});
   console.log('BOSA_PAGE',index,'received',current.length,'kept',added,'oldest',oldest);
   if(minDate!=='9999-99-99'&&minDate<cutoff){completed=true;break}
   if(current.length<25){completed=true;break}
   if(index===maxPages)break;
   const button=page.locator('button[aria-label="pagination.common.nextPage"]').first();
   if(await button.count()===0||await button.isDisabled()) {completed=true;break}
   const next=notices();
   await button.click({timeout:20000});
   const response=await next;
   if(!response.ok())throw Error('Pagination BOSA interrompue : HTTP '+response.status()+' à la page '+(index+1));
   body=await response.json();
   await wait(420);
  }
  return {publications:all,complete:completed,cutoff,oldest,pageCount:log.length,progress:log};
 }finally{if(browser)await browser.close().catch(()=>{})}
}
function importPublic(data,results){
 const records=[];
 const seen=new Set();
 let matched=0;
 for(const raw of results.publications){
  const record=bosa.normalize(raw);
  if(!record)continue;
  if(record.noticeKind==='award'){
   // Les avis d'attribution restent consultables mais ne deviennent pas un
   // nouveau marché à répondre : les placer en file de vérification.
   record.screening='review';
  }
  const key=record.id; // Chaque avis conserve sa source ; fusion par procédure à l'étape merge.
  if(seen.has(key))continue;
  seen.add(key);
  matched++;
  records.push(record);
 }
 const previous=(data.items||[]).map(function(m){
  if(m.source!=='BOSA')return m;
  if((m.languages||[]).length&&m.languages.every(x=>String(x).toUpperCase()==='NL'))
    return {...m,screening:'excluded'};
  const result=profile.screen(m);
  if(!result.classification)return {...m,screening:'excluded'};
  return {...m,...result.classification};
 });
 const combined=bosa.merge(previous,records);
 const now=new Date().toISOString();
 data.items=combined;
 data.coverage={...(data.coverage||{}),BOSA:results.complete?
  'Collecte du Bulletin officiel active. Historique partiel : '+results.pageCount+' page(s) parcourue(s) depuis '+results.cutoff+'.':
  'Collecte BOSA partielle : limite atteinte avant la date cible '+results.cutoff+'.'};
 data.sources={...(data.sources||{}),BOSA:{status:results.complete?'accessible':'partial',
  last_success:now,scanned:results.progress.reduce((v,x)=>v+x.received,0),
  retained:matched,period_from:results.cutoff,period_to:currentISO(),
  pages:results.pageCount,complete:results.complete,
  raw_candidates:results.publications.length,oldest_seen:results.oldest}};
 data.metrics={...(data.metrics||{}),bosa_scanned:data.sources.BOSA.scanned,
   bosa_imported:matched,bosa_pages:results.pageCount,records:combined.length};
 return {data,inserted:matched,total:combined.length,scanned:data.sources.BOSA.scanned};
}
async function run(){
 let data=JSON.parse(fs.readFileSync(DATA,'utf8'));
 const results=await collectBrowser();
 if(!results.publications.length)throw Error('BOSA : aucune publication collectée, conserver les dernières données');
 const imported=importPublic(data,results);
 fs.writeFileSync(DATA,JSON.stringify(imported.data,null,2)+'\n','utf8');
 console.log('BOSA_BROWSER_OK',JSON.stringify({
  imported:imported.inserted,total:imported.total,scanned:imported.scanned,
  complete:results.complete,periodFrom:results.cutoff,pages:results.pageCount
 }));
}
module.exports={collectBrowser,importPublic,publicationDate,parseItems,performanceDate,visibleDeadlines,run};
if(require.main===module)run().catch(e=>{console.warn('BOSA_BROWSER_NOT_UPDATED',String(e.message||e));process.exitCode=0});
