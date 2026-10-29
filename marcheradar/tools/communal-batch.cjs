/* Rotation communale bornée, trois communes en parallèle, fusion par identité.
   Un travailleur n'écrit jamais dans les fichiers d'un autre travailleur. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const discovery=require('./communes-discovery.cjs'),reader=require('./communes-documents.cjs'),health=require('../source-health.js'),dates=require('../document-dates.js'),{selection}=require('./communes-scope.cjs');
const write=(p,v)=>{const tmp=p+'.batch-tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n');fs.renameSync(tmp,p)};
async function run(options={}){
 const inventoryPath=options.inventoryPath||path.resolve(__dirname,'../communes.json'),dataPath=options.dataPath||path.resolve(__dirname,'../data.json');
 const inventory=JSON.parse(fs.readFileSync(inventoryPath)),data=JSON.parse(fs.readFileSync(dataPath)),baseline=new Map(data.items.map(m=>[m.id,JSON.stringify(m)]));
 const limit=Math.min(24,Math.max(1,Number(options.limit||process.env.COMMUNES_BATCH||12))),parallel=Math.min(4,Math.max(1,Number(options.concurrency||3))),now=options.now||new Date().toISOString(),start=Date.now(),budget=options.budgetMs||20*60000;
 const selected=selection(inventory.communes,options).filter(c=>c.officialSite).sort((a,b)=>(a.lastDocumentCheck||'').localeCompare(b.lastDocumentCheck||'')||(a.estimatedMinutes||9999)-(b.estimatedMinutes||9999)||a.ins.localeCompare(b.ins)).slice(0,limit);
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'mr-communal-batch-'));let cursor=0;const results=[];
 function persist(){
  const n=health.counts(inventory.communes);inventory.lastMunicipalDocumentPass=now;inventory.counts={...(inventory.counts||{}),total:n.total,sitesChecked:n.sites,sitesVerifies:n.sites,candidatePages:n.pages,documentsRead:n.documents,deliberationsConnectees:n.read,sourceErrors:n.errors};
  data.metrics={...(data.metrics||{}),records:data.items.length};data.sources={...(data.sources||{}),COMMUNES:{...(data.sources?.COMMUNES||{}),...inventory.counts,last_attempt:now},COMMUNES_DOCUMENTS:{...(data.sources?.COMMUNES_DOCUMENTS||{}),status:results.some(r=>r.error||r.errors)?'partial':'progressive',last_attempt:now,...(results.some(r=>r.checked||r.htmlRead)?{last_success:now}:{}),last_batch:results.length,documents_checked:results.reduce((n,r)=>n+(r.checked||0),0),html_documents_read:results.reduce((n,r)=>n+(r.htmlRead||0),0),errors_count:results.reduce((n,r)=>n+(r.errors||0)+(r.error?1:0),0),recent_municipal_signals:data.items.filter(m=>m.source==='LOCALE'&&m.municipalityINS&&dates.freshness(m,now).active&&m.screening!=='excluded').length}};
  write(dataPath,data);write(inventoryPath,inventory);
 }
 async function worker(){while(cursor<selected.length&&Date.now()-start<budget){
  const c=selected[cursor++],dir=path.join(scratch,c.ins);fs.mkdirSync(dir);const localInventory=path.join(dir,'communes.json'),localData=path.join(dir,'data.json');write(localInventory,{communes:[c]});write(localData,data);
  try{
   await (options.discover||discovery.run)({...options,inventoryPath:localInventory,dataPath:localData,ins:c.ins,limit:1,maxSources:3,quiet:true,now});
   const r=await (options.read||reader.run)({...options,inventoryPath:localInventory,dataPath:localData,ins:c.ins,maxCommunes:1,maxPages:12,maxDocuments:6,quiet:true,now});
   const updated=JSON.parse(fs.readFileSync(localInventory)).communes[0],items=JSON.parse(fs.readFileSync(localData)).items,index=new Map(data.items.map((m,i)=>[m.id,i]));
   for(const m of items){if(JSON.stringify(m)===baseline.get(m.id))continue;const i=index.get(m.id);if(i===undefined){index.set(m.id,data.items.length);data.items.push(m)}else data.items[i]=m;}
   inventory.communes[inventory.communes.findIndex(x=>x.ins===c.ins)]=updated;
   results.push({ins:c.ins,name:c.name,...r,htmlRead:Math.max(0,(updated.htmlDocumentsRead||0)-(c.htmlDocumentsRead||0))});
  }catch(e){results.push({ins:c.ins,name:c.name,error:String(e.message||e).slice(0,160)})}
  persist();
 }}
 try{await Promise.all(Array.from({length:parallel},()=>worker()));persist();if(!options.quiet)console.log('COMMUNAL_BATCH',JSON.stringify({planned:selected.length,completed:results.length,results}));return {planned:selected.length,completed:results.length,results};}
 finally{fs.rmSync(scratch,{recursive:true,force:true})}
}
module.exports={run};if(require.main===module)run().catch(e=>{console.error('COMMUNAL_BATCH_ERROR',e.message);process.exitCode=1});
