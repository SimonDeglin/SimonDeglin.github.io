'use strict';
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data.json'),'utf8'));
const ids=['bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354','bosa:834b6f23-3906-4589-a0e7-afae9c91d26a','bosa:2057ca19-d4bd-43d6-bf36-bbc34ec2f71f','bosa:3b81ba48-e9f4-4d6f-9c05-5ba699c7f209','bosa:d132e2d7-29b4-4489-9e26-70db1504fa8f','ted:682034-2026','ted:685167-2026','ted:674146-2026','ted:557588-2026','ted:626806-2026'];
const hosts=new Set(['ted.europa.eu','www.publicprocurement.be']);
function allowed(url){try{const u=new URL(url);return u.protocol==='https:'&&hosts.has(u.hostname)&&!u.username&&!u.password}catch(e){return false}}
async function inspect(m,fetcher=fetch){
 const links=[...new Set((m.officialSources||[]).map(s=>s.url).concat([m.url]).filter(allowed))].slice(0,5);
 const row={id:m.id,title:m.title,source:m.source,noticeKind:m.noticeKind||'unknown',deadlineInDatabase:m.deadline||null,links:[],documents:[],verifiedDeadline:null};
 for(const url of links){
  const v={url,access:'not_checked',status:null,contentType:null};
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try{
   const res=await fetcher(url,{redirect:'manual',signal:ctrl.signal,headers:{Accept:'text/html,application/json,application/pdf,*/*;q=0.5'}});
   v.status=res.status;v.contentType=res.headers.get('content-type')||'';
   v.access=res.status===200?'portal_response':res.status===401||res.status===403?'access_denied':res.status>=300&&res.status<400?'redirect':'unavailable';
   if(res.status===200&&v.contentType.includes('text/html')){
    const html=(await res.text()).slice(0,500000);
    const urls=[...html.matchAll(/(?:href|content)\s*=\s*["'](https:\/\/[^"'<> ]+)["']/gi)].map(x=>x[1].replace(/&amp;/g,'&'));
    for(const href of [...new Set(urls)].filter(x=>allowed(x)&&/\.(pdf|docx?|xlsx?|zip)([?#]|$)/i.test(x)).slice(0,30)){
     row.documents.push({url:href,type:'unclassified',access:'html_link_only',sourceUrl:url});
    }
   }
  }catch(e){v.access='network_error';v.error=String(e.name||'Error')}finally{clearTimeout(timer)}
  row.links.push(v);
 }
 row.documents=[...new Map(row.documents.map(x=>[x.url,x])).values()];
 return row;
}
async function run(){
 const samples=ids.map(id=>data.items.find(m=>m.id===id));
 if(samples.some(x=>!x))throw Error('Selected market missing; do not substitute guessed information');
 const rows=[];
 for(const m of samples){const r=await inspect(m);rows.push(r);console.log(m.id+' '+r.links.map(x=>x.status||x.access).join(',')+' documents='+r.documents.length)}
 const out={generatedAt:new Date().toISOString(),count:rows.length,scope:'Read-only HTTP diagnostic of authentic official notice links, not document verification',rows};
 const dir=path.join(__dirname,'..','audit');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'phase3a-diagnostic.json'),JSON.stringify(out,null,2));
 const md=['# Phase 3A : audit de dix marchés','',out.generatedAt,'','Ce diagnostic vérifie les réponses de liens officiels déjà connus. Une réponse HTTP 200 ne prouve pas la présence d’un cahier des charges.','',
 '| Source | Marché | Échéance connue | HTTP | Fichiers liés |','|---|---|---|---|---|'];
 for(const r of rows)md.push('| '+r.source+' | '+r.title.replace(/\|/g,' ').slice(0,70)+' | '+(r.deadlineInDatabase||'inconnue')+' | '+r.links.map(x=>x.status||x.access).join(', ')+' | '+r.documents.length+' |');
 md.push('','Aucune échéance n’a été inventée ni écrasée. Les interfaces e-Procurement peuvent exiger un compte ou charger des documents en JavaScript ; un fichier non détecté n’est pas nécessairement absent.');
 fs.writeFileSync(path.join(dir,'phase3a-diagnostic.md'),md.join('\n')+'\n');
 console.log('TOTAL: '+JSON.stringify({tested:rows.length,http200:rows.filter(x=>x.links.some(l=>l.status===200)).length,linksToFiles:rows.reduce((n,x)=>n+x.documents.length,0)}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
module.exports={inspect,allowed,ids};
