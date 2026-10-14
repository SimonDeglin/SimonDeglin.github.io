'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const output=path.resolve(__dirname,'../bosa-browser-diagnostic.json');
const report={at:new Date().toISOString(),method:'Public navigateur sans authentification',target:'https://www.publicprocurement.be/bda',status:'not-tested',errors:[],events:[]};
(async()=>{
 let browser;
 try{
  const {chromium}=require('playwright-core');
  let binary='';
  try{binary=cp.execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim().split('\n')[0]}catch(e){}
  report.browserBinary=binary?path.basename(binary):'not-found';
  const cfg={headless:true,args:['--disable-dev-shm-usage','--no-sandbox']};
  if(binary)cfg.executablePath=binary;
  else cfg.channel='chrome';
  browser=await chromium.launch(cfg);
  const page=await browser.newPage({locale:'fr-BE',timezoneId:'Europe/Brussels',viewport:{width:1280,height:900}});
  page.on('response',r=>{try{
   const url=new URL(r.url());
   if(url.hostname==='www.publicprocurement.be'&&/api\//.test(url.pathname)&&report.events.length<25)
    report.events.push({route:url.pathname.slice(0,180),status:r.status(),method:r.request().method()});
  }catch(e){}});
  const response=await page.goto(report.target,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForTimeout(5500);
  report.httpStatus=response?.status()||null;
  report.finalUrl=page.url();
  const data=await page.evaluate(()=>{
   const body=document.body?.innerText||'';
   const links=[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText.slice(0,90),href:a.href}))
    .filter(a=>a.href.includes('publicprocurement.be')).slice(0,25);
   const inputs=[...document.querySelectorAll('input')].map(x=>({placeholder:x.placeholder||'',type:x.type||''})).slice(0,15);
   return {bodyLength:body.length,bodyExcerpt:body.slice(0,3900),links,inputs};
  });
  report.page=data;
  report.status=data.bodyLength>350&&/Bulletin|adjudications|Tender|Publication|search|Rechercher/i.test(data.bodyExcerpt)?'public-bulletin-visible':'frontend-not-loaded';
 }catch(e){report.status='browser-failed';report.errors.push(String(e.message||e).slice(0,400))}
 finally{try{await browser?.close()}catch(e){}}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
 console.log('BOSA_BROWSER_DIAGNOSTIC',JSON.stringify({status:report.status,http:report.httpStatus,bodyLength:report.page?.bodyLength,events:report.events.length}));
})().catch(e=>{report.errors.push(String(e.message||e).slice(0,180));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8')});
