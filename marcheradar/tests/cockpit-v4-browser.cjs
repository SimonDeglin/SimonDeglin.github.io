/* Marché Radar V4 — tests Chromium : dossiers prioritaires, typologie et cockpit.
 * Les données artificielles ne sont utilisées que par le test local.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const app=path.join(root,'marcheradar');
const html=fs.readFileSync(path.join(app,'index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert(script,'Script applicatif absent');
new vm.Script(script[1]);
new vm.Script(fs.readFileSync(path.join(app,'cockpit-v4.js'),'utf8'));
assert.match(html,/cockpit-v4\.js/);
assert.match(html,/cockpit-v4\.css/);
const mimetypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let requested;try{requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400).end();return}
 if(requested.endsWith('/'))requested+='index.html';
 const file=path.resolve(root,'.'+requested);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,content)=>{if(err){res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':mimetypes[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 });
});
function future(offset){
 const d=new Date(Date.now()+offset*86400000);
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function entry(id,more={}){
 return {id,title:'Essai '+id,description:'Mission de relevé topographique KDRIX',
 buyer:'Commune de test',source:'TED',noticeType:'cn-standard',sector:'Topo',sectors:['Topo'],
 score:80,screening:'main',region:'Wallonie',publication:future(-1),deadline:future(25),cpv:[],...more};
}
const fixtures=[
 entry('t1',{deadline:future(5)}),
 entry('t2',{source:'BOSA',noticeKind:'competition',noticeType:null,deadline:''}),
 entry('r1',{source:'BOSA',noticeKind:'award',noticeType:null,deadline:''}),
 entry('l1',{source:'LOCALE',noticeType:null,deadline:'',screening:'review'}),
 entry('l2',{source:'LOCALE',noticeType:null,deadline:'',screening:'excluded'}),
 entry('u1',{source:'BOSA',noticeType:null,deadline:''}),
 entry('t3',{deadline:future(-5)})
];
const errors=[];
async function ready(page,n){
 await page.waitForFunction(expected=>Number(document.querySelector('#resultCount')?.textContent)===expected,n,{timeout:20000});
 assert.equal(await page.locator('.tender').count(),n);
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/marcheradar/';
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e.stack||e)));
  await page.addInitScript(()=>{
   localStorage.setItem('kdrix.marcheRadar.v1',JSON.stringify({statuses:{t1:'answer',l2:'inbox'},favorites:{},notes:{},hiddenSectors:{}}));
  });
  await page.route('**/marcheradar/data.json*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),collector_status:'ok',data_origin:'test',items:fixtures})}));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await ready(page,6);
  assert.equal(await page.locator('[data-view="inbox"].active').count(),1,'Le dossier initial doit être Listing complet');
  assert.equal(await page.locator('article[data-id="t1"]').count(),0,'Le marché classé ne doit jamais rester dans le Listing complet');
  assert.equal(Number(await page.locator('[data-count="inbox"]').textContent()),6);
  assert.equal(Number(await page.locator('[data-count="answer"]').textContent()),1);
  assert.equal(await page.locator('.v4-metric').count(),4);
  assert.match(await page.locator('#cockpit').innerText(),/Appels d’offres à trier/);
  await page.screenshot({path:path.join(app,'tests/cockpit-v4-desktop.png'),animations:'disabled'});
  console.log('OK: dossiers primaires préservés, liste à six lignes, statistiques opérationnelles');
  await page.locator('#publicationFilters [data-publication="result"]').click();
  await ready(page,1);
  assert.equal(await page.locator('article[data-id="r1"]').count(),1);
  assert.equal(await page.locator('[data-view="inbox"].active').count(),1,'Le filtre de type ne change pas le dossier');
  await page.locator('[data-family="mesurage"]').click();
  await ready(page,1);
  assert.equal(await page.locator('[data-view="inbox"].active').count(),1,'Le filtre de domaine ne change pas le dossier');
  await page.locator('article[data-id="r1"] .open-tender').click();
  await page.locator('#quickOpenTender').click();
  assert.equal(await page.locator('.drawer.on').count(),1);
  assert.match(await page.locator('#drawerBody').innerText(),/Avis de résultat/);
  await page.locator('#closeDrawer').click();
  await page.locator('[data-view="answer"]').click();
  await ready(page,1);
  assert.equal(await page.locator('article[data-id="t1"]').count(),1);
  assert.equal(await page.locator('#publicationFilters [data-publication="all"].active').count(),1,'Le changement de dossier réinitialise le type');
  await page.locator('[data-view="inbox"]').click();
  await ready(page,6);
  await page.locator('#publicationFilters [data-publication="competition"]').click();
  await ready(page,2);
  assert.equal(Number(await page.locator('[data-family="mesurage"] .family-count').textContent()),2);
  await page.locator('article[data-id="t2"] [data-move]').selectOption('discarded');
  await ready(page,1);
  assert.equal(Number(await page.locator('[data-count="inbox"]').textContent()),1,'Le compteur du dossier doit tenir compte du filtre de type');
  await page.locator('[data-view="discarded"]').click();
  await ready(page,1);
  assert.equal(await page.locator('article[data-id="t2"]').count(),1,'Marché déplacé dans Sans suite');
  await page.locator('[data-family="mesurage"]').click();
  assert.equal(await page.locator('[data-view="discarded"].active').count(),1);
  await page.locator('article[data-id="t2"] [data-move]').selectOption('inbox');
  await ready(page,0);
  await page.locator('[data-view="inbox"]').click();
  await ready(page,6);
  console.log('OK: types, domaine, ouverture du dossier, classement et retour sans doublons');
  await page.locator('#cockpit [data-cockpit="result"]').click();
  await ready(page,1);
  assert.equal(await page.locator('[data-view="catalogue"].active').count(),1);
  assert.equal(await page.locator('article[data-id="r1"]').count(),1);
  await page.locator('#cockpit [data-cockpit="competition"]').click();
  await ready(page,2);
  assert.equal(await page.locator('[data-view="inbox"].active').count(),1);
  await page.locator('#publicationFilters [data-publication="prospect"]').click();
  await ready(page,2);
  await page.locator('article[data-id="l1"] .open-tender').click();
  const txt=await page.locator('#quickPreview').innerText();
  assert.match(txt,/aucune procédure ouverte confirmée/);
  console.log('OK: accès cockpit, résultats et prospection sans fausse échéance');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(app,'tests/cockpit-v4-mobile.png'),animations:'disabled'});
  assert.equal(await page.locator('.v4-kpi-grid .v4-metric').count(),4);
  await ctx.close();
  // Un clic doit sélectionner la lecture rapide et ne plus ouvrir la grande fiche.
  // L'archivage Hors sujet doit tenir malgré les rafraîchissements des sources.
  const clean=await browser.newContext({viewport:{width:1440,height:900}});
  // Cet extrait local a déjà été réintégré par l'utilisateur : sa décision prime.
  await clean.addInitScript(()=>{if(!localStorage.getItem('kdrix.marcheRadar.v1'))localStorage.setItem('kdrix.marcheRadar.v1',JSON.stringify({statuses:{l2:'inbox'},notes:{},favorites:{},hiddenSectors:{}}))});
  const dynamic=await clean.newPage();
  dynamic.on('pageerror',e=>errors.push(String(e.stack||e)));
  await dynamic.route('**/marcheradar/data.json*',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),collector_status:'ok',data_origin:'test',items:fixtures})}));
  await dynamic.goto(url,{waitUntil:'domcontentloaded'});await ready(dynamic,7);
  assert.equal(await dynamic.locator('[data-count="irrelevant"]').innerText(),'0');
  await dynamic.locator('article[data-id="t2"] .open-tender').click();
  assert.match(await dynamic.locator('#quickPreview').innerText(),/Essai t2/);
  assert.equal(await dynamic.locator('article[data-id="t2"].v5-selected').count(),1,'La ligne choisie doit être identifiée');
  assert.equal(await dynamic.locator('.drawer.on').count(),0,'Un clic normal ne doit pas ouvrir le grand panneau');
  await dynamic.locator('#quickPreview').evaluate(e=>e.scrollTop=e.scrollHeight);
  await dynamic.locator('article[data-id="r1"]').click({position:{x:250,y:20}});
  assert.equal(await dynamic.locator('#quickPreview').evaluate(e=>e.scrollTop),0,'Changer de marché doit remettre le titre de l’aperçu en vue');
  assert.match(await dynamic.locator('#quickPreview').innerText(),/Essai r1/);
  assert.equal(await dynamic.locator('.drawer.on').count(),0);
  await dynamic.locator('article[data-id="t2"] .open-tender').focus();
  await dynamic.keyboard.press('Enter');
  assert.match(await dynamic.locator('#quickPreview').innerText(),/Essai t2/);
  assert.equal(await dynamic.locator('.drawer.on').count(),0,'Le clavier suit la même navigation rapide');
  await dynamic.locator('#quickOpenTender').click();
  assert.equal(await dynamic.locator('.drawer.on').count(),1,'Le grand panneau reste accessible explicitement');
  await dynamic.locator('#marketNotes').fill('Note de suivi préservée — essai');
  await dynamic.locator('#saveTender').click();
  assert.match(await dynamic.locator('#quickPreview').innerText(),/Note de suivi préservée/);
  await dynamic.locator('#quickDismissTender').click();
  await ready(dynamic,6);
  assert.equal(await dynamic.locator('article[data-id="t2"]').count(),0,'Hors sujet doit sortir du Listing complet');
  assert.equal(Number(await dynamic.locator('[data-count="irrelevant"]').textContent()),1);
  await dynamic.locator('[data-view="catalogue"]').click();
  await ready(dynamic,6);
  assert.equal(await dynamic.locator('article[data-id="t2"]').count(),0,'Hors sujet ne doit pas revenir dans Historique général');
  await dynamic.reload({waitUntil:'domcontentloaded'});await ready(dynamic,6);
  assert.equal(Number(await dynamic.locator('[data-count="irrelevant"]').textContent()),1,'Classement conservé après actualisation complète des marchés');
  await dynamic.locator('#search').fill('aucune-correspondance');
  await ready(dynamic,0);
  await dynamic.locator('[data-view="irrelevant"]').click();await ready(dynamic,1);
  assert.equal(await dynamic.locator('#search').inputValue(),'','Entrer dans Hors sujet doit nettoyer le filtre masquant les archives');
  assert.equal(await dynamic.locator('article[data-id="t2"]').count(),1);
  await dynamic.locator('article[data-id="t2"] .open-tender').click();
  assert.match(await dynamic.locator('#quickPreview').innerText(),/Note de suivi préservée/);
  await dynamic.locator('#quickDismissTender').click();
  await ready(dynamic,0);
  assert.equal(Number(await dynamic.locator('[data-count="irrelevant"]').textContent()),0);
  await dynamic.locator('[data-view="inbox"]').click();await ready(dynamic,7);
  await dynamic.locator('article[data-id="t2"] [data-irrelevant]').click();
  await ready(dynamic,6);
  await dynamic.locator('[data-view="irrelevant"]').click();await ready(dynamic,1);
  await dynamic.locator('article[data-id="t2"] [data-move]').selectOption('inbox');
  await ready(dynamic,0);
  await dynamic.locator('[data-view="inbox"]').click();await ready(dynamic,7);
  await dynamic.locator('article[data-id="t2"] [data-open-full]').click();
  assert.equal(await dynamic.locator('.drawer.on').count(),1);
  await dynamic.locator('#statusSelect').selectOption('irrelevant');
  await dynamic.locator('#saveTender').click();
  await ready(dynamic,6);
  await dynamic.locator('[data-view="irrelevant"]').click();await ready(dynamic,1);
  await dynamic.locator('[data-view="inbox"]').click();
  await ready(dynamic,6);
  console.log('OK: lecture rapide au clic et au clavier, fiche explicite, Hors sujet restaurable, notes et actualisation');
  await dynamic.setViewportSize({width:390,height:844});
  await dynamic.locator('#mobileMenu').click();
  await dynamic.locator('[data-view="irrelevant"]').click();await ready(dynamic,1);
  assert.equal(await dynamic.locator('article[data-id="t2"] [data-open-full]').count(),1,'Fiche accessible sur petit écran');
  await dynamic.screenshot({path:path.join(app,'tests/cockpit-v4b-mobile.png'),animations:'disabled'});
  // Une catégorie masquée dans les préférences ne doit jamais empêcher de restaurer.
  await dynamic.evaluate(()=>{
   const key='kdrix.marcheRadar.v1',s=JSON.parse(localStorage.getItem(key));
   s.hiddenSectors={Topo:true};localStorage.setItem(key,JSON.stringify(s));
  });
  await dynamic.reload({waitUntil:'domcontentloaded'});await ready(dynamic,0);
  await dynamic.locator('#mobileMenu').click();
  await dynamic.locator('[data-view="irrelevant"]').click();await ready(dynamic,1);
  await dynamic.locator('article[data-id="t2"] .open-tender').click();
  assert(await dynamic.locator('#quickPreview').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight}), 'Lecture rapide immédiatement visible sur mobile');
  assert.equal(await dynamic.locator('.drawer.on').count(),0);
  await dynamic.locator('#quickDismissTender').click();await ready(dynamic,0);
  console.log('OK: Hors sujet accessible malgré les métiers masqués, aperçu mobile visible');
  await clean.close();
  const fallback=await browser.newContext({viewport:{width:1280,height:800}});
  const broken=await fallback.newPage();
  broken.on('pageerror',e=>errors.push(String(e.stack||e)));
  await broken.route('**/marcheradar/cockpit-v4.js*',r=>r.abort('failed'));
  await broken.goto(url,{waitUntil:'domcontentloaded'});
  const currentData=require('../data.json');
  const expected=currentData.items.filter(x=>x.region!=='Flandre'&&x.screening!=='excluded').length;
  await ready(broken,expected);
  assert.equal(await broken.locator('#resultsList .v5-full-open').count(),expected);
  await broken.locator('#resultsList .v5-full-open').first().click();
  assert.equal(await broken.locator('.drawer.on').count(),1);
  await fallback.close();
  assert.deepEqual(errors,[],'Erreurs JavaScript navigateur : '+errors.join('\n'));
  console.log('SUCCÈS: V4 avec fallback si module indisponible, anciens dossiers conservés et mobile testé');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error(err.stack||err);server.close();process.exitCode=1});
