'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {ids}=require('./phase3a-diagnostic.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const names=['www.publicprocurement.be','ted.europa.eu'];
function keep(url){
 try{const x=new URL(url);return x.protocol==='https:'&&names.includes(x.hostname)}catch(e){return false}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const findings=[];
 try{
  const context=await browser.newContext({locale:'fr-BE',viewport:{width:1400,height:900},acceptDownloads:false});
  for(const id of ids){
   const m=data.items.find(x=>x.id===id);if(!m)throw Error('Missing market '+id);
   const page=await context.newPage(),network=[];
   const out={id,title:m.title,source:m.source,homepage:m.url,status:'not_visited',documentCandidates:[],requests:[],buttons:[],warnings:[]};
   page.on('request',req=>{
    let u=req.url();
    if(keep(u)&&/(document|attachment|file|download|annex|specification|csc|notice|publication)/i.test(u)){
     if(network.length<120)network.push({method:req.method(),url:u.split('?')[0]});
    }
   });
   try{
    const response=await page.goto(m.url,{waitUntil:'domcontentloaded',timeout:20000});
    out.status=response?response.status():'no_response';
    await page.waitForTimeout(2000);
    out.title=await page.title();
    const anchors=await page.locator('a[href]').evaluateAll(nodes=>nodes.slice(0,1200).map(n=>({href:n.href,text:(n.innerText||n.textContent||'').trim().slice(0,120)})));
    out.documentCandidates=anchors.filter(x=>keep(x.href)&&(/\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i.test(x.href)||/(cahier|document|annexe|download|télécharg|pièces du marché)/i.test(x.text))).slice(0,30);
    out.buttons=await page.locator('button').evaluateAll(nodes=>nodes.slice(0,100).map(n=>(n.innerText||n.getAttribute('aria-label')||'').trim().slice(0,70)).filter(Boolean));
    if(out.buttons.some(x=>/document|pièce|annexe/i.test(x)))out.warnings.push('Document UI detected, manual or more targeted navigation may be necessary');
   }catch(e){out.warnings.push(String(e.name||'Error'));out.status='navigation_error'}
   out.requests=[...new Map(network.map(x=>[x.method+' '+x.url,x])).values()].slice(0,80);
   findings.push(out);console.log(id+' '+out.status+' candidateLinks='+out.documentCandidates.length+' relevantRequests='+out.requests.length);
   await page.close();
  }
 }finally{await browser.close()}
 const dir=path.join(__dirname,'..','audit');fs.mkdirSync(dir,{recursive:true});
 const payload={generatedAt:new Date().toISOString(),method:'Browser rendering and passive monitoring; no authentication, no download, no fake verified deadlines',findings};
 fs.writeFileSync(path.join(dir,'phase3a-browser-probe.json'),JSON.stringify(payload,null,2));
 console.log('RESULT '+JSON.stringify({count:findings.length,withDocumentCandidates:findings.filter(x=>x.documentCandidates.length).length,withRequestCandidates:findings.filter(x=>x.requests.length).length}));
})().catch(e=>{console.error(e);process.exitCode=1});
