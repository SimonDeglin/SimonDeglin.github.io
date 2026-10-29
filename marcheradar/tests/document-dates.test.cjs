'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const dates=require('../document-dates.js'),collector=require('../tools/communes-documents.cjs'),cockpit=require('../cockpit-v4.js'),detail=require('../detail-phase2.js');
const url='https://commune.be/pv.pdf';
test('séance et date du document distinctes, preuve de la page et de la version',()=>{
 const d=dates.extract({url,sha256:'hash',text:'Hannut, le 15 avril 2026\nLe prochain Conseil communal qui se déroulera le jeudi 23 avril 2026 à 19h45\nVu la loi du 8 juillet 1976'});
 assert.equal(d.session.date,'2026-04-23');assert.equal(d.document.date,'2026-04-15');assert.equal(d.session.page,1);assert.equal(d.sha256,'hash');
 const m={source:'LOCALE',sourceDocument:url,sourceDocumentDates:d};assert.match(dates.view(m).summary,/Séance du 23\/04\/2026 · document du 15\/04\/2026/);
 assert.match(cockpit.preview(m,'À définir','unknown'),/23\/04\/2026/);assert.match(detail.render(m).html,/15\/04\/2026/);
});
test('entête en colonnes, accents, date numérique et contrôle des jours invalides',()=>{
 assert.equal(dates.extract({text:'Conseil communal\nSecrétariat Conseil     Séance du 21 mai 2026\nProcès-verbal'}).session.date,'2026-05-21');
 assert.equal(dates.extract({text:'=== CONSEIL DU 01 DÉCEMBRE 2022 ==='}).session.date,'2022-12-01');
 assert.equal(dates.extract({text:'Séance publique du lundi 22 juin 2026\nProcès-verbal de la séance du 06 mai 2026'}).session.date,'2026-06-22');
 assert.equal(dates.parse('31/02/2026'),null);assert.equal(dates.parse('29/02/2024'),'2024-02-29');assert.equal(dates.parse('1er août 2026'),'2026-08-01');assert.equal(dates.parse('01/13/2026'),null);
});
test('refuser dates de lois, références, contrôles HTTP et dates citées en corps de texte',()=>{
 const d=dates.extract({text:'Vu la loi du 8 juillet 1976\nLe conseil approuve le procès-verbal de la séance du 02 mai 2026\nCSC 2026/477\nDélibération du Conseil communal du 3 mars 2025',url});assert.equal(d.status,'unknown');
 const v=dates.view({source:'LOCALE',sourceDocument:url,sourceDocumentVersion:{checkedAt:'2026-10-29T10:00:00Z'}});assert.equal(v.date,'');assert.match(v.summary,/non identifiée/);
});
test('nom de fichier et titre restent explicitement à confirmer ; absence de date ne devient pas récente',()=>{
 const d=dates.extract({url:'https://commune.be/pv/20251103.pdf'});assert.equal(d.document.date,'2025-11-03');assert.equal(d.document.confidence,'inferred');assert.match(dates.view({source:'LOCALE',sourceDocument:d.sourceUrl,sourceDocumentDates:d}).summary,/à confirmer/);
 assert.equal(dates.extract({url:'https://commune.be/2026/download/pv-85/'}).status,'unknown');
 const old=dates.extract({text:'Séance du 1 décembre 2022',url});assert.equal(dates.view({source:'LOCALE',sourceDocument:url,sourceDocumentDates:old},new Date('2026-10-29')).old,true);
 assert.equal(dates.view({source:'BOSA',publication:'2026-10-29'}),null);
});
test('preuve d’une autre version ou URL rejetée et texte tiers échappé',()=>{
 const d=dates.extract({text:'Séance du 21 mai 2026',url,sha256:'old'}),m={source:'LOCALE',sourceDocument:url,sourceDocumentDates:d,sourceDocumentVersion:{sha256:'new'}};assert.equal(dates.view(m).date,'');
 m.sourceDocumentVersion.sha256='old';m.sourceDocument='https://commune.be/autre.pdf';assert.equal(dates.view(m).date,'');m.sourceDocument=url;d.session.excerpt='<img onerror=alert(1)>';assert(!cockpit.preview(m,'','').includes('<img'));assert.match(detail.render(m).html,/&lt;img/);
});
test('collecteur : date mise à jour sans changer identifiant, extrait, statut ni nombre de documents',()=>{
 const c={ins:'64034',name:'Test',documentsRead:0},quote='Le conseil approuve une mission de bornage et division parcellaire avec designation du geometre.';
 const run=(items,c,day)=>collector.processDocument(items,c,{url,title:'PV'},{bytes:Buffer.from('%PDF-1.7\nSéance du '+day+' octobre 2026\n'+quote)},'2026-10-29T12:00:00Z',b=>b.toString().slice(9));
 const a=run([],c,21);assert.equal(a.items[0].sourceDocumentDates.session.date,'2026-10-21');a.items[0].customNote='Suivi';const b=run(a.items,a.commune,22);assert.equal(b.items.length,1);assert.equal(b.items[0].id,a.items[0].id);assert.equal(b.items[0].customNote,'Suivi');assert.equal(b.items[0].sourceDocumentDates.session.date,'2026-10-22');assert.equal(b.commune.documentsRead,1);
});
