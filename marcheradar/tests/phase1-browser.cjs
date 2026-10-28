/* Tests de régression Phase 1 — exécution sur une copie locale de Marché Radar.
 * Aucun test n'écrit sur le site public ni ne modifie les données officielles.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const real=JSON.parse(fs.readFileSync(path.join(root,'marcheradar/data.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'marcheradar/index.html'),'utf8');
const block=html.match(/<script>([\s\S]*?)<\/script>/);
assert(block,'Le script principal est introuvable');
new (require('node:vm').Script)(block[1],{filename:'marcheradar/index.html'});
assert(Array.isArray(real.items)&&real.items.length>0,'Les marchés existants doivent être conservés');
const initialIds=new Set(real.items.filter(x=>x.region!=='Flandre').map(x=>x.id));
assert.equal(initialIds.size,real.items.filter(x=>x.region!=='Flandre').length,'Les identifiants doivent être uniques');
const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch(e){res.writeHead(400).end();return}
 if(pathname.endsWith('/'))pathname+='index.html';
 const full=path.resolve(root,'.'+pathname);
 if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(full,(e,data)=>{
  if(e){res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
});
function brusselsDay(offset){
 const d=new Date(Date.now()+offset*86400000);
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const get=x=>p.find(y=>y.type===x).value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
function item(id,deadline,source='TED'){
 return {id:'fixture:'+id,title:'Contrôle '+id,description:'Mission de voirie et études techniques',buyer:'Commune de test',
  region:'Wallonie',source,sector:'VRD',sectors:['VRD'],screening:'main',score:90,
  publication:brusselsDay(-10),deadline,cpv:[]};
}
const fixtures=[
 item('future',brusselsDay(3)),item('today',brusselsDay(0)),
 item('past',brusselsDay(-3)),item('unknown',''),
 item('local','', 'LOCALE'),item('hour-future',new Date(Date.now()+7200000).toISOString()),
 item('hour-past',new Date(Date.now()-7200000).toISOString())
];
const browserErrors=[];
async function loadPage(page,url,expected){
 page.on('pageerror',e=>browserErrors.push(String(e.stack||e)));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(n=>Number(document.getElementById('resultCount')?.textContent)===n,expected,{timeout:20000});
 assert.equal(await page.locator('.tender').count(),expected,'Nombre de lignes incorrect');
 assert.equal(Number(await page.locator('[data-count="inbox"]').textContent()),expected,'Compteur Listing complet incorrect');
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/marcheradar/';
 const options={headless:true};
 for(const executable of ['/usr/bin/google-chrome','/usr/bin/chromium']){
  if(fs.existsSync(executable)){options.executablePath=executable;break}
 }
 const browser=await chromium.launch(options);
 try{
  // 1. Test de chargement et d'intégrité de la base existante.
  const first=await browser.newContext({viewport:{width:1440,height:900}});
  const realPage=await first.newPage();
  await loadPage(realPage,url,initialIds.size);
  assert.equal((await realPage.locator('[data-view="inbox"]').getAttribute('class')).includes('active'),true,'Le dossier initial doit être Listing complet');
  assert.equal(await realPage.locator('article.tender').count(),initialIds.size);
  await first.close();
  console.log('OK: données existantes, affichage et compteurs du dossier initial ('+initialIds.size+' marchés)');
  // 2. Jeux de données déterministes : dates civiles, heures et prospection locale.
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.route('**/marcheradar/data.json*',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),data_origin:'test',collector_status:'ok',items:fixtures})
  }));
  await loadPage(page,url,7);
  assert.equal(Number(await page.locator('[data-family="voirie"] .family-count').textContent()),7);
  await page.locator('[data-family="voirie"]').click();
  assert.equal(await page.locator('[data-view="inbox"].active').count(),1,'Cliquer sur un domaine ne doit pas changer le dossier');
  assert.equal(await page.locator('.tender').count(),7);
  await page.locator('[data-family="voirie"]').click();
  await page.locator('article[data-id="fixture:future"] select[data-move]').selectOption('discarded');
  assert.equal(await page.locator('.tender').count(),6,'Le marché déplacé reste affiché dans Listing complet');
  assert.equal(Number(await page.locator('[data-count="inbox"]').textContent()),6);
  assert.equal(Number(await page.locator('[data-count="discarded"]').textContent()),1);
  await page.locator('[data-view="discarded"]').click();
  assert.equal(await page.locator('.tender').count(),1,'Sans suite doit contenir le marché déplacé');
  assert.equal(await page.locator('article[data-id="fixture:future"]').count(),1);
  await page.locator('[data-family="voirie"]').click();
  assert.equal(await page.locator('[data-view="discarded"].active').count(),1,'Le filtre métier a changé le dossier');
  assert.equal(Number(await page.locator('[data-family="voirie"] .family-count').textContent()),1);
  await page.locator('.v5-full-open').click();
  await page.locator('#marketNotes').fill('Note persistante — test phase 1');
  await page.locator('#saveTender').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Number(document.getElementById('resultCount')?.textContent)===6);
  await page.locator('[data-view="discarded"]').click();
  await page.locator('.v5-full-open').click();
  assert.equal(await page.locator('#marketNotes').inputValue(),'Note persistante — test phase 1');
  await page.locator('#statusSelect').selectOption('inbox');
  await page.locator('#saveTender').click();
  assert.equal(await page.locator('.tender').count(),0,'Le dossier Sans suite doit être vide après retour');
  await page.locator('[data-view="inbox"]').click();
  assert.equal(await page.locator('.tender').count(),7);
  await page.locator('article[data-id="fixture:future"] .v5-full-open').click();
  assert.equal(await page.locator('#marketNotes').inputValue(),'Note persistante — test phase 1');
  await page.locator('#closeDrawer').click().catch(async()=>await page.keyboard.press('Escape'));
  console.log('OK: déplacement, catégories limitées au dossier, retour, notes et persistance');
  // 3. Dates et source locale sans limite officielle.
  for(const [value,count] of [['open',4],['closed',2],['unknown',1],['all',7]]){
   await page.locator('#dueFilter').selectOption(value);
   assert.equal(await page.locator('.tender').count(),count,'Filtre échéance '+value);
   assert.equal(Number(await page.locator('[data-family="voirie"] .family-count').textContent()),count,'Compteur domaine sous filtre '+value);
   assert.equal(Number(await page.locator('[data-count="inbox"]').textContent()),count,'Compteur dossier sous filtre '+value);
  }
  await page.locator('#dueFilter').selectOption('open');
  assert.equal(await page.locator('article[data-id="fixture:local"]').count(),1,'La prospection locale sans date doit rester ouverte');
  assert.equal(await page.locator('article[data-id="fixture:unknown"]').count(),0,'Une procédure sans date vérifiée ne peut être déclarée ouverte');
  await page.locator('#dueFilter').selectOption('all');
  // La recherche filtre les listes et les compteurs, sans changer le dossier.
  await page.locator('#search').fill('Contrôle today');
  assert.equal(await page.locator('.tender').count(),1);
  assert.equal(Number(await page.locator('[data-family="voirie"] .family-count').textContent()),1);
  await page.locator('#search').fill('');
  assert.equal(await page.locator('.tender').count(),7);
  console.log('OK: échéances, heures, prospect local, recherche et compteurs');
  // Les extraits locaux écartés par la préqualification ne sont pas des marchés ouverts.
  const rejectedPage=await context.newPage();
  const rejected={...item('local-rejected','', 'LOCALE'),screening:'excluded'};
  await rejectedPage.route('**/marcheradar/data.json*',route=>route.fulfill({
   status:200,contentType:'application/json',
   body:JSON.stringify({schema_version:2,items:[item('local-prospect','', 'LOCALE'),rejected]})
  }));
  await loadPage(rejectedPage,url,2);
  await rejectedPage.locator('#dueFilter').selectOption('open');
  assert.equal(await rejectedPage.locator('.tender').count(),1,'Un extrait écarté ne doit pas être qualifié de prospection ouverte');
  await rejectedPage.locator('#dueFilter').selectOption('unknown');
  assert.equal(await rejectedPage.locator('article[data-id="fixture:local-rejected"]').count(),1,'L extrait écarté demeure consultable pour vérification');
  await rejectedPage.close();
  console.log('OK: extraits locaux rejetés non présentés comme opportunités ouvertes');
  await context.close();
  assert.deepEqual(browserErrors,[],'Erreurs JavaScript dans le navigateur : '+browserErrors.join('\n'));
  console.log('SUCCÈS : tous les tests de Phase 1 sont passés. Aucune publication sur main.');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e.stack||e);server.close();process.exitCode=1});
