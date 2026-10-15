/* MarchéRadar Phase 3B — premier lot de vrais PDF.
 * - télécharger via le bouton PUBLIC du portail e-Procurement ;
 * - vérifier le PDF, extraire de courts passages, enregistrer l'empreinte;
 * - ne JAMAIS renseigner automatiquement le statut de visite ou l'échéance.
 * Les PDF sont supprimés du runner et ne sont jamais publiés sur GitHub Pages.
 */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {makeAnalysis,mergeAnalysis}=require('./csc-evidence.cjs');
const dataFile=path.join(__dirname,'..','data.json');
const targets=[
 {id:'bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354',file:'2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf'},
 {id:'bosa:d132e2d7-29b4-4489-9e26-70db1504fa8f',file:'OTT-PLC - MP géomètre - Invitation à remettre une offre.pdf'},
 {id:'bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354',file:'Annexe_C_Catalogue_2022_topo_G4_FR.pdf'},
 {id:'bosa:dfdf8ed6-f60e-4be6-9024-e608d8bc079a',file:'VLAIO-2026-17 Raamovereenkomst BIZGIS fase 3_12.10.2026.pdf'}
];
function external(cmd,args){return cp.execFileSync(cmd,args,{encoding:'utf8',timeout:45000,maxBuffer:5_000_000})}
async function fetchOne(context,m,doc){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'marche-csc-'));
 const targetFile=path.join(tmp,'document.pdf');
 const page=await context.newPage();
 try{
  const url='https://www.publicprocurement.be/publication-workspaces/'+m.publicationWorkspaceId+'/documents';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:28000});
  if(!response||response.status()!==200)throw Error('Official document page not available (HTTP '+(response?.status()||'none')+')');
  const label=page.getByText(doc.title,{exact:false}).first();
  await label.waitFor({state:'visible',timeout:15000});
  const row=label.locator('xpath=ancestor::tr[1]');
  if(!await row.count())throw Error('Official document row not found');
  const buttons=row.locator('button');
  if(!await buttons.count())throw Error('No public document action button');
  await buttons.last().click({timeout:9000});
  const menu=page.locator('.v-overlay__content:visible .v-list-item')
   .filter({hasText:/télécharger la dernière version|download latest version|laatste versie downloaden/i}).first();
  await menu.waitFor({timeout:9000});
  const downloadPromise=page.waitForEvent('download',{timeout:30000});
  await menu.click({timeout:9000});
  const download=await downloadPromise;
  const failure=await download.failure();
  if(failure)throw Error('Download rejected by portal: '+String(failure).slice(0,100));
  const actualName=download.suggestedFilename();
  if(actualName!==doc.title)throw Error('Downloaded filename differs from official manifest');
  await download.saveAs(targetFile);
  const bytes=fs.readFileSync(targetFile);
  const metadata=external('pdfinfo',[targetFile]);
  const pages=Number((metadata.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  const text=external('pdftotext',['-layout',targetFile,'-']);
  const analysis=makeAnalysis({market:m,document:doc,bytes,numberOfPages:pages,text});
  return {analysis,pages,textChars:text.length,bytes:bytes.length};
 }finally{
  await page.close().catch(()=>{});
  fs.rmSync(tmp,{recursive:true,force:true});
 }
}
async function run(){
 const input=JSON.parse(fs.readFileSync(dataFile,'utf8'));
 const originalIds=input.items.map(x=>x.id);
 const report={at:new Date().toISOString(),scanned:[],success:0,distinctMarkets:0,updatedMarkets:0,
  note:'Analysis by keyword passages with page references; no deadlines or visits confirmed. PDFs deleted after reading.'};
 const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--no-sandbox']});
 const touched=new Set(),succeeded=new Set();
 try{
  const context=await browser.newContext({locale:'fr-BE',acceptDownloads:true,viewport:{width:1440,height:900}});
  for(const target of targets){
   const result={id:target.id,file:target.file,status:'not_checked'};
   report.scanned.push(result);
   const i=input.items.findIndex(x=>x.id===target.id);
   if(i<0){result.status='not_in_database';continue}
   const m=input.items[i],doc=(m.documentInventory||[]).find(x=>x.title===target.file);
   if(!doc){result.status='not_in_official_inventory';continue}
   try{
    const analysis=await fetchOne(context,m,doc);
    const merged=mergeAnalysis(m,analysis.analysis);
    if(merged.updated){input.items[i]=merged.market;touched.add(m.id)}
    succeeded.add(m.id);report.success++;
    Object.assign(result,{status:'extracted',pages:analysis.pages,bytes:analysis.bytes,
     sha256:analysis.analysis.sha256,excerpts:analysis.analysis.evidence.length,
     updated:merged.updated});
   }catch(e){result.status='not_extracted';result.problem=String(e.name||'Error')+': '+String(e.message).slice(0,185)}
   console.log(result.id+' | '+result.file+' | '+result.status+' | '+(result.excerpts||0)+' passages');
  }
 }finally{await browser.close()}
 report.distinctMarkets=succeeded.size;report.updatedMarkets=touched.size;
 const check=input.items.map(x=>x.id);
 if(originalIds.length!==check.length||check.some((x,i)=>x!==originalIds[i]))throw Error('Market IDs or ordering changed; stop');
 const outdir=path.join(__dirname,'..','audit');fs.mkdirSync(outdir,{recursive:true});
 fs.writeFileSync(path.join(outdir,'phase3b-evidence-report.json'),JSON.stringify(report,null,2)+'\n');
 if(process.argv.includes('--write')&&report.success>=2&&report.distinctMarkets>=2&&report.updatedMarkets>0){
  fs.writeFileSync(dataFile,JSON.stringify(input,null,2)+'\n');
 }
 console.log('RESULT '+JSON.stringify({success:report.success,distinctMarkets:report.distinctMarkets,updatedMarkets:report.updatedMarkets,
  wrote:process.argv.includes('--write')&&report.success>=2&&report.distinctMarkets>=2&&report.updatedMarkets>0,problems:report.scanned.filter(r=>r.status!=='extracted').length}));
 if(report.success<2||report.distinctMarkets<2)process.exitCode=1;
}
if(require.main===module)run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
module.exports={targets,fetchOne,run};
