/* Tests Chromium isolés : aucune note ni décision réelle n'est chargée. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),backup=require('../followup-backup.js');
const root=path.resolve(__dirname,'../..'),key='kdrix.marcheRadar.v1';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';
 const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes)});
});
const initial={statuses:{t1:'irrelevant',t2:'maybe'},notes:{t1:'Note récente à conserver'},favorites:{t1:true},hiddenSectors:{}};
const incoming={statuses:{t1:'answer',t3:'answer',ancien:'irrelevant'},notes:{t1:'Ancienne note du fichier',ancien:'Dossier absent de la collecte'},favorites:{t1:false},hiddenSectors:{PEB:true}};
const fixtures=['t1','t2','t3'].map(id=>({id,title:'Marché de test '+id,buyer:'Commune de Test',description:'Mission de levés topographiques',source:'TED',noticeType:'cn-standard',sector:'Topo',sectors:['Topo'],score:80,region:'Wallonie',publication:'2026-10-01',deadline:'',cpv:[]}));
Object.assign(fixtures[2],{source:'LOCALE',sourceDocumentDates:{session:{date:new Date().toISOString().slice(0,10),kind:'session',confidence:'explicit',source:'pdf_text',excerpt:'Date de séance du jeu de test'}},noticeType:null,evidence:'Ancien extrait historique.',sourceDocument:'https://commune-test.be/pv.pdf',sourceEvidenceStatus:'not_found',sourceDocumentVersion:{sha256:'a'.repeat(64),checkedAt:'2026-10-28T10:00:00Z',changedAt:'2026-10-28T10:00:00Z'},sourceDocumentReview:{sha256:'a'.repeat(64),candidates:[{page:2,excerpt:'Le conseil approuve une nouvelle mission de topographie.'}]}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 try{
  const page=await context.newPage(),errors=[],sent=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))sent.push(r.url())});
  await page.addInitScript(({key,initial})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(initial))},{key,initial});
  await page.route('**/marcheradar/data.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:fixtures,generated_at:new Date().toISOString(),collector_status:'ok',data_origin:'test'})}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/marcheradar/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#resultCount').textContent==='1');
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  async function exportFile(button){const event=page.waitForEvent('download');await page.locator(button).click();return backup.parse(fs.readFileSync(await (await event).path(),'utf8'))}
  async function choose(state){await page.locator('#backupFile').setInputFiles({name:'suivi-test.json',mimeType:'application/json',buffer:Buffer.from(backup.serialize(state))});await page.locator('#backupPreview').waitFor({state:'visible'})}
  await page.locator('#settingsBtn').click();
  assert.deepEqual((await exportFile('#backupExport')).state,initial);
  await choose(incoming);assert.deepEqual(await read(),initial,'La sélection du fichier ne restaure rien avant clic explicite');
  assert.match(await page.locator('#backupDiff').innerText(),/3 différence/);
  await page.screenshot({path:path.join(__dirname,'followup-backup-preview.png'),animations:'disabled'});
  await page.locator('#backupApply').click();
  assert.match(await page.locator('#backupFeedback').innerText(),/Restauration enregistrée/);
  const merged=await read();assert.equal(merged.statuses.t1,'irrelevant');assert.equal(merged.notes.t1,initial.notes.t1);assert.equal(merged.favorites.t1,true);
  assert.equal(merged.statuses.t3,'answer');assert.equal(merged.statuses.ancien,'irrelevant');assert.equal(merged.notes.ancien,incoming.notes.ancien);
  assert.deepEqual((await exportFile('#backupPrevious')).state,initial,'Le snapshot antérieur doit être récupérable');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-count="answer"]').textContent==='1');
  assert.equal((await read()).statuses.t1,'irrelevant');
  await page.locator('[data-view="answer"]').click();await page.locator('[data-open-full="t3"]').click();
  assert.match(await page.locator('#drawerBody').innerText(),/extrait historique n’a pas été retrouvé/);
  await page.locator('.mr2-source-changes summary').click();
  assert.match(await page.locator('.mr2-source-changes').innerText(),/rattachement à ce marché n’est pas confirmé/);
  await page.screenshot({path:path.join(__dirname,'municipal-document-versions.png'),animations:'disabled'});
  await page.locator('#closeDrawer').click();await page.locator('[data-view="irrelevant"]').click();await page.locator('article[data-id="t1"] .open-tender').click();await page.locator('#quickDismissTender').click();
  assert.equal((await read()).statuses.t1,'inbox','Une réintégration est une décision explicite à sauvegarder');
  await page.locator('#settingsBtn').click();assert.equal((await exportFile('#backupExport')).state.statuses.t1,'inbox');
  await choose(incoming);await page.locator('#backupCancel').click();assert.equal((await read()).statuses.t1,'inbox');
  const beforeInvalid=await read();
  await page.locator('#backupFile').setInputFiles({name:'invalide.json',mimeType:'application/json',buffer:Buffer.from('{"format":"autre"}')});
  await page.waitForFunction(()=>document.querySelector('#backupFeedback').textContent.includes('Fichier refusé'));
  assert.deepEqual(await read(),beforeInvalid);
  await choose(incoming);await page.locator('#backupMode').selectOption('incoming');await page.locator('#backupApply').click();
  assert.equal((await read()).statuses.t1,'answer');assert.equal((await read()).notes.t1,incoming.notes.t1);assert.equal((await read()).favorites.t1,false);
  const beforeFailure=await read();await choose(initial);await page.locator('#backupMode').selectOption('incoming');
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith('.beforeImport'))throw new DOMException('Stockage plein','QuotaExceededError');return set.call(this,k,v)}});
  await page.locator('#backupApply').click();assert.match(await page.locator('#backupFeedback').innerText(),/Restauration non appliquée/);assert.deepEqual(await read(),beforeFailure);
  assert.deepEqual(errors,[]);assert.deepEqual(sent,[],'Aucun envoi de la sauvegarde à un serveur');
  console.log('SAUVEGARDE_CHROMIUM_OK — export, aperçu, conflits, annulation, restauration, snapshot, rechargement, Hors sujet et quota');
  console.log('VERSIONS_CHROMIUM_OK — historique conservé et passages de document non attribués automatiquement');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
