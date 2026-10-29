'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const reader=require('../tools/communes-documents.cjs'),discovery=require('../tools/communes-discovery.cjs'),policy=require('../tools/communal-source-policy.cjs'),type=require('../tools/web-publication-type.cjs'),queue=require('../tools/municipal-queue.cjs');
test('Hannut / WordPress : liens de téléchargement sans .pdf et timestamp de cache stabilisé',()=>{
 const html='<a href="/download/proces-verbal-90/?tmstv=123">Procès verbal</a><a href="/download/proces-verbal-90/?tmstv=456">Procès verbal</a><a href="/download/ordre-du-jour-90/?id=42&amp;tmstv=789">Ordre du jour</a><a href="/download/jeu/">Jeu</a>';
 const found=reader.fileLinks(html,'https://www.hannut.be/');assert.equal(found.length,2);
 assert.equal(found[0].url,'https://www.hannut.be/download/proces-verbal-90/');assert.match(found[1].url,/id=42/);assert(!found[1].url.includes('tmstv'));
});
test('ne pas parcourir les conseils d’enfants ni les interpellations, conserver les vrais conseils',()=>{
 const root='https://www.commune.test/';
 const html='<a href="/conseil-communal-des-enfants">Conseil communal des enfants</a><a href="/conseil-communal/">Conseil communal</a><a href="/conseil-communal/interpellation-citoyenne">Demande d’interpellation citoyenne</a><a href="https://www.deliberations.be/test/decisions">Décisions du conseil communal</a>';
 const links=discovery.links(html,root);assert.equal(links.length,2);assert(links.some(x=>x.url.includes('deliberations.be')));
 assert(policy.excluded({url:root+'conseil-consultatif-des-aines',title:'Conseil consultatif'}));assert.equal(policy.excluded({url:root+'conseil-communal',title:'Conseil communal'}),null);
});
test('découverte par sitemap lorsque la page d’accueil ne fournit pas les liens',async()=>{
 const base='https://www.commune.test/';
 const found=await discovery.sitemapCandidates(base,async url=>({url,content:url.endsWith('robots.txt')?'Sitemap: '+base+'sitemap.xml':url.endsWith('sitemap.xml')?'<sitemap><loc>'+base+'pages.xml</loc></sitemap>':'<url><loc>'+base+'conseil-communal</loc></url>'}));
 assert.equal(found.length,1);assert.equal(found[0].url,base+'conseil-communal');
});
test('la nature du document communal repose sur une mention explicite, pas sur la seule approbation du CSC',()=>{
 assert.equal(type.classify('PV conseil','Le conseil approuve le cahier spécial des charges pour désigner un géomètre.').kind,'prospection');
 assert.equal(type.classify('PV conseil','Le conseil décide d’attribuer le marché de géomètre à la société X.').kind,'award');
 assert.equal(type.classify('Avis de marché — géomètre','Les offres doivent être déposées avant la date limite.').kind,'competition');
 assert.equal(type.classify('PV conseil','Le conseil renonce au marché, déclaré sans suite.').kind,'other');
});
test('l’ordre des documents suit la source lors de leur première découverte plutôt que les noms triés',()=>{
 const q=queue.init({});for(const n of [99,98,70])queue.remember(q,'documents',{url:'https://x.test/pv-'+n+'.pdf'},'2026-10-29T08:00:00Z');
 assert.equal(queue.pendingDocuments(q,{},'2026-10-29T09:00:00Z')[0][1].url,'https://x.test/pv-99.pdf');
});

test('un ordre du jour annonçant une décision d’attribuer reste un signal de prospection',()=>{
 assert.equal(type.classify('Ordre du jour','Le conseil décide d’attribuer le marché de géomètre.').kind,'prospection');
});
test('les références et points explicites regroupent des passages, sans fusionner des références différentes',()=>{
 const signals=require('../tools/municipal-signals.cjs');
 const sectionHeading='8. Étude de rénovation de voirie — décision';
 const list=[{page:1,excerpt:'Cahier des charges N° 2026/486 pour la mission de géomètre.',sectionHeading},{page:2,excerpt:'Le cahier des charges N° 2026/486 définit les plans.',sectionHeading},{page:3,excerpt:'Cahier des charges N° 2026/999 pour un autre marché.',sectionHeading}];
 const groups=signals.group(list);assert.equal(groups.length,2);assert.equal(groups[0].relatedPassages.length,2);
 assert.equal(signals.group([{page:1,excerpt:'Le conseil approuve une mission de géomètre.',sectionHeading},{page:2,excerpt:'Les prestations de cette mission seront financées.',sectionHeading}]).length,1);
});
test('les nominations administratives ne créent pas de piste métier',()=>{
 assert.equal(reader.passages('26) Désignation d’un agent constatateur sur base du décret relatif à la voirie communale – Décision').length,0);
 const text='8. Projet de réaménagement de la place communale – Décision\nLe conseil approuve le projet et le budget pour une étude de voirie.';
 assert(reader.passages(text).length>0);
});
