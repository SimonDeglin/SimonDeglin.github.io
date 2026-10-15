/* Phase 3A : probe strictement public, temporaire. Aucun document non verifie n'est importe. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'data.json'),'utf8'));
const refs=['682034-2026','674146-2026','549850-2026','656876-2026','490060-2026',
 '0765b50e-85f5-4aae-b2ca-2ed66c14e354','3b81ba48-e9f4-4d6f-9c05-5ba699c7f209',
 '834b6f23-3906-4589-a0e7-afae9c91d26a','2057ca19-d4bd-43d6-bf36-bbc34ec2f71f',
 'communal:2b207c11f31dd9f8'];
const selected=refs.map(id=>data.items.find(x=>x.publicationNumber===id||x.publicationWorkspaceId===id||x.id===id)).filter(Boolean);
const budget=Number(process.env.PROBE_LIMIT||10);
const out=[];
const allowedDomains=new Set(['ted.europa.eu','www.publicprocurement.be','www.chaudfontaine.be']);
function safeURL(x){
 try{const u=new URL(x);return u.protocol==='https:'&&allowedDomains.has(u.hostname)?u.href:''}catch{return ''}
}
async function get(url,limit=1200000){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),14000);
 try{
  const r=await fetch(url,{signal:c.signal,headers:{Accept:'text/xml,application/xml,text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'User-Agent':'KDRIX-PublicTenderMetadataAudit/0.1'}});
  let buf=Buffer.alloc(0);if(r.body)for await (const x of r.body){buf=Buffer.concat([buf,x]);if(buf.length>limit){await r.body.cancel().catch(()=>{});break}}
  return {status:r.status,url:r.url,type:r.headers.get('content-type')||'',bytes:buf.length,body:buf.toString('utf8')};
 }finally{clearTimeout(timer)}
}
function clean(s){return String(s||'').replace(/\s+/g,' ').slice(0,150)}
function review(text){
 const dates=[...String(text).matchAll(/<(?:\w+:)?(?:EndDate|EndTime|TenderSubmissionDeadlinePeriod|CallForTendersDocumentReference|ElectronicSubmissionUrl|URI)[^>]*>/gi)].slice(0,30).map(x=>x[0]);
 const urls=[...new Set((String(text).match(/https?:\/\/[^\s"<>{}]{10,240}/gi)||[]).map(s=>s.replace(/&amp;/g,'&')))].filter(x=>/document|procurement|tender|csc|pdf|download|contract/i.test(x)).slice(0,22);
 return {names:dates,external_urls:urls};
}
(async()=>{
 let browser=null;
 if(process.env.PROBE_BROWSER==='1'){
  const {chromium}=require('playwright');
  browser=await chromium.launch({headless:true});
 }
 try{
  for(const m of selected.slice(0,budget)){
   const e={id:m.id,source:m.source,title:m.title.slice(0,75),oldDeadline:m.deadline||'',noticeKind:m.noticeKind||''};
   const targets=m.source==='TED'?
    [{kind:'xml',url:'https://ted.europa.eu/en/notice/'+m.publicationNumber+'/xml'}]:
    m.source==='BOSA'?[{kind:'workspace',url:m.url}]:[{kind:'council',url:m.sourceDocument||m.url}];
   for(const t of targets){
    if(!safeURL(t.url)){e.error='domain not allowed';continue}
    try{
     const res=await get(t.url);
     e.direct={http:res.status,type:res.type,bytes:res.bytes,final:res.url,extract:res.status===200?review(res.body):null,preview:res.status===200?clean(res.body.slice(0,400)):''};
    }catch(err){e.direct={error:String(err.message).slice(0,180)}}
    if(browser&&m.source==='BOSA'){
     try{
      const context=await browser.newContext({locale:'fr-BE',timezoneId:'Europe/Brussels'});
      const page=await context.newPage();
      await page.goto(t.url,{waitUntil:'domcontentloaded',timeout:24000});
      await page.waitForTimeout(2800);
      e.browser=await page.evaluate(()=>({
       title:document.title,header:(document.querySelector('h1')?.innerText||'').slice(0,180),
       text:(document.body.innerText||'').slice(0,600),
       anchors:[...document.querySelectorAll('a[href]')].filter(a=>/document|pdf|annexe|cahier|télécharg|bestek|download/i.test(a.href+' '+a.innerText)).slice(0,22).map(a=>({text:a.innerText.slice(0,65),href:a.href})),
       buttons:[...document.querySelectorAll('button')].map(x=>x.innerText.trim().slice(0,50)).filter(Boolean).slice(0,30)
      }));
      await context.close();
     }catch(err){e.browser={error:String(err.message).slice(0,180)}}
    }
   }
   out.push(e);
   console.log('PROBE_RESULT',JSON.stringify(e));
   await new Promise(r=>setTimeout(r,350));
  }
 }finally{if(browser)await browser.close()}
 const folder=path.join(ROOT,'pilot');
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'phase3a-probe-results.json'),JSON.stringify({generated_at:new Date().toISOString(),sample:out},null,2)+'\n');
 console.log('PROBE_SUMMARY',JSON.stringify({total:out.length,directOK:out.filter(x=>x.direct?.http===200).length,browserAccessible:out.filter(x=>x.browser&&!x.browser.error).length}));
})().catch(e=>{console.error('PROBE_FATAL',e.stack||e);process.exitCode=1});
