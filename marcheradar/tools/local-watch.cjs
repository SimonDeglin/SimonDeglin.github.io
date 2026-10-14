/* MarchéRadar — premier pilote de veille locale sur documents publics.
 * Sources : pages officielles Province de Namur (projets et PV du Conseil).
 * Extrait seulement les passages contenant un signal métier précis et un
 * indice de décision/consultation. Les dossiers ne sont pas présentés comme
 * des marchés officiellement lancés.
 */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
 child=require('node:child_process'),crypto=require('node:crypto');
const profile=require('./kdrix-profile.cjs');
const DATA=path.resolve(__dirname,'../data.json');
const SOURCES=[
 {name:'Province de Namur — projets de délibérations',
 url:'https://www.province.namur.be/conseil-provincial/projets-de-deliberations/'},
 {name:'Province de Namur — procès-verbaux',
 url:'https://www.province.namur.be/conseil-provincial/05-pv-des-seances/'}
];
const signals=/(topograph|geom[eè]tr|g[eé]om[eè]tr|bathym[eé]tr|hydrograph|jaugeag|division parcellaire|bornage|scanner laser|photogramm[eé]tr|relev[eé] (?:de |des )?r[eé]seaux|auteur de projet|[eé]tude hydraulique|certificat de performance [eé]nerg[eé]tique)/i;
const intent=/(march[eé] public|bureau d.[eé]tudes|prestataire|appel [aà] (?:un |des )?(?:bureau|g[eé]om[eè]tre)|mise en concurrence|lancer (?:un )?march[eé]|passation|d[eé]signation|d[eé]cide|approuv|attribution|consultation)/i;
const strictHost=new Set(['www.province.namur.be']);
function textOnly(s){return String(s||'').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|amp|quot|#39);/gi,' ').replace(/\s+/g,' ').trim()}
function links(html,base){
 const found=[];
 for(const m of String(html).matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)){
  let url;try{url=new URL(m[2],base)}catch(e){continue}
  if(!strictHost.has(url.host)||url.protocol!=='https:'||!url.pathname.toLowerCase().endsWith('.pdf'))continue;
  const name=textOnly(m[4]);
  if(!found.some(x=>x.url===url.href))found.push({url:url.href,name:name.slice(0,120)});
 }
 return found;
}
function snippets(text){
 const lines=String(text||'').split(/\n/).map(s=>s.trim()).filter(Boolean);
 const out=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(!signals.test(line))continue;
  const chunk=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+5)).join(' ').slice(0,1250);
  if(!intent.test(chunk))continue;
  if(/sans nouvelle (?:consultation|mission|passation)|aucun nouveau march[eé]|pas de nouvelle consultation/i.test(chunk)&&!/(?:d[eé]cide (?:de |d.)?|approuve? (?:la |le )?(?:passation|consultation)|mise en concurrence|lancer un march[eé])/i.test(chunk))continue;
  const compact=textOnly(chunk);
  if(!out.some(x=>x.slice(0,110)===compact.slice(0,110)))out.push(compact);
  if(out.length>=12)break;
 }
 return out;
}
function makeOpportunity(source,document,passage){
 const digest=crypto.createHash('sha256').update(document.url+'|'+passage.slice(0,210)).digest('hex').slice(0,19);
 const title=(passage.length>130?passage.slice(0,127)+'…':passage);
 const métier=profile.classify(title,passage,[])||{sector:'Topo',sectors:['Topo'],score:52};
 return {
  id:'local:'+digest,
  title:'Prospection à vérifier — '+title,
  buyer:'Province de Namur',
  region:'Wallonie',
  source:'LOCALE',
  opportunityType:'prospection',
  opportunityStage:/(lancer|d[eé]cide de lancer|consultation|mise en concurrence)/i.test(passage)?'consultation annoncée':'décision ou projet à vérifier',
  sourceDocument:document.url,
  url:document.url,
  dateSource:'',
  publication:'',
  deadline:'',
  cpv:[],
  sector:métier.sector,sectors:métier.sectors,
  score:Math.min(69,métier.score),screening:'review',
  description:'Extrait du document public « '+source.name+' » : '+passage+
   '\nVérifier le texte complet et l’état du projet avant toute démarche commerciale.',
  officialSources:[{source:'Conseil provincial',url:document.url}],
  evidence:passage,
  source_status:'extrait_pdf_non_validé_humainement'
 };
}
async function fetchLimited(url,maxBytes=10_000_000){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
 try{
  const resp=await fetch(url,{headers:{'User-Agent':'MarcheRadarPublicIndex/0.1','Accept':'text/html,application/pdf'},signal:ctl.signal});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const content=Buffer.from(await resp.arrayBuffer());
  if(content.length>maxBytes)throw Error('Document supérieur à la limite de taille');
  return content;
 }finally{clearTimeout(timer)}
}
async function run(){
 const previous=JSON.parse(fs.readFileSync(DATA,'utf8'));
 const errors=[],all=[],sourceStats=[];
 const exe=child.spawnSync('pdftotext',['-v'],{encoding:'utf8'});
 if(exe.error)throw Error('poppler-utils/pdftotext indisponible');
 for(const source of SOURCES){
  try{
   const html=(await fetchLimited(source.url,1_500_000)).toString('utf8');
   const files=links(html,source.url).slice(0,12);
   let scanned=0,found=0;
   for(const file of files){
    try{
     const pdf=await fetchLimited(file.url,9_000_000);
     if(!pdf.slice(0,8).toString().includes('%PDF'))continue;
     const tmp=path.join(os.tmpdir(),'kdrix-local-'+crypto.randomBytes(6).toString('hex')+'.pdf');
     let extracted='';
     try{
      fs.writeFileSync(tmp,pdf);
      extracted=child.execFileSync('pdftotext',['-layout',tmp,'-'],{encoding:'utf8',timeout:15000,maxBuffer:7_000_000});
     }finally{try{fs.unlinkSync(tmp)}catch(e){}}
     scanned++;
     for(const passage of snippets(extracted)){
      all.push(makeOpportunity(source,file,passage));found++;
     }
    }catch(e){errors.push({url:file.url,error:String(e.message||e).slice(0,220)})}
   }
   sourceStats.push({url:source.url,source:source.name,documents_seen:files.length,documents_read:scanned,signals_detected:found});
  }catch(e){errors.push({url:source.url,error:String(e.message||e).slice(0,220)})}
 }
 if(!sourceStats.length)throw Error('Aucune source locale consultable : inventaire inchangé');
 const ids=new Set((previous.items||[]).map(x=>x.id));
 const fresh=all.filter(m=>!ids.has(m.id));
 previous.items=[...(previous.items||[]),...fresh];
 previous.sources={...(previous.sources||{}),LOCALE:{status:errors.length?'partial':'pilot',last_success:new Date().toISOString(),sources:sourceStats,errors_count:errors.length,added: fresh.length}};
 previous.coverage={...(previous.coverage||{}),communal:'Pilote Province de Namur : '+sourceStats.length+' page(s) officielle(s), '+sourceStats.reduce((n,a)=>n+a.documents_read,0)+' document(s) PDF analysé(s). Couverture communale non exhaustive.'};
 previous.metrics={...(previous.metrics||{}),local_documents:sourceStats.reduce((n,a)=>n+a.documents_read,0),local_opportunities:fresh.length,records:previous.items.length};
 fs.writeFileSync(DATA,JSON.stringify(previous,null,2)+'\n');
 console.log('LOCAL_SOURCE_OK',JSON.stringify({pages:sourceStats.length,documents:previous.metrics.local_documents,found:all.length,added:fresh.length,errors:errors.length}));
}
module.exports={links,snippets,makeOpportunity,run};
if(require.main===module){run().catch(e=>{console.warn('LOCAL_WATCH_NOT_CONNECTED',e.message);process.exitCode=0})}
