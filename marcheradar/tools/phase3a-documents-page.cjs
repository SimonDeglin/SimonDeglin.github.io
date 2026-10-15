'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const markets=d.items.filter(x=>x.documentsPageSource==='official_page_link_observed_2026-10-15');
(async()=>{
 if(markets.length!==5)throw Error('Expected five validated sample links');
 const browser=await chromium.launch({headless:true});
 const rows=[];
 try{
  const cx=await browser.newContext({locale:'fr-BE',viewport:{width:1440,height:900}});
  for(const m of markets){
   const page=await cx.newPage();const endpoints=[];const row={id:m.id,url:m.documentsPageUrl,status:null,visibleText:'',links:[],apiCalls:[],issues:[]};
   page.on('response',res=>{
    const u=res.url();
    if(u.startsWith('https://www.publicprocurement.be/api/')&&endpoints.length<80)endpoints.push({status:res.status(),url:u.split('?')[0]});
   });
   try{
    const res=await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:25000});row.status=res?.status()||null;
    await page.waitForTimeout(2500);
    row.visibleText=(await page.locator('body').innerText()).slice(0,2500);
    row.links=await page.locator('a[href]').evaluateAll(nodes=>nodes.filter(a=>/\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i.test(a.href)).slice(0,50).map(a=>({text:(a.innerText||'').trim(),url:a.href})));
   }catch(e){row.issues.push(String(e.name||'Error'))}
   row.apiCalls=[...new Map(endpoints.map(x=>[x.url,x])).values()];
   rows.push(row);console.log(row.id+' status='+row.status+' files='+row.links.length+' apis='+row.apiCalls.length);
   await page.close();
  }
 }finally{await browser.close()}
 const folder=path.join(__dirname,'..','audit');fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'phase3a-documents-page.json'),JSON.stringify({at:new Date().toISOString(),rows},null,2));
 console.log('TOTAL '+JSON.stringify({tested:rows.length,visibleFileLinks:rows.reduce((n,x)=>n+x.links.length,0),apiResponses:rows.reduce((n,x)=>n+x.apiCalls.length,0)}));
})().catch(e=>{console.error(e);process.exitCode=1});
