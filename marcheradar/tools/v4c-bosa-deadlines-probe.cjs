/* Marché Radar V4-C — audit PASSIF des dates limites BOSA.
 * Aucune date n'est copiée vers data.json sans confirmation explicite.
 * Seules les pages et API déclenchées librement par le navigateur sont observées.
 */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const ids=[
 'bosa:7f4255eb-6857-4d85-85e5-4aac8b0fe4e8',
 'bosa:3d464fb7-ccf9-43c6-97dd-54e641b17836',
 'bosa:13f54116-eb7b-45cb-b58c-24247e4bee51',
 'bosa:e26a641b-92f3-441a-b4ba-e23435579289',
 'bosa:9adfd516-1615-4a05-8bc5-347c42646a57'
];
const wanted=/(?:submission.*deadline|deadline.*submission|tender.*deadline|bid.*deadline|offer.*deadline|closing.*date|time.*limit.*receipt|date.*limite|date.*remise|date.*soumission|date.*reception|uiterste.*indien)/i;
const dateShape=/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:[T ]\d{2}:\d{2})?|\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/;
function pick(obj){
 const out=[];
 function walk(value,key,depth){
  if(depth>8||out.length>40||value==null)return;
  if(Array.isArray(value)){value.slice(0,30).forEach((x,i)=>walk(x,key+'['+i+']',depth+1));return}
  if(typeof value==='object'){
   Object.keys(value).slice(0,130).forEach(k=>walk(value[k],key+'.'+k,depth+1));return
  }
  const text=String(value);
  if(wanted.test(key)&&dateShape.test(text)&&text.length<250)
   out.push({path:key,value:text.slice(0,120)});
 }
 walk(obj,'response',0);return out;
}
(async()=>{
 const samples=ids.map(id=>data.items.find(m=>m.id===id)).filter(Boolean);
 if(samples.length<3)throw Error('Échantillon BOSA insuffisant');
 const browser=await chromium.launch({headless:true});
 const rows=[];
 try{
  const context=await browser.newContext({locale:'fr-BE',viewport:{width:1400,height:900}});
  for(const m of samples){
   const page=await context.newPage(),candidates=[],responses=[],pending=[];
   const pageUrl='https://www.publicprocurement.be/publication-workspaces/'+m.publicationWorkspaceId+'/general';
   page.on('response',res=>{
    const uri=res.url();
    if(!uri.startsWith('https://www.publicprocurement.be/api/'))return;
    const p=(async()=>{
     const type=res.headers()['content-type']||'';
     if(/json/i.test(type)&&res.status()===200){
      try{
       const obj=await res.json();
       const vals=pick(obj);
       if(vals.length)candidates.push({endpoint:new URL(uri).pathname,values:vals});
      }catch(e){}
     }
     if(responses.length<100)responses.push({endpoint:new URL(uri).pathname,status:res.status(),type:type.slice(0,48)});
    })();
    pending.push(p);
   });
   const row={id:m.id,title:m.title,source:m.source,publication:m.publication,existingDeadline:m.deadline||null,
    generalUrl:pageUrl,http:null,portalSnippets:[],apiFields:[],apiResponses:[],issues:[]};
   try{
    const response=await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:30000});
    row.http=response?.status()||null;
    await page.waitForTimeout(3800);
    const body=(await page.locator('body').innerText()).slice(0,90000);
    const regex=/(?:date\s+limite\s+(?:de\s+)?(?:soumission|d[eé]p[oô]t|remise|r[eé]ception)|deadline\s+(?:for|of)?\s*(?:submission|offers|tenders)|uiterste\s+(?:datum|indieningsdatum)|limite\s+de\s+r[eé]ception)/ig;
    let match;
    while((match=regex.exec(body))&&row.portalSnippets.length<12){
     row.portalSnippets.push(body.slice(Math.max(0,match.index-35),Math.min(body.length,match.index+190)).replace(/\s+/g,' ').slice(0,235));
    }
   }catch(e){row.issues.push(String(e.name||'Error'))}
   await Promise.allSettled(pending);
   row.apiFields=candidates.slice(0,30);
   row.apiResponses=responses.slice(0,55);
   rows.push(row);
   console.log('BOSA_DATE_PROBE '+m.id+' page='+row.http+' UI='+row.portalSnippets.length+' JSON_FIELDS='+candidates.reduce((n,x)=>n+x.values.length,0));
   await page.close();
  }
 }finally{await browser.close()}
 const report={generatedAt:new Date().toISOString(),sampleSize:rows.length,
  verifiedDeadlineCount:0,
  note:'DIAGNOSTIC only. A field candidate or visible snippet does not certify an active official deadline; no production data changed.',rows};
 const dir=path.join(__dirname,'..','audit');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'v4c-bosa-deadlines-probe.json'),JSON.stringify(report,null,2)+'\n');
 console.log('RESULT '+JSON.stringify({sample:rows.length,uiHits:rows.filter(r=>r.portalSnippets.length).length,jsonHits:rows.filter(r=>r.apiFields.length).length,http200:rows.filter(r=>r.http===200).length}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
