/* Vérifier un CSC BOSA téléchargé via un bouton public.
 * Le fichier ne sort pas du runner: seul un diagnostic de texte est archivé.
 * Les dates relevées sont des CANDIDATS, pas des échéances officiellement validées.
 */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const name='2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf';
const route='https://www.publicprocurement.be/publication-workspaces/0765b50e-85f5-4aae-b2ca-2ed66c14e354/documents';
const rules=[
 {kind:'submission_deadline_mention',regex:/date\s+limite|limite\s+de\s+(?:remise|r[ée]ception|d[ée]p[oô]t)|remise\s+des\s+offres|d[ée]p[oô]t\s+des\s+offres|introduction\s+des\s+offres/gi},
 {kind:'site_visit_mention',regex:/visite\s+des\s+lieux|visite\s+obligatoire|visite\s+du\s+site|visite\s+sur\s+place/gi},
 {kind:'selection_criteria_mention',regex:/crit[eè]res?\s+d['’]attribution|s[ée]lection\s+qualitative|r[ée]f[ée]rences?\s+similaires/gi}
];
function tool(cmd,args,limit=30000){return cp.execFileSync(cmd,args,{timeout:limit,maxBuffer:40_000_000,encoding:'utf8'})}
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kdrix-csc-'));
 const file=path.join(tmp,'csc.pdf');
 const result={at:new Date().toISOString(),noticeWorkspace:'0765b50e-85f5-4aae-b2ca-2ed66c14e354',expectedFilename:name,
  download:false,originalFilename:null,sizeBytes:0,sha256:null,pages:null,textChars:0,candidates:[],issues:[]};
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({locale:'fr-BE',acceptDownloads:true});
  const page=await context.newPage();
  await page.goto(route,{waitUntil:'domcontentloaded',timeout:28000});
  await page.getByText(name,{exact:false}).first().waitFor({timeout:12000});
  const tr=page.getByText(name,{exact:false}).first().locator('xpath=ancestor::tr[1]');
  await tr.locator('button').last().click();
  const item=page.locator('.v-overlay__content:visible .v-list-item').filter({hasText:/télécharger la dernière version/i}).first();
  const wait=page.waitForEvent('download',{timeout:20000});
  await item.click();
  const downloaded=await wait;
  result.originalFilename=downloaded.suggestedFilename();
  const failure=await downloaded.failure();
  if(failure)throw Error('Public download failed: '+String(failure).slice(0,100));
  await downloaded.saveAs(file);
  const bytes=fs.readFileSync(file);
  if(bytes.length>25_000_000||bytes.length<1024||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Downloaded file is not a supported PDF size or signature');
  result.download=true;
  result.sizeBytes=bytes.length;
  result.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const info=tool('pdfinfo',[file]);
  result.pages=Number((info.match(/^Pages:\s*(\d+)/m)||[])[1]||0);
  if(result.pages<1||result.pages>1000)throw Error('Invalid PDF page count');
  const content=tool('pdftotext',['-layout',file,'-'],40000);
  result.textChars=content.length;
  const pages=content.split('\f');
  for(let i=0;i<pages.length;i++){
   const txt=pages[i];
   for(const rule of rules){
    let match,count=0;rule.regex.lastIndex=0;
    while((match=rule.regex.exec(txt))&&count<10&&result.candidates.length<45){
     const a=Math.max(0,match.index-105),b=Math.min(txt.length,match.index+match[0].length+165);
     result.candidates.push({kind:rule.kind,page:i+1,snippet:txt.slice(a,b).replace(/\s+/g,' ').trim().slice(0,300),review:'not_automatically_verified'});
     count++;
    }
   }
  }
  await page.close();
  await context.close();
 }catch(e){result.issues.push(String(e.name||'Error')+': '+String(e.message).slice(0,220))}
 finally{
  await browser.close();
  fs.rmSync(tmp,{recursive:true,force:true});
  const out=path.join(__dirname,'..','audit');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'phase3a-csc-text-probe.json'),JSON.stringify(result,null,2));
 }
 console.log(JSON.stringify({download:result.download,originalFilename:result.originalFilename,sizeBytes:result.sizeBytes,pages:result.pages,textChars:result.textChars,count:result.candidates.length,kinds:[...new Set(result.candidates.map(x=>x.kind))],issues:result.issues},null,2));
 if(!result.download||result.textChars<500)process.exitCode=1;
})().catch(e=>{console.error(String(e.stack||e));process.exitCode=1});
