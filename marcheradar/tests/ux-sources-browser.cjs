'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),errors=[];
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=decodeURIComponent(u.pathname);const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'text/plain'}).end(data)})});
const items=Array.from({length:40},(_,i)=>({id:'long-'+i,title:'Mission de géomètre '+i,source:'BOSA',buyer:'Commune de test',description:'Prestations de levés topographiques.',region:'Wallonie',sectors:['Topo'],sector:'Topo',score:80,publication:'2026-10-28',deadline:'',screening:'main',noticeKind:'competition',cpv:[]}));
const sources={BOSA:{status:'unavailable',last_success:'2026-10-28T21:09:57Z',last_attempt:'2026-10-29T08:00:00Z',last_error:'HTTP 503',complete:true,pages:106,scanned:2650,period_from:'2026-10-14',period_to:'2026-10-28'}};
const data={items,generated_at:'2026-10-28T21:00:00Z',collector_status:'ok',sources};
const communes=[{name:'Commune Liège',ins:'62001',officialSite:'https://liege.test',lastSiteCheck:'2026-10-28T12:00:00Z',documentsRead:2,deliberationSources:[{url:'https://liege.test/conseil',title:'Conseil',status:'page_accessible',last_success:'2026-10-28T12:00:00Z'}]},
 {name:'Commune Namur',ins:'92001',officialSite:'https://namur.test',sourceStatus:'site_indisponible',errors:['HTTP 503'],lastSiteCheck:'2026-10-28T13:00:00Z'},
 {name:'Autre commune',ins:'62002',officialSite:'https://autre.test'}];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/marcheradar/';
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});await ctx.route('**/marcheradar/data.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
  await ctx.route('**/marcheradar/communes.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({communes,counts:{sitesVerifies:999,documentsRead:999}})}));
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(base);await page.waitForFunction(()=>document.querySelector('#resultCount').textContent==='40');
  assert.equal(await page.locator('.v5-selected').count(),0);assert.equal(await page.locator('#quickOpenTender').count(),0,'Aucune sélection automatique');
  const row=page.locator('article[data-id="long-24"] .open-tender');await row.scrollIntoViewIfNeeded();const position=await page.evaluate(()=>scrollY);await row.click();
  assert.match(await page.locator('#quickPreview').innerText(),/Mission de géomètre 24/);
  const panel=await page.locator('#quickPreview').boundingBox();assert(panel.y>=75&&panel.y<140,'Le panneau suit la liste au 25e marché');
  assert(Math.abs(await page.evaluate(()=>scrollY)-position)<2,'Le clic ne remonte pas la page');assert.equal(await page.locator('.drawer.on').count(),0);
  await page.screenshot({path:path.join(__dirname,'ux-preview-25th.png')});
  await row.click();assert.equal(await page.locator('#quickOpenTender').count(),0);assert.equal(await page.locator('.v5-selected').count(),0);
  await row.click();await page.locator('#clearQuickPreview').click();assert.equal(await page.locator('#quickOpenTender').count(),0);
  await row.click();await page.keyboard.press('Escape');assert.equal(await page.locator('#quickOpenTender').count(),0);
  await page.locator('#refreshBtn').click();await page.waitForFunction(()=>!document.querySelector('#refreshBtn').disabled);assert.equal(await page.locator('#quickOpenTender').count(),0,'Une actualisation ne recrée pas une sélection');
  // Vérifier un écran étroit : aperçu flottant, sans déplacement du document.
  await page.setViewportSize({width:390,height:844});await row.scrollIntoViewIfNeeded();const mobileY=await page.evaluate(()=>scrollY);await row.click();
  const mobile=await page.locator('#quickPreview').boundingBox();assert(mobile.y>=0&&mobile.y+mobile.height<=844);
  assert(Math.abs(await page.evaluate(()=>scrollY)-mobileY)<2);await page.locator('#clearQuickPreview').click();assert.equal(await page.locator('.v5-selected').count(),0);
  const dashboard=await ctx.newPage();dashboard.on('pageerror',e=>errors.push(String(e)));await dashboard.setViewportSize({width:1440,height:1000});await dashboard.goto(base+'communes.html');await dashboard.waitForSelector('tr[data-ins]');
  assert.match(await dashboard.locator('#bosaHealth').innerText(),/échec/);assert.match(await dashboard.locator('#bosaHealth').innerText(),/22:09/);assert.match(await dashboard.locator('#bosaHealth').innerText(),/HTTP 503/);
  assert.equal(await dashboard.locator('tr[data-ins]').count(),3);assert.doesNotMatch(await dashboard.locator('#summary').innerText(),/999/);
  await dashboard.locator('[data-province="liege"]').click();assert.equal(await dashboard.locator('tr[data-ins]').count(),2);
  await dashboard.locator('#status').selectOption('pending');assert.equal(await dashboard.locator('tr[data-ins]').count(),1);
  await dashboard.locator('#status').selectOption('all');await dashboard.locator('tr[data-ins="62001"] .row-launch').click();
  assert.equal(await dashboard.locator('#collectProvince').inputValue(),'liege');assert.equal(await dashboard.locator('#collectCommune').inputValue(),'62001');assert.match(await dashboard.locator('#launchInstructions').innerText(),/cette commune uniquement/);
  assert.match(await dashboard.locator('#launchCommunes').getAttribute('href'),/actions\/workflows\/marcheradar-communes/);
  await dashboard.screenshot({path:path.join(__dirname,'sources-dashboard.png')});
  await dashboard.route('**/marcheradar/data.json*',r=>r.fulfill({status:503,body:'indisponible'}));await dashboard.locator('#reload').click();await dashboard.waitForFunction(()=>!document.querySelector('#reload').disabled);
  assert(await dashboard.locator('#sourceError').isVisible());assert.equal(await dashboard.locator('#bosaHealth').count(),0,'Un échec de lecture ne doit pas conserver une carte prétendument à jour');
  assert.deepEqual(errors,[]);console.log('UX_SOURCES_BROWSER_OK : 25e marché, panneau visible, désélection, mobile, sources, erreurs, provinces et préparation INS');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
