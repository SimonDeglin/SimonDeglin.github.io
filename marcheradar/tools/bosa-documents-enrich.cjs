/* BOSA: enrichissement DOCUMENTAIRE uniquement à partir de réponses publiques 200 JSON.
 * Aucune URL de téléchargement n'est déduite d'un identifiant de fichier.
 * Les données anciennes restent intactes lorsqu'un endpoint échoue.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const SOURCE=path.join(__dirname,'..','data.json');
const UUID=/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i;
function endpoints(id){
 if(!UUID.test(String(id||'')))throw Error('Invalid BOSA workspace ID');
 const root='https://www.publicprocurement.be/api/dos/publication-workspaces/'+id;
 return {documents:root+'/documents?full=false&type=WORKSPACE&type=ESPD_REQUEST&type=SDI',urls:root+'/urls?full=false'};
}
async function jsonArray(url,fetcher=fetch){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const r=await fetcher(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});
  if(!r.ok)return {ok:false,status:r.status};
  const data=await r.json();if(!Array.isArray(data))return {ok:false,status:r.status,error:'not_array'};
  return {ok:true,status:r.status,data};
 }catch(e){return {ok:false,error:String(e?.name||'Error')}}finally{clearTimeout(timer)}
}
function safeExternal(url){
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname!=='localhost'&&u.hostname.includes('.')&&u.href.length<1800?u.href:'';
 }catch(e){return ''}
}
function normalizeDocuments(raw,workspace,apiUrl){
 const list=[];
 for(const item of raw){
  if(!item||item.workspaceId!==workspace||!UUID.test(item.id))continue;
  const versions=Array.isArray(item.versions)?item.versions.filter(x=>x&&typeof x==='object'):[];
  versions.sort((a,b)=>String(a.activatedAt||a.createdAt||'').localeCompare(String(b.activatedAt||b.createdAt||'')));
  const active=versions.at(-1),doc=active?.document||{},title=String(doc.originalFileName||'').trim();
  if(!title||title.length>500||!UUID.test(doc.id||''))continue;
  const extension=(title.match(/\.([a-zA-Z0-9]{1,8})$/)||[])[1]?.toLowerCase()||'';
  list.push({
   id:item.id,title,kind:/\b(csc|cch|bestek|cahier)/i.test(title)?'csc':/inventaire|inventaris|borde(reau)?/i.test(title)?'bill_of_quantities':/plan|dwg|dxf/i.test(title)?'plan':/annex|bijlage/i.test(title)?'annex':'other',
   fileType:extension,versionId:active.id||'',documentId:doc.id,
   activatedAt:active.activatedAt||'',language:(item.languages||[]).join(','),
   access:'public_metadata_only',downloadVerified:false,sourceUrl:apiUrl
  });
 }
 return [...new Map(list.map(x=>[x.id,x])).values()];
}
function normalizeConsultationUrls(raw,endpoint){
 const list=[];
 for(const x of raw){
  const url=safeExternal(x?.url);if(!url)continue;
  list.push({url,type:'officially_referenced_external_documents',access:'destination_not_download_verified',sourceUrl:endpoint,activatedAt:String(x.activatedAt||'')});
 }
 return [...new Map(list.map(x=>[x.url,x])).values()];
}
async function enrichRecord(m,fetcher=fetch){
 if(m.source!=='BOSA'||!UUID.test(m.publicationWorkspaceId||''))return {market:m,result:'not_bosa'};
 const api=endpoints(m.publicationWorkspaceId),[d,u]=await Promise.all([jsonArray(api.documents,fetcher),jsonArray(api.urls,fetcher)]);
 const copy={...m},changes=[];
 if(d.ok){
  copy.documentInventory=normalizeDocuments(d.data,m.publicationWorkspaceId,api.documents);
  copy.documentsPageUrl='https://www.publicprocurement.be/publication-workspaces/'+m.publicationWorkspaceId+'/documents';
  copy.documentsPageSource='public_api_200';
  changes.push('inventory:'+copy.documentInventory.length);
 }
 if(u.ok){
  copy.consultationUrls=normalizeConsultationUrls(u.data,api.urls);
  changes.push('external:'+copy.consultationUrls.length);
 }
 if(changes.length)copy.documentsCheckedAt=new Date().toISOString();
 return {market:copy,result:changes.length?'enriched':'source_unavailable',changes,endpointStatus:{documents:d.status||d.error||null,urls:u.status||u.error||null}};
}
async function run(){
 const source=JSON.parse(fs.readFileSync(SOURCE,'utf8'));
 const selected=process.argv.includes('--sample')?new Set([
  'bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354','bosa:3b81ba48-e9f4-4d6f-9c05-5ba699c7f209',
  'bosa:834b6f23-3906-4589-a0e7-afae9c91d26a','bosa:2057ca19-d4bd-43d6-bf36-bbc34ec2f71f',
  'bosa:d132e2d7-29b4-4489-9e26-70db1504fa8f']):null;
 const report=[];let changed=0;
 // Le portail BOSA applique des contrôles différents aux appels Node directs.
 // La consultation navigateur ne contourne aucune connexion : pages et API publiques uniquement.
 const useBrowser=process.argv.includes('--browser');
 const browser=useBrowser?await require('playwright').chromium.launch({headless:true}):null;
 const context=browser?await browser.newContext({locale:'fr-BE'}):null;
 try{
 for(let i=0;i<source.items.length;i++){
  const m=source.items[i];
  if(m.source!=='BOSA'||selected&&!selected.has(m.id))continue;
  let fetcher=fetch,page=null;
  if(context){
   page=await context.newPage();
   try{
    await page.goto('https://www.publicprocurement.be/publication-workspaces/'+m.publicationWorkspaceId+'/documents',{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForTimeout(600);
    fetcher=async function(url){
     const v=await page.evaluate(async url=>{
      const res=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});
      return {ok:res.ok,status:res.status,data:res.ok?await res.json():null};
     },url);
     return {ok:v.ok,status:v.status,json:async()=>v.data};
    };
   }catch(e){fetcher=async()=>({ok:false,status:0})}
  }
  const r=await enrichRecord(m,fetcher);
  if(r.result==='enriched'){source.items[i]=r.market;changed++}
  report.push({id:m.id,result:r.result,changes:r.changes||[],endpointStatus:r.endpointStatus||null});
  console.log(m.id+' '+r.result+' '+(r.changes||[]).join(','));
  if(page)await page.close();
 }
 }finally{if(browser)await browser.close()}
 const dest=path.resolve(__dirname,'../audit');fs.mkdirSync(dest,{recursive:true});
 const output=path.join(dest,'phase3a-enriched-data.json');
 const control=path.join(dest,'phase3a-enrichment-report.json');
 fs.writeFileSync(output,JSON.stringify(source,null,2)+'\n');
 fs.writeFileSync(control,JSON.stringify({at:new Date().toISOString(),originalCount:source.items.length,enrichedCount:changed,results:report},null,2));
 if(process.argv.includes('--write')&&!process.argv.includes('--sample')&&changed>0)fs.writeFileSync(SOURCE,JSON.stringify(source,null,2)+'\n');
 console.log('RESULT '+JSON.stringify({markets:source.items.length,enriched:changed,sourceFileWritten:process.argv.includes('--write')&&!process.argv.includes('--sample')&&changed>0}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
module.exports={endpoints,jsonArray,safeExternal,normalizeDocuments,normalizeConsultationUrls,enrichRecord};
