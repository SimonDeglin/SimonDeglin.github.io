'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),profile=require('../tools/kdrix-profile.cjs');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(f,(err,b)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(f)]||'text/plain'}).end(b)})});
const item=(id,title)=>{const m={id,title,description:title,region:'Wallonie',buyer:'Commune',source:'BOSA',cpv:[],deadline:'',publication:'2026-10-29',noticeKind:'competition'};const r=profile.screen(m);return {...m,...(r.classification||{screening:'excluded',sector:'VRD',sectors:['VRD'],score:20,screeningReason:r.reason})}};
const items=[item('architecture','Mission complète d’auteur de projet pour la restauration d’une église'),item('topo','Prestations de géomètre pour divisions parcellaires'),item('automatic','Cahier spécial des charges — accès Internet'),item('manual','Cahier spécial des charges — abonnement Internet')];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:950}});
  const initial={statuses:{manual:'answer'},notes:{manual:'Décision et note à conserver'},favorites:{manual:true},hiddenSectors:{}};
  await ctx.addInitScript(state=>{if(!localStorage.getItem('kdrix.marcheRadar.v1'))localStorage.setItem('kdrix.marcheRadar.v1',JSON.stringify(state))},initial);
  await ctx.route('**/marcheradar/data.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({items,collector_status:'ok',generated_at:new Date().toISOString(),data_origin:'test'})}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port+'/marcheradar/');
  const ready=async n=>{await page.waitForFunction(n=>document.querySelector('#resultCount').textContent===String(n),n);assert.equal(await page.locator('article.tender').count(),n)};
  await ready(2);assert.equal(await page.locator('[data-count="screened"]').innerText(),'1');assert.equal(await page.locator('[data-count="answer"]').innerText(),'1');
  await page.locator('article[data-id="architecture"] .open-tender').click();assert.match(await page.locator('.mr-qualification').innerText(),/Mission architecturale/);assert.match(await page.locator('article[data-id="architecture"]').innerText(),/Mission à qualifier/);
  assert.doesNotMatch(await page.locator('article[data-id="architecture"] .tag-group').innerText(),/voirie/);
  assert.equal(await page.locator('[data-family="autres"] .family-count').innerText(),'1','Pas de faux métier réajouté à l’affichage');
  await page.screenshot({path:path.join(__dirname,'qualification-kdrix.png')});
  await page.locator('[data-view="screened"]').click();await ready(1);await page.locator('article[data-id="automatic"] .open-tender').click();
  assert.match(await page.locator('.mr-qualification').innerText(),/sans prestation métier/);assert.match(await page.locator('#quickDismissTender').innerText(),/Réintégrer/);
  await page.screenshot({path:path.join(__dirname,'exclusions-filtre.png')});
  await page.locator('#quickDismissTender').click();await ready(0);await page.locator('[data-view="inbox"]').click();await ready(3);
  await page.reload();await ready(3);assert.equal(await page.locator('[data-count="screened"]').innerText(),'0');
  await page.locator('[data-view="answer"]').click();await ready(1);await page.locator('article[data-id="manual"] .open-tender').click();assert.match(await page.locator('#quickPreview').innerText(),/Décision et note à conserver/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kdrix.marcheRadar.v1')));assert.equal(saved.statuses.manual,'answer');assert.equal(saved.favorites.manual,true);assert.equal(saved.statuses.automatic,'inbox');
  await page.locator('[data-view="catalogue"]').click();await ready(4);
  assert.deepEqual(errors,[]);console.log('QUALITY_BROWSER_OK : qualification, catégories exactes, exclusions, réintégration et suivi conservés');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
