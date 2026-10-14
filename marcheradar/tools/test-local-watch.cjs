'use strict';
const assert=require('node:assert/strict');
const watch=require('./local-watch.cjs');
const url='https://www.province.namur.be/conseil-provincial/projets-de-deliberations/';
const html='<a href="/wp-content/uploads/2026/10/pv.pdf">Séance</a><a href="https://evil.example/file.pdf">Hors domaine</a><a href="/?p=2">Page interne</a>';
const links=watch.links(html,url);
assert.equal(links.length,1);
assert.equal(links[0].url,'https://www.province.namur.be/wp-content/uploads/2026/10/pv.pdf');
const text=[
 'Point 3 de l’ordre du jour :',
 'La Province décide de solliciter un bureau d’études.',
 'Mission de relevé topographique et bathymétrique du cours d’eau.',
 'Modalités de la procédure à déterminer.',
 'Point 4 de l’ordre du jour :',
 'Simple situation du chantier sans contrat annoncé.',
 'Le levé topographique réalisé en 2017 avait donné satisfaction.'
].join('\n');
const passages=watch.snippets(text);
assert.ok(passages.length>=1);
const op=watch.makeOpportunity({name:'Séance publique',buyer:'Province de Namur'},links[0],passages[0]);
assert.equal(op.source,'LOCALE');
assert.equal(op.screening,'review');
assert.equal(op.region,'Wallonie');
assert.equal(op.buyer,'Province de Namur');
assert.ok(op.sectors.includes('Topo')||op.sectors.includes('Hydro'));
assert.ok(op.sourceDocument.endsWith('pv.pdf'));
assert.equal(watch.makeOpportunity({name:'Séance publique',buyer:'Province de Namur'},links[0],passages[0]).id,op.id);
assert.equal(watch.snippets('Un relevé topographique avait été utilisé en 2017 sans nouvelle consultation.').length,0);
console.log('MARCHERADAR_LOCAL_TEST_OK');
