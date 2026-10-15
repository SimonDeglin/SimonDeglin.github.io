/* MarchéRadar — première lecture ciblée des délibérations communales.
 * Sources issues des pages communales découvertes, ne jamais inventer un projet.
 * Chaque opportunité conserve un extrait du document et son lien officiel.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const INVENTORY=path.resolve(__dirname,'../communes.json'),DATA=path.resolve(__dirname,'../data.json');
const MAX_COMMUNES=Math.min(8,Math.max(1,Number(process.env.COMMUNES_DOC_BATCH||4)));
const MATCH=/(?:topograph|g[eé]om[eè]tr|bornage|division parcell|bathym[eé]tr|jaugeag|limnim[eé]tr|[eé]tude hydraulique|bureau d.[eé]tudes|auteur de projet|d[eé]tection de r[eé]seaux|scanner laser|photogramm[eé]tr|certificat PEB|certification [eé]nerg[eé]tique|lev[eé] de terrain|[eé]valuation immobili[eè]re|relev[eé] de cours d.eau)/i;
const INTENT=/(?:d[eé]cide|approuve|d[eé]lib[eè]re|march[eé] de services|d[eé]signation|consultation|cahier sp[eé]cial des charges|lancement d.un march[eé]|mise en concurrence|bureau d.[eé]tudes|mission d.auteur de projet|budget d.[eé]tudes?)/i;
function textOnly(h){return String(h||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp|quot|#39);/gi,' ').replace(/\s+/g,' ').trim()}
function fileLinks(html,base){
 const out=[];
 for(const a of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let uri;try{uri=new URL(a[1],base)}catch(e){continue}
  if(!/^https?:$/.test(uri.protocol))continue;
  if(!/\.pdf(?:$|\?)/i.test(uri.href))continue;
  if(!out.some(x=>x.url===uri.href))out.push({url:uri.href,title:textOnly(a[2]).slice(0,90)});
 }
 return out.slice(0,12);
}
async function download(url,type,max){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:type, 'User-Agent':'KDRIX-PublicCouncilMonitor/1.0'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length>max)throw Error('Fichier supérieur à la limite');
  return {bytes:b,finalUrl:r.url};
 }finally{clearTimeout(timer)}
}
function pdfText(bytes){
 if(bytes.slice(0,5).toString()!=='%PDF-')return '';
 const tmp=path.join(os.tmpdir(),'kdrix-council-'+crypto.randomBytes(8).toString('hex')+'.pdf');
 try{fs.writeFileSync(tmp,bytes);return cp.execFileSync('pdftotext',['-layout',tmp,'-'],{encoding:'utf8',timeout:16000,maxBuffer:6000000})}
 finally{try{fs.unlinkSync(tmp)}catch(e){}}
}
function evidence(text){
 const lines=String(text||'').split('\n').map(x=>x.trim()).filter(Boolean),out=[];
 for(let i=0;i<lines.length;i++){
  if(!MATCH.test(lines[i]))continue;
  const quote=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+5)).join(' ').slice(0,1400);
  if(INTENT.test(quote)&&!out.some(x=>x.slice(0,100)===quote.slice(0,100)))out.push(quote);
  if(out.length>=6)break;
 }
 return out;
}
async function run(){
 if(cp.spawnSync('pdftotext',['-v'],{encoding:'utf8'}).error)throw Error('pdftotext indisponible');
 const inventory=JSON.parse(fs.readFileSync(INVENTORY,'utf8')),data=JSON.parse(fs.readFileSync(DATA,'utf8'));
 const ready=inventory.communes.filter(m=>m.deliberationSources?.some(s=>s.status==='page_accessible'))
  .sort((a,b)=>(a.lastDocumentCheck||'').localeCompare(b.lastDocumentCheck||''))
  .slice(0,MAX_COMMUNES);
 const known=new Set((data.items||[]).map(x=>x.id));let documents=0,created=0,errors=[];
 for(const m of ready){
  for(const src of m.deliberationSources.filter(s=>s.status==='page_accessible').slice(0,3)){
   try{
    const page=await download(src.url,'text/html',1200000);
    const documentsList=fileLinks(page.bytes.toString('utf8'),page.finalUrl);
    for(const pdf of documentsList){
     try{
      const digest=crypto.createHash('sha256').update(pdf.url).digest('hex').slice(0,18);
      // A single public PDF is downloaded at most once; revisit only if
      // its URL changes. Hash is a source identity, not a guessed title.
      const documentId='municipal-doc:'+digest;
      if(m.readDocuments?.includes(documentId))continue;
      const file=await download(pdf.url,'application/pdf',9000000),content=pdfText(file.bytes);
      if(!content)continue;
      documents++;
      m.readDocuments=[...new Set([...(m.readDocuments||[]),documentId])];
      m.documentsRead=(m.documentsRead||0)+1;
      for(const quote of evidence(content)){
       const id='local:'+crypto.createHash('sha256').update(pdf.url+'|'+quote.slice(0,170)).digest('hex').slice(0,20);
       if(known.has(id))continue;
       known.add(id);
       data.items.push({
        id,title:'Conseil communal — opportunité à vérifier : '+m.name,buyer:'Commune de '+m.name,
        region:'Wallonie',source:'LOCALE',opportunityType:'prospection',
        opportunityStage:'décision ou besoin à vérifier',sector:'Topo',sectors:['Topo'],
        score:40,screening:'review',publication:'',deadline:'',
        sourceDocument:pdf.url,url:pdf.url,cpv:[],
        description:'Document communal public. Extrait nécessitant une lecture de validation : '+quote,
        evidence:quote,source_status:'extrait_pdf_a_verifier'
       });created++;m.opportunities=(m.opportunities||0)+1;
      }
     }catch(e){errors.push({site:m.name,link:pdf.url,error:String(e.message||e).slice(0,130)})}
    }
   }catch(e){errors.push({site:m.name,link:src.url,error:String(e.message||e).slice(0,130)})}
  }
  m.lastDocumentCheck=new Date().toISOString();
 }
 const date=new Date().toISOString();
 inventory.lastMunicipalDocumentPass=date;
 inventory.counts={...(inventory.counts||{}),documentsRead:inventory.communes.reduce((n,x)=>n+(x.documentsRead||0),0),opportunities:inventory.communes.reduce((n,x)=>n+(x.opportunities||0),0)};
 data.sources={...(data.sources||{}),COMMUNES_DOCUMENTS:{status:errors.length?'partial':'pilot',last_attempt:date,
   last_batch:ready.length,documents_read:documents,opportunities_found:created,errors_count:errors.length,
   warning:'Signaux non validés humainement ; seuls les PDF publics effectivement lus créent des pistes.'}};
 fs.writeFileSync(INVENTORY,JSON.stringify(inventory,null,2)+'\n');
 fs.writeFileSync(DATA,JSON.stringify(data,null,2)+'\n');
 console.log('COMMUNES_DOCUMENTS',JSON.stringify({communes:ready.length,documents,opportunities:created,errors:errors.length}));
}
module.exports={fileLinks,evidence,run};
if(require.main===module)run().catch(e=>{console.warn('COMMUNES_DOCUMENT_READ_ERROR',e.message);process.exitCode=0});
