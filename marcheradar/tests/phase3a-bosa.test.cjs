'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const detail=require('../detail-phase2.js'),api=require('../tools/bosa-documents-enrich.cjs');
const uuid='0765b50e-85f5-4aae-b2ca-2ed66c14e354',docId='0fb9264d-1b75-4c5b-b4f5-f7e7b3f57699';
const raw=[{id:docId,workspaceId:uuid,type:'WORKSPACE',languages:['FR'],versions:[
 {id:'f6254e9b-df7d-47ef-b07b-72aa37fd4619',activatedAt:'2026-10-13T15:31:45',document:{id:'8fb17287-cd05-4f9a-80c1-c4666a9b54eb',originalFileName:'CCH Bathymetrie FR.pdf'}}
]}];
test('public BOSA metadata is a manifest, never a fabricated download link',()=>{
 const e=api.endpoints(uuid);
 assert.match(e.documents,/documents\?full=false/);
 const n=api.normalizeDocuments(raw,uuid,e.documents);
 assert.equal(n.length,1);
 assert.equal(n[0].kind,'csc');
 assert.equal(n[0].title,'CCH Bathymetrie FR.pdf');
 assert.equal(n[0].access,'public_metadata_only');
 assert.equal(n[0].downloadVerified,false);
 assert.equal(n[0].url,undefined);
 const page=detail.render({title:'Mission bathymétrique',source:'BOSA',documentInventory:n,documentsPageUrl:'https://www.publicprocurement.be/publication-workspaces/'+uuid+'/documents'});
 assert.match(page.html,/1 pièce\(s\) répertoriée\(s\)/);
 assert.match(page.html,/CCH Bathymetrie FR.pdf/);
 assert.match(page.html,/fichiers ne sont pas encore téléchargés/);
 assert.equal(page.documentCount,0);
});
test('external official references preserved without claiming downloads',()=>{
 const root='https://www.publicprocurement.be/api/dos/publication-workspaces/'+uuid+'/urls?full=false';
 const links=api.normalizeConsultationUrls([{url:'https://cloud.3p.eu/Downloads/1/3747/EM/2026'}],root);
 assert.equal(links.length,1);
 const html=detail.render({source:'BOSA',title:'PEB',consultationUrls:links}).html;
 assert.match(html,/Documents hébergés par un prestataire externe/);
 assert.match(html,/Lien référencé par BOSA/);
});
test('refuse invalid hostnames, malformed UUID and scripts',()=>{
 assert.throws(()=>api.endpoints('../../x'));
 assert.equal(api.safeExternal('javascript:alert(1)'),'');
 assert.equal(api.safeExternal('https://username:password@cloud.3p.eu/file'),'');
 assert.equal(api.normalizeDocuments(raw,'different-workspace','https://www.publicprocurement.be/').length,0);
});
test('failed HTTP does not erase previous document inventory',async()=>{
 const prior={source:'BOSA',publicationWorkspaceId:uuid,documentInventory:[{id:'old',title:'Ancienne pièce'}]};
 const badFetch=async()=>({ok:false,status:403});
 const r=await api.enrichRecord(prior,badFetch);
 assert.equal(r.result,'source_unavailable');
 assert.deepEqual(r.market.documentInventory,prior.documentInventory);
});
test('successful responses normalize only official linked metadata',async()=>{
 const old={source:'BOSA',publicationWorkspaceId:uuid,documentInventory:[{title:'Ancien'}]};
 const fetcher=async url=>({ok:true,status:200,json:async()=>url.includes('/documents?')?raw:[{url:'https://cloud.3p.eu/Downloads/1/3747/EM/2026'}]});
 const result=await api.enrichRecord(old,fetcher);
 assert.equal(result.result,'enriched');
 assert.equal(result.market.documentInventory.length,1);
 assert.equal(result.market.consultationUrls.length,1);
 assert.equal(result.market.documentsPageUrl,'https://www.publicprocurement.be/publication-workspaces/'+uuid+'/documents');
});

test('données enrichies réelles: 64 marchés, inventaires et liens externes distincts',()=>{
 const current=require('../data.json');
 assert.equal(current.items.length,64);
 const bathy=current.items.find(x=>x.id==='bosa:0765b50e-85f5-4aae-b2ca-2ed66c14e354');
 assert(bathy&&bathy.documentInventory.length>=16,'Métadonnées bathymétriques absentes');
 assert(bathy.documentInventory.some(x=>/CCH.*Bathymetrie/i.test(x.title)));
 assert.equal(bathy.documentInventory.filter(x=>x.downloadVerified).length,0,'Aucun téléchargement non validé');
 const body=detail.render(bathy).html;
 assert.match(body,/pièce\(s\) répertoriée\(s\)/);
 assert.match(body,/BOSA/);
 assert.match(body,/2026B0173_CCH - Bathymetrie/);
 const external=current.items.find(x=>x.id==='bosa:834b6f23-3906-4589-a0e7-afae9c91d26a');
 assert(external.consultationUrls.some(x=>x.url.startsWith('https://cloud.3p.eu/')));
 assert.match(detail.render(external).html,/Documents hébergés par un prestataire externe/);
});
