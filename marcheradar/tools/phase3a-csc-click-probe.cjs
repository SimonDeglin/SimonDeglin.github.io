/* Phase 3A suite: observer une tentative de consultation du CSC bathymétrie.
 * Seule l'interface PUBLIQUE est utilisée, sans contournement d'authentification.
 * Aucune pièce n'est ajoutée au dépôt ou publiée sur GitHub Pages.
 */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','audit');
const workspace='0765b50e-85f5-4aae-b2ca-2ed66c14e354';
const target='2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf';
const url='https://www.publicprocurement.be/publication-workspaces/'+workspace+'/documents';
function scrub(url){try{let u=new URL(url);return u.origin+u.pathname}catch(e){return ''}}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const result={time:new Date().toISOString(),source:url,document:target,pageStatus:null,found:false,container:'',actions:[],responses:[],downloadEvents:[],clickResult:'not_attempted',errors:[]};
 try{
  const ctx=await browser.newContext({locale:'fr-BE',acceptDownloads:true,viewport:{width:1366,height:850}});
  const page=await ctx.newPage();
  page.on('pageerror',error=>result.errors.push('pageerror: '+error.name));
  page.on('download',download=>result.downloadEvents.push({filename:download.suggestedFilename(),url:scrub(download.url())}));
  page.on('response',res=>{
   const uri=scrub(res.url());
   if(!uri.startsWith('https://www.publicprocurement.be/'))return;
   if(!/(document|download|file|storage|blob|workspace|attachment)/i.test(uri))return;
   if(result.responses.length<100)result.responses.push({method:res.request().method(),status:res.status(),url:uri,type:res.headers()['content-type']||''});
  });
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:28000});
   result.pageStatus=response?.status()||null;
   await page.waitForTimeout(4000);
   const label=page.getByText(target,{exact:false});
   result.found=(await label.count())>0;
   if(result.found){
    const el=label.first();
    const parent=await el.evaluate(e=>{
     const container=e.closest('tr')||e.closest('[role=row]')||e.parentElement?.parentElement?.parentElement||e.parentElement;
     return {html:(container?.outerHTML||'').slice(0,7000),text:(container?.innerText||'').slice(0,600)};
    });
    result.container=parent.html;
    const nearby=el.locator('xpath=ancestor::*[self::tr or @role="row" or contains(@class,"document")][1]');
    const scope=await nearby.count()?nearby:el.locator('xpath=../..');
    result.actions=await scope.locator('a,button,[role="button"]').evaluateAll(elements=>elements.slice(0,35).map(x=>({tag:x.tagName,title:x.getAttribute('title'),aria:x.getAttribute('aria-label'),text:(x.innerText||'').trim().slice(0,100),href:x.tagName==='A'?scrub(x.href):null})));
    const controls=scope.locator('button,[role="button"],a');
    const count=await controls.count();
    let selected=null;
    for(let i=0;i<Math.min(count,30);i++){
     const c=controls.nth(i);
     const score=await c.evaluate(x=>[(x.innerText||''),x.getAttribute('title')||'',x.getAttribute('aria-label')||''].join(' ').toLowerCase());
     if(/download|télécharg|telecharg|télévers|downloaden|ouvrir|consulter/.test(score)){selected=c;break}
    }
    if(selected){
     try{await selected.click({timeout:9000});result.clickResult='clicked_download_action'}catch(e){result.clickResult='action_failed_'+String(e.name)}
    }else{
     try{await el.click({timeout:9000});result.clickResult='clicked_document_label'}catch(e){result.clickResult='label_failed_'+String(e.name)}
    }
    await page.waitForTimeout(4500);
   }
  }catch(e){result.errors.push('navigation: '+String(e.name)+': '+String(e.message).slice(0,150))}
  await ctx.close();
 }finally{await browser.close()}
 result.responses=[...new Map(result.responses.map(x=>[x.method+x.url+x.status,x])).values()];
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'phase3a-csc-click-probe.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({pageStatus:result.pageStatus,found:result.found,actions:result.actions,clickResult:result.clickResult,downloadEvents:result.downloadEvents,responses:result.responses.slice(-20),errors:result.errors},null,2));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
