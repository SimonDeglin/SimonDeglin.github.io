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
  page.on('response',async r=>{try{
   const url=new URL(r.url());
   if(url.hostname==='www.publicprocurement.be'&&/api\//.test(url.pathname)&&report.events.length<25){
    const item={route:url.pathname.slice(0,180),status:r.status(),method:r.request().method()};
    if(url.pathname==='/api/sea/search/publications' && r.status()===200){
     const request=r.request();let input;
     try{input=request.postDataJSON()}catch(e){input=request.postData()}
     item.requestBody=input;
     try{
      const response=await r.json();
      item.responseKeys=Object.keys(response||{});
      item.responseCounts=Object.fromEntries(Object.entries(response||{}).filter(([k,v])=>typeof v==='number'));
      const arrays=Object.entries(response||{}).filter(([k,v])=>Array.isArray(v));
      item.arrays=arrays.map(([name,v])=>({name,count:v.length,firstKeys:v[0]?Object.keys(v[0]).slice(0,50):[]}));
      const first=arrays.map(([k,v])=>v[0]).find(Boolean);
      if(first)item.firstPublication=Object.fromEntries(Object.entries(first).filter(([k,v])=>typeof v==='string'||typeof v==='number').slice(0,40));
      if(first)item.firstNested=Object.fromEntries(Object.entries(first).filter(([k,v])=>v&&typeof v==='object').map(([k,v])=>[k,{type:Array.isArray(v)?'array':'object',keys:Array.isArray(v)?Object.keys(v[0]||{}):Object.keys(v),sample:JSON.stringify(v).slice(0,1900)}]).slice(0,12));
     }catch(e){item.parseError=String(e.message||e).slice(0,150)}
    }
    report.events.push(item);
   }
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
  try{
   report.pageTwoViaFetch=await page.evaluate(async()=>{
    const response=await fetch('/api/sea/search/publications',{
     method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json','Accept':'application/json'},
     body:JSON.stringify({includeOrganisationChildren:true,page:2,pageSize:25})
    });
    const txt=await response.text();
    let parsed;try{parsed=JSON.parse(txt)}catch(e){}
    return {httpStatus:response.status,keys:Object.keys(parsed||{}),count:parsed?.publications?.length||0,
      sample:parsed?.publications?.[0]&&Object.fromEntries(Object.entries(parsed.publications[0]).filter(([k,v])=>typeof v==='string').slice(0,8))};
   });
  }catch(e){report.pageTwoViaFetch={error:String(e.message||e).slice(0,170)}}
  report.status=data.bodyLength>350&&/Bulletin|adjudications|Tender|Publication|search|Rechercher/i.test(data.bodyExcerpt)?'public-bulletin-visible':'frontend-not-loaded';
 }catch(e){report.status='browser-failed';report.errors.push(String(e.message||e).slice(0,400))}
 finally{try{await browser?.close()}catch(e){}}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
 console.log('BOSA_BROWSER_DIAGNOSTIC',JSON.stringify({status:report.status,http:report.httpStatus,bodyLength:report.page?.bodyLength,events:report.events.length}));
})().catch(e=>{report.errors.push(String(e.message||e).slice(0,180));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8')});
