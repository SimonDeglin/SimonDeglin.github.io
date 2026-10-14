/* Observer l'interface BOSA publique, sans s'authentifier ni contourner un accès.
   Les adresses, paramètres de filtrage et statuts d'accès publiquement exposés
   sont consignés. Aucun cookie ni jeton n'est enregistré. */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const path='marcheradar/tools/bosa-browser-report.json';
const report={generated_at:new Date().toISOString(),browser:'chromium',url:null,request_samples:[],responses:[],page_text:'',errors:[],access:'not_checked'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({locale:'fr-BE',timezoneId:'Europe/Brussels',viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  const responseTasks=[];
  p.on('request',req=>{
   if(req.url().includes('/api/sea/')&&report.request_samples.length<30){
    const payload=req.postData()||'';
    report.request_samples.push({url:req.url(),method:req.method(),payload:payload.slice(0,2800)});
   }
  });
  p.on('response',res=>{
   if(res.url().includes('/api/sea/')){
    const task=(async()=>{
     const o={url:res.url(),status:res.status(),type:res.headers()['content-type']||null};
     try{
      const json=await res.json();
      const arr=Array.isArray(json?.publications)?json.publications:Array.isArray(json?.items)?json.items:[];
      o.totalCount=json?.totalCount??json?.total??null;
      o.keys=Object.keys(json||{}).slice(0,35);
      o.publicationSample=arr.slice(0,3).map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>/id|reference|name|title|notice|date|deadline|organisation|nature|cpv|url/i.test(k)).slice(0,16)));
     }catch(e){o.jsonError=String(e.message).slice(0,100)}
     if(report.responses.length<30)report.responses.push(o);
    })();
    responseTasks.push(task);
   }
  });
  await p.goto('https://www.publicprocurement.be/bda',{waitUntil:'domcontentloaded',timeout:30000});
  await p.waitForTimeout(15000);
  report.url=p.url();report.page_text=(await p.locator('body').innerText()).slice(0,3200);
  if(report.responses.some(x=>x.status===200&&x.url.includes('/search/publications')))report.access='public_search_working';
  else report.access=report.responses.length?'api_calls_observed':'no_api_calls';
  await Promise.allSettled(responseTasks);
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>report.errors.push(String(e.message||e))).finally(()=>{
 fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');
 console.log('BOSA browser probe',JSON.stringify({status:report.access,requests:report.request_samples.length,responses:report.responses.length,errors:report.errors}));
});
