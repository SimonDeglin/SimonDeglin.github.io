'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'text/plain'}).end(b)})});
const item=(id,more={})=>({id,title:'Mission '+id,description:'Prestations de géomètre.',buyer:'Commune de test',source:'BOSA',noticeKind:'competition',region:'Wallonie',sector:'Topo',sectors:['Topo'],score:80,screening:'main',publication:'2026-10-29',deadline:'2027-11-01',...more});
const items=[item('shared',{source:'TED',noticeKind:undefined,noticeType:'cn-standard',officialSources:[{source:'TED'},{source:'BOSA',noticeKind:'award',url:'https://www.publicprocurement.be/publication-workspaces/00000000-0000-4000-8000-000000000001/general'}]}),item('bosa'),item('other',{noticeKind:'other'}),item('web-call',{source:'LOCALE',municipalityINS:'61003'}),item('web-award',{source:'LOCALE',municipalityINS:'61003',noticeKind:'award'}),item('web-prospect',{source:'LOCALE',municipalityINS:'61003',noticeKind:undefined,deadline:''}),item('province',{source:'LOCALE',buyer:'Province de Liège',noticeKind:undefined,deadline:''})];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:950}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/marcheradar/data.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({items,generated_at:new Date().toISOString(),collector_status:'ok',data_origin:'test'})}));await page.goto('http://127.0.0.1:'+server.address().port+'/marcheradar/');
  const ready=async n=>{await page.waitForFunction(n=>document.querySelector('#resultCount').textContent===String(n),n);assert.equal(await page.locator('article.tender').count(),n)};
  const source=async id=>page.locator('[data-source-filter="'+id+'"]').click(),type=async id=>page.locator('#publicationFilters [data-publication="'+id+'"]').click();
  await ready(7);assert.equal(await page.locator('[data-source-filter="BOSA"] .v4-type-count').innerText(),'3');assert.equal(await page.locator('[data-source-filter="municipal"] .v4-type-count').innerText(),'3');
  await source('municipal');await ready(3);await type('competition');await ready(1);assert.equal(await page.locator('article[data-id="web-call"]').count(),1);
  await type('result');await ready(1);assert.equal(await page.locator('article[data-id="web-award"]').count(),1);
  await type('prospect');await ready(1);assert.equal(await page.locator('article[data-id="web-prospect"]').count(),1);await type('unknown');await ready(0);
  await source('BOSA');await ready(3);await type('result');await ready(1);assert.equal(await page.locator('article[data-id="shared"]').count(),1);assert.match(await page.locator('article.tender .v4-kind').innerText(),/Attribution/);
  await page.locator('article.tender .open-tender').click();assert.match(await page.locator('#quickPreview').innerText(),/aucune soumission/);assert.doesNotMatch(await page.locator('#quickPreview .v4-kind').innerText(),/Appel/);
  await page.locator('#quickOpenTender').click();assert.match(await page.locator('.mr2-intro').innerText(),/Avis de résultat/);assert.match(await page.locator('.drawer-footer a.primary').getAttribute('href'),/publicprocurement/);await page.locator('#closeDrawer').click();
  await page.screenshot({path:path.join(__dirname,'source-type-bosa-attribution.png')});
  await source('TED');await ready(1);await type('result');await ready(0);await type('competition');await ready(1);
  await source('other');await ready(1);assert.equal(await page.locator('article[data-id="province"]').count(),1);assert.match(await page.locator('article.tender').innerText(),/Autres sites publics/);
  await source('BOSA');await type('unknown');await ready(1);assert.equal(await page.locator('article[data-id="other"]').count(),1);
  await source('all');await ready(7);assert.equal(new Set(await page.locator('article.tender').evaluateAll(a=>a.map(x=>x.dataset.id))).size,7);
  await page.setViewportSize({width:390,height:844});const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(sizes.scroll<=sizes.width+1,'Les deux niveaux de filtres ne doivent pas déborder sur mobile');
  assert.deepEqual(errors,[]);console.log('SOURCE_TYPE_BROWSER_OK : filtres indépendants, avis multi-sources, attribution, prospection, autres et mobile');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
