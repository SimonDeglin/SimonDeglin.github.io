/* V4-C — récupération vérifiée des dates limites sur les pages officielles BOSA.
 * GET visible public only, no authentication, no dates inferred from snippets.
 * File data.json is written only when explicitly run with --write.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const {validate,updateMarket}=require('./bosa-deadline.cjs');
const dataPath=path.join(__dirname,'..','data.json');
const sampleIds=new Set([
 'bosa:7f4255eb-6857-4d85-85e5-4aac8b0fe4e8',
 'bosa:3d464fb7-ccf9-43c6-97dd-54e641b17836',
 'bosa:13f54116-eb7b-45cb-b58c-24247e4bee51',
 'bosa:e26a641b-92f3-441a-b4ba-e23435579289',
 'bosa:9adfd516-1615-4a05-8bc5-347c42646a57'
]);
async function launch(){
 const find=cp.spawnSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'});
 const bin=(find.stdout||'').trim().split('\n')[0];
 if(!bin)throw Error('Chrome public indisponible');
 return chromium.launch({headless:true,executablePath:bin,args:['--disable-dev-shm-usage','--no-sandbox']});
}
async function inspect(page,m){
 const apiPath='/api/dos/publication-workspaces/'+m.publicationWorkspaceId;
 const pending=[],seen=[];
 page.on('response',res=>{
  let u;try{u=new URL(res.url())}catch(e){return}
  if(u.hostname!=='www.publicprocurement.be'||u.pathname!==apiPath||res.status()!==200)return;
  pending.push((async()=>{
   try{
    const contentType=res.headers()['content-type']||'';
    if(!contentType.includes('json'))return;
    seen.push(await res.json());
   }catch(e){}
  })());
 });
 const url='https://www.publicprocurement.be/publication-workspaces/'+m.publicationWorkspaceId+'/general';
 const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 if(r?.status()!==200)return {ok:false,why:'official_page_http_'+(r?.status()||'no_status')};
 // Wait only for normal page rendering and passive official API responses.
 await page.waitForFunction(()=>document.body?.innerText?.includes('Date limite de soumission'),null,{timeout:10000}).catch(()=>{});
 await page.waitForTimeout(500);
 await Promise.allSettled(pending);
 const body=(await page.locator('body').innerText()).slice(0,65000);
 if(!seen.length)return {ok:false,why:'missing_public_workspace_json'};
 return validate(seen.at(-1),m.publicationWorkspaceId,body);
}
async function run(){
 const source=JSON.parse(fs.readFileSync(dataPath,'utf8'));
 const sample=process.argv.includes('--sample');
 const queue=source.items.filter(m=>m.source==='BOSA'&&m.noticeKind==='competition'&&m.publicationWorkspaceId&&(!sample||sampleIds.has(m.id)));
 const oldIds=source.items.map(m=>m.id);
 const report={at:new Date().toISOString(),tested:0,verified:0,updated:0,unchanged:0,failures:[],
  note:'Only a matching public UI, current official workspace vault and Europe/Brussels offset are accepted.'};
 const browser=await launch();
 try{
  const ctx=await browser.newContext({locale:'fr-BE',viewport:{width:1400,height:900}});
  for(const m of queue){
   const page=await ctx.newPage();let result;
   try{result=await inspect(page,m)}catch(e){result={ok:false,why:'navigation_'+String(e.name||'error')}}
   finally{await page.close()}
   report.tested++;
   if(!result.ok){report.failures.push({id:m.id,why:result.why});console.log('BOSA_DEADLINE_SKIP '+m.id+' '+result.why);continue}
   report.verified++;
   const idx=source.items.findIndex(x=>x.id===m.id);
   const merge=updateMarket(source.items[idx],result,report.at);
   if(merge.changed){source.items[idx]=merge.market;report.updated++}else report.unchanged++;
   console.log('BOSA_DEADLINE_OK '+m.id+' '+result.dateTime+' '+merge.why);
   await new Promise(done=>setTimeout(done,200));
  }
 }finally{await browser.close()}
 const newIds=source.items.map(m=>m.id);
 if(newIds.length!==oldIds.length||newIds.some((x,i)=>x!==oldIds[i]))throw Error('Market identifiers changed, stop');
 const dir=path.join(__dirname,'..','audit');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'v4c-bosa-deadlines-enrichment.json'),JSON.stringify(report,null,2)+'\n');
 if(process.argv.includes('--write')&&report.updated){
  fs.writeFileSync(dataPath,JSON.stringify(source,null,2)+'\n');
 }
 console.log('RESULT '+JSON.stringify({sample,tested:report.tested,verified:report.verified,updated:report.updated,unchanged:report.unchanged,errors:report.failures.length,wrote:process.argv.includes('--write')&&report.updated>0}));
 if(sample&&report.verified<4)process.exitCode=1;
}
if(require.main===module)run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
module.exports={inspect,run};
