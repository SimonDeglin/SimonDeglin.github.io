'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extractPassages,makeAnalysis,mergeAnalysis}=require('../tools/csc-evidence.cjs');
const view=require('../detail-phase2.js');
const data=require('../data.json');
const market=data.items.find(m=>m.id==='bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354');
const document=market.documentInventory.find(d=>/CCH - Bathymetrie.*FR_F\.pdf/i.test(d.title));
const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(1900)]);
function source(){return 'Article 7 — Le prix est l’unique critère d’attribution. Le critère d’attribution est de 100%. '+ ' '.repeat(340)+'\f'+
 'La date limite de remise des offres est précisée dans l’invitation à remettre offre. Visite obligatoire : aucune visite de terrain prévue. '+ ' '.repeat(120);}
test('lire les passages sans transformer les mentions en obligations ou dates',()=>{
 const findings=extractPassages(source());
 assert(findings.some(x=>x.kind==='award'&&x.page===1));
 assert(findings.some(x=>x.kind==='deadline'&&x.page===2));
 assert(findings.some(x=>x.kind==='visit'&&x.page===2));
 assert(findings.every(x=>x.reviewStatus==='to_verify'));
 assert(findings.every(x=>x.excerpt.length<=185));
 assert(findings.length<=10);
});
test('analyse tracée par numéro de document, version, SHA-256 et numéro de page',()=>{
 assert(market&&document,'Échantillon officiel inconnu');
 const m=makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:source(),extractedAt:'2026-10-15T17:00:00.000Z'});
 assert.equal(m.documentId,document.documentId);
 assert.equal(m.inventoryId,document.id);
 assert.equal(m.versionId,document.versionId);
 assert.equal(m.sha256.length,64);
 assert.equal(m.analysisKind,'automatic_keyword_passages');
 assert.equal(m.reviewStatus,'to_verify');
 assert(m.evidence.some(x=>x.page===2));
 assert(!m.downloadUrl&&!m.deadline&&!m.visit,'Pas de lien temporaire ni de fait inventé');
 const merged=mergeAnalysis(market,m);
 assert(merged.updated);
 assert.equal(merged.market.documentAnalyses.length,1);
 assert.equal(market.documentAnalyses,undefined,'Source initiale immuable');
 const unchanged=mergeAnalysis(merged.market,{...m,extractedAt:'2026-10-15T18:00:00.000Z'});
 assert.equal(unchanged.updated,false,'La même analyse ne génère pas de nouvelle publication');
 assert.strictEqual(unchanged.market,merged.market);
});
test('ne jamais afficher un rapport d’une version dépassée comme actuel',()=>{
 const analysis=makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:source()});
 const html=view.render({...market,documentAnalyses:[{...analysis,versionId:'ancienne-version'}]}).html;
 assert.doesNotMatch(html,/Passages repérés dans les documents/);
});
test('preuve affichée comme non validée et jamais comme critère officiellement confirmé',()=>{
 const m=makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:source()});
 const html=view.render({...market,documentAnalyses:[m]}).html;
 assert.match(html,/Passages repérés dans les documents/);
 assert.match(html,/Lecture automatique — vérification nécessaire/);
 assert.match(html,/page 2/);
 assert.match(html,/Retrouver ce document dans e-Procurement/);
 assert.equal(view.visitState({...market,documentAnalyses:[m]}).kind,'unknown');
});
test('le HTML échappe les extraits tiers potentiellement malveillants',()=>{
 const m=makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:source()});
 m.evidence=[{kind:'award',page:2,excerpt:'Critères d’attribution <img src=x onerror=alert(1)>',reviewStatus:'to_verify'}];
 const html=view.render({...market,documentAnalyses:[m]}).html;
 assert(!html.includes('<img src=x'));
 assert(html.includes('&lt;img src=x'));
});
test('rejeter un document non indexé ou un PDF non conforme',()=>{
 const m=makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:source()});
 const badMarket={...market,documentInventory:[]};
 assert.throws(()=>mergeAnalysis(badMarket,m),/not in official inventory/);
 assert.throws(()=>makeAnalysis({market,document,bytes:Buffer.from('not a PDF'),numberOfPages:2,text:source()}),/Invalid or oversized PDF/);
 assert.throws(()=>makeAnalysis({market,document,bytes:pdf,numberOfPages:2,text:'short'}),/No machine-readable PDF text/);
});
