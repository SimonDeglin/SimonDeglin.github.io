/* Phase 3A: real public-source metadata enrichment (not CSC text analysis).
 * Run: node marcheradar/tools/phase3a-enrich.cjs --pilot [--write]
 *      node marcheradar/tools/phase3a-enrich.cjs --all [--write]
 * Only the official TED search/XML and public BOSA UI are read. No login.
 * A document shown in BOSA is "listed", NEVER a claimed direct download.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),child=require('node:child_process');
const core=require('./phase3a-core.cjs');
const ROOT=path.resolve(__dirname,'..'),DATA=path.join(ROOT,'data.json');
const RESULTS=path.join(ROOT,'pilot','phase3a-enrichment.json');
const args=new Set(process.argv.slice(2));
const isAll=args.has('--all'),write=args.has('--write');
if(!args.has('--pilot')&&!isAll)throw Error('Préciser --pilot ou --all');
const SAMPLE=[
 'ted:682034-2026','ted:674146-2026','ted:549850-2026',
 'ted:626806-2026','ted:490060-2026',
 'bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354',
 'bosa:3b81ba48-e9f4-4d6f-9c05-5ba699c7f209',
 'bosa:834b6f23-3906-4589-a0e7-afae9c91d26a',
 'bosa:2057ca19-d4bd-43d6-bf36-bbc34ec2f71f',
 'communal:7092b8f35c924d8b04e4'
];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>new Date().toISOString();
function noFetch(raw){
 try{const u=new URL(raw);return !(u.protocol==='https:'&&['ted.europa.eu','api.ted.europa.eu','www.publicprocurement.be'].includes(u.hostname))}
 catch(e){return true}
}
async function get(url,{method='GET',body=null,timeout=20000,maxBytes=3800000,accept='*/*'}={}){
 if(noFetch(url))throw Error('Source non autorisée : '+url.slice(0,75));
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),timeout);
 try{
  const res=await fetch(url,{method,headers:{Accept:accept,'User-Agent':'KDRIX-PublicMarketDocuments/0.1',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:control.signal,redirect:'error'});
  const pieces=[];let bytes=0;
  if(res.body)for await(const chunk of res.body){bytes+=chunk.length;if(bytes>maxBytes)throw Error('Réponse supérieure à la limite de sécurité');pieces.push(chunk)}
  return {status:res.status,body:Buffer.concat(pieces).toString('utf8'),contentType:res.headers.get('content-type')||''};
 }finally{clearTimeout(timer)}
}
async function fetchTED(m){
 const pub=m.publicationNumber||m.id.replace(/^ted:/,'');
 if(!core.tedNotice(pub))throw Error('Numéro de publication TED invalide');
 const out={checkedAt:now(),status:'partial',sources:[],documents:[],apiStatus:0,xmlStatus:0};
 const fields=['publication-number','notice-title','deadline-receipt-tender-date-lot','deadline-receipt-tender-time-lot','links'];
 const payload={query:'ND = '+pub,fields,scope:'ALL',limit:3,page:1};
 let result=null;
 try{
  const r=await get('https://api.ted.europa.eu/v3/notices/search',{method:'POST',body:payload,timeout:22000,accept:'application/json'});
  out.apiStatus=r.status;
  if(r.status===200){
   const api=core.parseTedAPI(JSON.parse(r.body),pub);
   if(api.matched){result=api;out.apiMatched=true;out.deadline=api.deadline;}
   else out.error='La réponse API ne contient pas la publication attendue';
  }else out.error='TED API HTTP '+r.status;
 }catch(err){out.error='TED API : '+String(err.message).slice(0,140)}
 let xml=null;
 const xmlURL='https://ted.europa.eu/en/notice/'+pub+'/xml';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await get(xmlURL,{timeout:26000,accept:'application/xml,text/xml'});
   out.xmlStatus=r.status;
   if(r.status===200&&/xml/.test(r.contentType)&&r.body.startsWith('<?xml')){
    const extracted=core.parseTedXML(r.body);
    if(extracted.valid){xml=extracted;out.xmlValidated=true;break}
    out.xmlError='Réponse XML sans structure d’avis eForms reconnue';
   }else if(r.status===202){out.xmlError='XML temporairement indisponible, HTTP 202'}
   else{out.xmlError='TED XML HTTP '+r.status+', type '+r.contentType.slice(0,50);break}
  }catch(err){out.xmlError=String(err.message).slice(0,140)}
  if(attempt<2)await pause(900*(attempt+1));
 }
 const apiDeadline=result?.deadline,xmlDeadline=xml?.deadline;
 let confirmed=null,origin='';
 if(apiDeadline&&['date','datetime'].includes(apiDeadline.precision)&&result?.matched){
  // If two independent official forms disagree on the date, request review.
  const conflicting=xmlDeadline&&xmlDeadline.value&&xmlDeadline.value.slice(0,10)!==apiDeadline.value.slice(0,10);
  if(conflicting)out.conflict={api:apiDeadline.value,xml:xmlDeadline.value};
  else{confirmed=apiDeadline;origin='TED API — BT-131'}
 }else if(xmlDeadline&&['date','datetime'].includes(xmlDeadline.precision)){
  confirmed=xmlDeadline;origin='TED XML — TenderSubmissionDeadlinePeriod';
 }
 if(confirmed){
  out.deadline=confirmed;out.deadlineVerified=true;out.deadlineSource=origin;
  out.deadlineSourceUrl=origin.includes('XML')?xmlURL:core.tedNotice(pub);
  out.deadlinePublicationNumber=pub;
  out.deadlineFields=origin.includes('XML')?['cac:TenderSubmissionDeadlinePeriod/cbc:EndDate','cac:TenderSubmissionDeadlinePeriod/cbc:EndTime']:
   ['deadline-receipt-tender-date-lot','deadline-receipt-tender-time-lot'];
 }
 if(xml){
  for(const link of xml.links){
   const url=core.safeURL(link);
   if(!url)continue;
   const u=new URL(url);
   if(!u.hostname.endsWith('publicprocurement.be')&&u.hostname!=='cloud.3p.eu')continue;
   if(u.pathname.includes('/documents')||u.hostname==='cloud.3p.eu'){
    out.sources.push({source:'TED XML — documents de marché',kind:'documents_portal',url,verified:true,
     sourcePage:xmlURL,checkedAt:out.checkedAt});
   }
  }
 }
 if(result?.officialPdf){
  // The official PDF is a notice, not a CSC; do not add it to "documents".
  out.noticePdf={url:result.officialPdf,source:'TED API',status:'link_from_official_api'};
 }
 out.status=out.apiMatched||out.xmlValidated?'accessible':'failed';
 out.audit={source:'TED',status:out.status,api_http:out.apiStatus,xml_http:out.xmlStatus,
  api_matched:!!out.apiMatched,xml_validated:!!out.xmlValidated,deadline_precision:confirmed?.precision||'unknown',
  documents_portal_count:out.sources.length,warning:out.error||out.xmlError||null};
 return out;
}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
let browser=null;
async function startBrowser(){
 if(browser)return browser;
 const {chromium}=require('playwright');
 const cmd=child.spawnSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'});
 const exe=String(cmd.stdout||'').trim().split('\n')[0];
 browser=await chromium.launch(exe?{executablePath:exe,headless:true}:{headless:true});
 return browser;
}
async function verifyBosaBulk(page,m,docs,url,checkedAt){
 // Only the one confirmed public pilot; do not download every archive automatically.
 if(isAll||m.publicationWorkspaceId!=='0765b50e-85f5-4aae-b2ca-2ed66c14e354'||!docs.length)return null;
 const button=page.getByRole('button',{name:/Télécharger tous les documents/i}).first();
 if(!await button.count())return {verified:false,reason:'Bouton de téléchargement groupé indisponible'};
 try{
  const pending=page.waitForEvent('download',{timeout:35000});
  await button.click({timeout:9000});
  const download=await pending;
  const filepath=await download.path(),stat=fs.statSync(filepath);
  if(stat.size>100_000_000||stat.size<200)throw Error('Taille de l’archive hors limites');
  const first=Buffer.alloc(4),handle=fs.openSync(filepath,'r');
  try{fs.readSync(handle,first,0,4,0)}finally{fs.closeSync(handle)}
  if(first.toString('hex')!=='504b0304')throw Error('Téléchargement non ZIP');
  const files=child.execFileSync('unzip',['-Z','-1',filepath],{encoding:'utf8',timeout:10000,maxBuffer:200000}).split('\n').filter(x=>x&&!x.endsWith('/'));
  const listed=new Set(files.map(x=>norm(path.posix.basename(x).replace(/^['‘]/,''))));
  const matching=docs.filter(d=>listed.has(norm(d.title.replace(/^['‘]/,'')))).length;
  if(matching!==docs.length||files.length!==docs.length)return {
   verified:false,reason:'L’inventaire ZIP ne correspond pas au catalogue BOSA',
   zipEntries:files.length,listedCount:docs.length,matching
  };
  const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
  return {verified:true,method:'public_bulk_download',sourceUrl:url,checkedAt,
   archiveSize:stat.size,archiveSHA256:hash,fileCount:files.length,matching,reason:'Liste ZIP vérifiée, contenus non analysés'};
 }catch(e){return {verified:false,reason:String(e.message).slice(0,160)}}
}
async function fetchBOSA(m){
 const uuid=m.publicationWorkspaceId,url=core.bosaDocuments(uuid);
 if(!url)throw Error('Identifiant workspace BOSA manquant ou invalide');
 const out={checkedAt:now(),sources:[],documents:[],status:'partial'};
 const b=await startBrowser(),context=await b.newContext({locale:'fr-BE',timezoneId:'Europe/Brussels',viewport:{width:1366,height:940}});
 try{
  const page=await context.newPage();
  const general=url.replace(/\/documents$/,'/general');
  await page.goto(general,{waitUntil:'domcontentloaded',timeout:34000});
  await page.waitForFunction(t=>(document.body.innerText||'').toLowerCase().includes(String(t).toLowerCase()),m.title.slice(0,40),{timeout:10000})
   .catch(()=>{});
  // Explicit website title verification; avoid attaching another procedure's documents.
  const body=(await page.locator('body').innerText({timeout:10000})).slice(0,19000);
  if(!norm(body).includes(norm(m.title.slice(0,Math.min(55,m.title.length))))){
   out.status='mismatch';out.error='Titre du dossier BOSA différent de la fiche';return out;
  }
  // The title was matched above: interpret only the named official BOSA field.
  const submission=m.noticeKind==='competition'?core.parseBosaDeadline(body):{value:'',precision:'unknown'};
  if(submission.value){
   out.deadline=submission;out.deadlineVerified=true;
   out.deadlineSource='BOSA — page générale (Date limite de soumission)';
   out.deadlineSourceUrl=general;
   out.deadlinePublicationNumber=m.bdaReference||m.internalReference||uuid;
   out.deadlineFields=['Date limite de soumission','heure et fuseau CET/CEST'];
   out.deadlineEvidenceText=submission.evidence;
  }
    const snippets=body.split('\n').map(s=>s.trim()).filter(Boolean);
  const deadlines=[];
  for(let i=0;i<snippets.length;i++)if(/date limite (?:de )?(?:soumission|remise)|deadline|délai de remise/i.test(snippets[i])){
   deadlines.push(snippets.slice(i,i+4).join(' ').slice(0,250));
  }
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:34000});
  await page.waitForFunction(t=>document.body.innerText.includes(t),m.title.slice(0,48),{timeout:16000}).catch(()=>{});
  await page.waitForTimeout(850);
  const DOM=await page.evaluate(()=>({
   documentTitle:(document.body.innerText||'').slice(0,500),
   rows:[...document.querySelectorAll('tr')].map(tr=>({cells:[...tr.querySelectorAll('td')].map(td=>(td.innerText||'').trim()).filter(Boolean)})),
   allText:(document.body.innerText||'').slice(0,20000)
  }));
  if(!norm(DOM.allText).includes(norm(m.title.slice(0,Math.min(45,m.title.length))))){
   out.status='mismatch';out.error='Onglet Documents sans correspondance avec la publication';return out;
  }
  const parsed=core.parseDocumentRows(DOM.rows,m,url,out.checkedAt);
  out.documents=parsed.documents;out.sources=[{source:'BOSA — onglet Documents',kind:'documents_portal',url,verified:true,checkedAt:out.checkedAt},...parsed.external];
  out.bulkDocumentDownload=await verifyBosaBulk(page,m,parsed.documents,url,out.checkedAt);
  out.status='accessible';
  out.audit={source:'BOSA',status:'accessible',document_rows:parsed.documents.length,
   external_catalogues:parsed.external.length,deadline_candidates:deadlines.slice(0,3),
   deadline_verified:!!out.deadlineVerified,deadline_value:out.deadline?.value||'',deadline_evidence:out.deadlineEvidenceText||'',bundle_verified:out.bulkDocumentDownload?.verified===true,warning:'Fichiers référencés dans la liste publique; téléchargement direct et contenu non encore analysés.'};
  return out;
 }catch(err){out.status='failed';out.error=String(err.message).slice(0,240);out.audit={source:'BOSA',status:'failed',error:out.error};return out}
 finally{await context.close().catch(()=>{})}
}
async function fetchLocal(m){
 const official=core.safeURL(m.sourceDocument||m.url);
 const out={checkedAt:now(),status:'historical'};
 // An excerpt from an old council deliberation is NOT a new call for tenders.
 out.audit={source:'LOCALE',status:'historical_source',source_url:official,warning:'Source de prospection historique. Pas de CSC ni de nouvelle date limite à déduire.'};
 return out;
}
async function run(){
 const data=JSON.parse(fs.readFileSync(DATA,'utf8'));
 if(!Array.isArray(data.items)||!data.items.length)throw Error('Inventaire vide, ne rien écraser');
 const all=isAll?data.items.filter(m=>m.source!=='LOCALE'&&m.screening!=='excluded').slice(0,Number(process.env.PHASE3A_LIMIT||40)):
  SAMPLE.map(id=>data.items.find(m=>m.id===id)).filter(Boolean);
 if(!isAll&&all.length!==SAMPLE.length)throw Error('Échantillon incomplet: '+all.length+'/'+SAMPLE.length);
 const startCount=data.items.length,startIds=data.items.map(x=>x.id);
 const records=[],byId=new Map(data.items.map(m=>[m.id,m]));
 for(const m of all){
  let discovered;
  try{discovered=m.source==='TED'?await fetchTED(m):m.source==='BOSA'?await fetchBOSA(m):await fetchLocal(m)}
  catch(err){discovered={status:'failed',error:String(err.message).slice(0,180),documents:[],sources:[]}}
  const enriched=core.mergeRecords(m,discovered);
  byId.set(m.id,enriched);
  const result={id:m.id,title:m.title.slice(0,100),source:m.source,noticeKind:m.noticeKind||'',
   beforeDeadline:m.deadline||'',afterDeadline:enriched.deadline||'',
   deadlineVerified:enriched.deadlineEvidence?.verified||false,
   newDocuments:(enriched.documents||[]).length-(m.documents||[]).length,
   documentCount:(enriched.documents||[]).length,documentNames:(discovered.documents||[]).map(d=>d.title).slice(0,22),
   sourceLinks:(discovered.sources||[]).map(s=>s.url),
   status:discovered.status,error:discovered.error||'',
   audit:discovered.audit||{},deadlineReview:enriched.deadlineReview||null};
  records.push(result);
  console.log('PHASE3A_RESULT',JSON.stringify({...result,documentNames:result.documentNames.slice(0,6),sourceLinks:result.sourceLinks.slice(0,6)}));
  await pause(240);
 }
 data.items=data.items.map(m=>byId.get(m.id)||m);
 if(data.items.length!==startCount||data.items.some((m,i)=>m.id!==startIds[i]))throw Error('Intégrité du listing compromise');
 const recordCount=records.filter(r=>r.newDocuments>0||r.afterDeadline!==r.beforeDeadline||r.sourceLinks.length>0).length;
 const verifiedDates=records.filter(r=>r.afterDeadline!==r.beforeDeadline&&r.deadlineVerified).length;
 const indexed=records.reduce((n,r)=>n+r.newDocuments,0);
 const summary={generatedAt:now(),mode:isAll?'all':'pilot',sampleCount:records.length,
  accessible:records.filter(r=>r.status==='accessible').length,
  newDates:verifiedDates,newDocuments:indexed,updatedRecords:recordCount,
  errors:records.filter(r=>r.status==='failed').length};
 fs.mkdirSync(path.dirname(RESULTS),{recursive:true});
 fs.writeFileSync(RESULTS,JSON.stringify({summary,records},null,2)+'\n','utf8');
 if(write){
  data.sources={...(data.sources||{}),PHASE3A:{status:summary.errors?'partial':'pilot',last_attempt:summary.generatedAt,
   sample:summary.sampleCount,accessible:summary.accessible,verified_deadline_upgrades:verifiedDates,
   newly_indexed_files:indexed,updated_market_records:recordCount}};
  data.metrics={...(data.metrics||{}),phase3a_pilot:summary};
  fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n','utf8');
 }
 console.log('PHASE3A_SUMMARY',JSON.stringify(summary));
 // Do not fail just because a public portal was unreachable: report status and retain data.
 if(records.length!==all.length)throw Error('Échantillon incomplet');
}
run().catch(err=>{console.error('PHASE3A_FATAL',err.stack||err);process.exitCode=1}).finally(async()=>{
 if(browser)await browser.close().catch(()=>{});
});
