/* Phase 3A: browser smoke test against REAL enriched pilot data.
 * Requires preceding --pilot --write. This must not fake any CSC URL.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),directory=path.join(root,'marcheradar');
const data=JSON.parse(fs.readFileSync(path.join(directory,'data.json'),'utf8'));
const market=data.items.find(x=>x.id==='bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354');
const ted=data.items.find(x=>x.id==='ted:682034-2026');
assert.equal(data.items.length,64);
assert(market&&ted,'Échantillon réel absent');
assert.equal(market.documents?.length,16,'Les 16 documents bathy n’ont pas été indexés');
assert.equal(market.deadlineEvidence?.verified,true,'Échéance BOSA non documentée');
assert.equal(ted.deadlineEvidence?.verified,true,'Échéance TED non documentée');
assert(market.documents.every(d=>d.accessibility==='listed_public'&&!d.url),'Un lien direct non confirmé ne peut être prétendu accessible');
const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400).end();return}
 if(p.endsWith('/'))p+='index.html';
 const full=path.resolve(root,'.'+p);
 if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(full,(err,body)=>{
  if(err){res.writeHead(404).end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'});res.end(body)
 });
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/marcheradar/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Number(document.querySelector('#resultCount')?.textContent)===64);
  await page.locator('article[data-id="'+market.id+'"] .open-tender').click();
  assert.equal(await page.locator('.drawer.on').count(),1);
  assert.match(await page.locator('.mr2-section').nth(0).innerText(),/10\/11\/2026.*10:00.*UTC\+01:00/);
  const docSection=page.locator('.mr2-section').filter({has:page.locator('h4:text-is("Accès aux documents")')});
  assert.match(await docSection.innerText(),/2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf/);
  assert.match(await docSection.innerText(),/02_2026B0173_xxxx_Inventaire.xlsx/);
  assert.match(await docSection.innerText(),/téléchargement depuis sa page/);
  const listed=docSection.locator('.mr2-source-link').filter({hasText:'Fichier listé'});
  assert.equal(await listed.count(),16,'Documents affichés dans le catalogue public');
  const destinations=await listed.evaluateAll(a=>a.map(n=>n.href));
  assert.equal(new Set(destinations).size,1,'Tous les fichiers listés pointent sur leur portail vérifié');
  assert.equal(destinations[0],market.documents[0].accessPageUrl);
  await page.locator('#closeDrawer').click();
  await page.locator('article[data-id="'+ted.id+'"] .open-tender').click();
  assert.match(await page.locator('.mr2-section').nth(0).innerText(),/05\/11\/2026.*11:00.*UTC\+01:00/);
  assert.match(await page.locator('.mr2-section').nth(0).innerText(),/Échéance vérifiée dans TED API/);
  assert.equal(errors.length,0,'Erreur JavaScript dans le navigateur : '+errors.join(', '));
  await page.close();
  console.log('PHASE3A_BROWSER_OK: 64 marchés, 9 dates vérifiées, 16 documents bathy distincts, sources TED/BOSA');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(e=>{console.error('PHASE3A_BROWSER_FAIL',e.stack||e);server.close();process.exitCode=1});
