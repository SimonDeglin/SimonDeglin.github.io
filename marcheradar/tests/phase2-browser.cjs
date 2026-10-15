/* Tests en navigateur de la fiche MarchéRadar Phase 2 — données réelles + fixtures. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const mdir=path.join(root,'marcheradar');
const data=JSON.parse(fs.readFileSync(path.join(mdir,'data.json'),'utf8'));
const html=fs.readFileSync(path.join(mdir,'index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'script principal introuvable');
new vm.Script(script[1]);
new vm.Script(fs.readFileSync(path.join(mdir,'detail-phase2.js'),'utf8'));
assert.equal(data.items.length,64);
assert.match(html,/src="detail-phase2\.js"/);
assert.match(html,/href="detail-phase2\.css"/);
const contentTypes={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{
 let p;
 try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400).end();return}
 if(p.endsWith('/'))p+='index.html';
 const abs=path.resolve(root,'.'+p);
 if(!abs.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(abs,(err,buffer)=>{
  if(err){res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':contentTypes[path.extname(abs)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(buffer);
 });
});
async function ready(page,expected){
 await page.waitForFunction(n=>Number(document.querySelector('#resultCount')?.textContent)===n,expected,{timeout:20000});
 assert.equal(await page.locator('.tender').count(),expected);
}
const errors=[];
function attach(page){page.on('pageerror',e=>errors.push(String(e.stack||e)))}
function article(page,m){return page.locator('article[data-id="'+m.id+'"]')}
function fixture(id,changes){
 return {id,source:'TED',screening:'main',title:'Mission de relevés topographiques',region:'Wallonie',
 buyer:'Commune test',sector:'Topo',sectors:['Topo'],score:88,cpv:['71351810'],
 description:'Prestations de relevé topographique',publication:'2026-10-09',deadline:'2026-11-16',...changes};
}
(async()=>{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const address='http://127.0.0.1:'+srv.address().port+'/marcheradar/';
 const browser=await chromium.launch({headless:true});
 try{
  const cx=await browser.newContext({viewport:{width:1440,height:920}});
  const page=await cx.newPage();attach(page);
  await page.goto(address,{waitUntil:'domcontentloaded'});
  await ready(page,64);
  assert.equal(await page.locator('.mr2-list-hints').count(),64);
  const bosa=data.items.find(m=>m.source==='BOSA'&&m.noticeKind==='award');
  const ted=data.items.find(m=>m.source==='TED');
  const local=data.items.find(m=>m.source==='LOCALE'&&m.sourceDocument);
  assert(bosa&&ted&&local,'Jeu de données incomplet');
  await article(page,bosa).locator('.open-tender').click();
  assert.equal(await page.locator('.drawer.on.mr2-drawer').count(),1);
  assert.match(await page.locator('.mr2-intro').innerText(),/Avis de résultat/);
  assert.match(await page.locator('.mr2-section').nth(0).innerText(),/Référence/);
  assert.match(await page.locator('.mr2-section').nth(0).innerText(),/Heure/mi);
  assert.match(await page.locator('.mr2-section').nth(1).innerText(),/Visite non vérifiée/);
  assert.match(await page.locator('.mr2-section').nth(2).innerText(),/Aucun fichier de marché indexé/);
  const bosaLinks=await page.locator('.mr2-source-link').evaluateAll(nodes=>nodes.map(n=>n.href));
  assert(bosaLinks.some(l=>l.includes('www.publicprocurement.be/')));
  assert.equal(await page.locator('.drawer-footer a.primary').count(),1);
  await page.locator('#closeDrawer').click();
  await article(page,ted).locator('.open-tender').click();
  assert.match(await page.locator('.mr2-intro').innerText(),/PUBLICATION OFFICIELLE/);
  const tedPrimary=await page.locator('.drawer-footer a.primary').getAttribute('href');
  assert(tedPrimary.includes('ted.europa.eu'));
  await page.locator('#closeDrawer').click();
  await article(page,local).locator('.open-tender').click();
  assert.match(await page.locator('.mr2-section').last().innerText(),/Il ne s’agit pas nécessairement d’un appel d’offres ouvert/);
  assert.match(await page.locator('.mr2-intro').innerText(),/VEILLE COMMUNALE/);
  assert.equal(await page.locator('.drawer-footer a.primary').getAttribute('href'),local.sourceDocument);
  await page.screenshot({path:path.join(mdir,'tests/phase2-desktop.png'),animations:'disabled'});
  await page.locator('#closeDrawer').click();
  await cx.close();
  console.log('OK : 64 marchés réels, fiches TED/BOSA/locales et sources documentaires');
  const m=fixture('fixture:verified',{
    title:'<img src=x onerror=alert(1)> Levé de contrôle',
    visit:{status:'required',verified:true,date:'2026-11-02',time:'10:15',place:'Chantier A',
      registration:'Par courriel',registrationDeadline:'2026-10-31',contact:'Service technique',page:12,
      evidence:'Une visite obligatoire est requise.',sourceUrl:'https://www.publicprocurement.be/docs/visite.pdf'},
    documents:[{type:'csc',title:'Cahier des charges',url:'https://www.publicprocurement.be/docs/csc.pdf'},
      {type:'annexes',title:'Injectée',url:'javascript:alert(1)'}],
    requirements:[{text:'Une référence topographique similaire',verified:true,
      evidence:'Référence de mission comparable requise',
      sourceUrl:'https://www.publicprocurement.be/docs/csc.pdf',page:13}],
    url:'https://www.publicprocurement.be/publication-workspaces/example/general'
  });
  const review=fixture('fixture:review',{
    title:'Marché à vérifier',constraints:['Visite obligatoire annoncée le 18/10 — information à confirmer'],
    visit:{status:'required',verified:false,date:'2026-10-18'},
    documents:[],url:'https://ted.europa.eu/fr/notice/-/detail/12345-2026'
  });
  const fx=await browser.newContext({viewport:{width:1440,height:900}});
  const view=await fx.newPage();attach(view);
  await view.route('**/marcheradar/data.json*',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),data_origin:'test',collector_status:'ok',items:[m,review]})}));
  await view.goto(address,{waitUntil:'domcontentloaded'});await ready(view,2);
  await article(view,m).locator('.open-tender').click();
  assert.equal(await view.locator('.mr2-highlight.mr2-risk').count(),1);
  assert.match(await view.locator('.mr2-section').nth(1).innerText(),/Visite obligatoire/);
  assert.match(await view.locator('.mr2-section').nth(1).innerText(),/Chantier A/);
  assert.match(await view.locator('.mr2-section').nth(3).innerText(),/Une référence topographique similaire/);
  const docs=await view.locator('.mr2-source-link').evaluateAll(nodes=>nodes.map(x=>x.href));
  assert(docs.includes('https://www.publicprocurement.be/docs/csc.pdf'));
  assert(!docs.some(x=>x.startsWith('javascript:')));
  assert.equal(await view.locator('.mr2-intro img').count(),0,'injection HTML dans le titre');
  await view.locator('#marketNotes').fill('Prévoir visite; relire le CSC');
  await view.locator('#statusSelect').selectOption('answer');
  await view.locator('#saveTender').click();
  assert.equal(await view.locator('.tender').count(),1,'le marché classé doit quitter le Listing complet');
  await view.locator('[data-view="answer"]').click();
  await article(view,m).locator('.open-tender').click();
  assert.equal(await view.locator('#marketNotes').inputValue(),'Prévoir visite; relire le CSC');
  await view.locator('#closeDrawer').click();
  await view.locator('[data-view="inbox"]').click();
  await article(view,review).locator('.open-tender').click();
  assert.match(await view.locator('.mr2-section').nth(1).innerText(),/Mention de visite à vérifier/);
  assert.equal(await view.locator('.mr2-highlight.mr2-risk').count(),0,'ne pas affirmer une obligation sans source');
  assert.match(await view.locator('.mr2-section').nth(2).innerText(),/Aucun fichier de marché indexé/);
  await view.setViewportSize({width:390,height:844});
  const widths=await view.locator('.drawer.on').evaluate(e=>({drawer:e.getBoundingClientRect().width,view:window.innerWidth,scroll:e.scrollWidth}));
  assert(widths.drawer<=widths.view+1,'Le panneau déborde sur mobile');
  await view.screenshot({path:path.join(mdir,'tests/phase2-mobile.png'),animations:'disabled'});
  assert.deepEqual(errors,[],'Erreurs JS navigateur : '+errors.join('\n'));
  await fx.close();
  console.log('OK : visites prouvées/non prouvées, documents, sécurité XSS, conditions, responsive et suivi');
  console.log('SUCCÈS : la Phase 2 fonctionne dans Chromium sans modification de la production.');
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
})().catch(e=>{console.error(e.stack||e);srv.close();process.exitCode=1});
