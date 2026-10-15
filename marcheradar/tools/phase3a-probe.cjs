/* Phase 3A : probe strictement public, temporaire. Aucun document non verifie n'est importe. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'data.json'),'utf8'));
const refs=['682034-2026','674146-2026','549850-2026','656876-2026','490060-2026',
 '0765b50e-85f5-4aae-b2ca-2ed66c14e354','3b81ba48-e9f4-4d6f-9c05-5ba699c7f209',
 '834b6f23-3906-4589-a0e7-afae9c91d26a','2057ca19-d4bd-43d6-bf36-bbc34ec2f71f',
 'communal:7092b8f35c924d8b04e4'];
const selected=refs.map(id=>data.items.find(x=>x.publicationNumber===id||x.publicationWorkspaceId===id||x.id===id)).filter(Boolean);
if(selected.length!==10)throw Error('Pilot must contain exactly ten real markets, found '+selected.length);
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
     e.direct={http:res.status,type:res.type,bytes:res.bytes,final:res.url,extract:res.status===200?review(res.body):null,preview:clean(res.body.slice(0,650))};
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
      // Document tab is public navigation, not a guessed file download.
      try{
       await page.goto(t.url.replace(/\/general(?:[?#].*)?$/,'/documents'),{waitUntil:'domcontentloaded',timeout:24000});
       await page.waitForTimeout(3000);
       e.documentsTab=await page.evaluate(()=>({
        title:document.title,text:(document.body.innerText||'').slice(0,1300),
        anchors:[...document.querySelectorAll('a[href]')].slice(0,35).map(a=>({text:a.innerText.slice(0,80),href:a.href})),
        buttons:[...document.querySelectorAll('button')].map(x=>({text:x.innerText.trim().slice(0,55),aria:x.getAttribute('aria-label')})).filter(x=>x.text||x.aria).slice(0,35),
        rows:[...document.querySelectorAll('tr,[role="row"]')].slice(0,80).map(r=>r.innerText.slice(0,150))
       }));
      }catch(docErr){e.documentsTab={error:String(docErr.message).slice(0,180)}}
      // Verify what the public interface really exposes, without inventing a direct file URL.
      if(e.documentsTab&&!e.documentsTab.error){
       try{
        const btn=page.getByRole('button',{name:/Télécharger la dernière version/i}).first();
        if(await btn.count()){
         const pending=page.waitForEvent('download',{timeout:8000});
         await btn.click({timeout:8000});
         const download=await pending;
         e.sampleDownload={suggestedFilename:download.suggestedFilename(),officialOrigin:new URL(download.url()).hostname,downloadEvent:true};
         await download.cancel().catch(()=>{});
        }else e.sampleDownload={downloadEvent:false,reason:'Aucun bouton de téléchargement direct visible'};
       }catch(err){e.sampleDownload={downloadEvent:false,reason:String(err.message).slice(0,170)}}
      }
      await context.close();
     }catch(err){e.browser={error:String(err.message).slice(0,180)}}
    }
   }
   // TED API, only on one pilot notice. A search response is stronger than a 202 HTML rendering page.
   if(m.source==='TED'&&m.publicationNumber==='682034-2026'){
    const payload={query:'ND = '+m.publicationNumber,fields:[
      'publication-number','notice-title','deadline-receipt-tender-date-lot',
      'deadline-receipt-tender-time-lot','links'],scope:'ALL',limit:3,page:1};
    try{
     const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
     const resp=await fetch('https://api.ted.europa.eu/v3/notices/search',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload),signal:ctrl.signal
     });
     const raw=(await resp.text()).slice(0,2300);clearTimeout(timer);
     e.tedApi={http:resp.status,data:raw};
    }catch(err){e.tedApi={error:String(err.message).slice(0,150)}}
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
