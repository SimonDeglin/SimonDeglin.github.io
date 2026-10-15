'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const markets=data.items.filter(x=>x.documentsPageSource==='official_page_link_observed_2026-10-15');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let out=[];
 try{
  const context=await browser.newContext({locale:'fr-BE'});
  for(const m of markets){
   const page=await context.newPage();let payloads=[];
   page.on('response',async response=>{
    if(!response.url().includes('/api/dos/publication-workspaces/')||!/\/(documents|urls)(?:\?|$)/.test(response.url()))return;
    try{
     let obj=await response.json();
     payloads.push({endpoint:response.url(),status:response.status(),kind:Array.isArray(obj)?'array':typeof obj,payload:obj});
    }catch(e){payloads.push({endpoint:response.url(),status:response.status(),unreadable:true})}
   });
   try{await page.goto(m.documentsPageUrl,{waitUntil:'domcontentloaded',timeout:25000});await page.waitForTimeout(3500)}catch(e){payloads.push({error:e.name})}
   const result={id:m.id,docPage:m.documentsPageUrl,payloads};
   out.push(result);console.log(m.id+' '+JSON.stringify(payloads.map(x=>({status:x.status,endpoint:x.endpoint,keys:x.payload&&typeof x.payload==='object'?Object.keys(x.payload):[],length:Array.isArray(x.payload)?x.payload.length:null}))));
   await page.close();
  }
 }finally{await browser.close()}
 const dir=path.join(__dirname,'..','audit');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'phase3a-api-response-sample.json'),JSON.stringify({at:new Date().toISOString(),sample:out},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
