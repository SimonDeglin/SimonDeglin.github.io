/* Affichage de preuves de passage enregistrées, sans lancer de requête aux
   communes depuis le navigateur ni confondre affichage et collecte. */
(function(){
 'use strict';
 const api=window.MRSources,$=id=>document.getElementById(id);
 let list=[],province='all';
 const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function node(tag,text,css){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(css)e.className=css;return e}
 function safeLink(url,label){
  const a=node('a',label);
  try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))throw Error();a.href=u.href;a.target='_blank';a.rel='noopener noreferrer'}catch(e){return node('span',label)}
  return a;
 }
 function line(card,label,value){const p=node('p');p.append(node('span',label+' : '),node('time',api.date(value)));card.append(p)}
 function card(title,badge,ok){const e=node('article',undefined,'source-card');e.append(node('h3',title),node('span',badge,'badge'+(ok?' ok':'')));return e}
 function renderSources(data){
  const box=$('sources');box.replaceChildren();const b=data.sources?.BOSA||{},h=api.health(b);
  const bosa=card('BOSA — bulletin officiel',h.label,h.ok);bosa.id='bosaHealth';
  if(h.failed)bosa.querySelector('.badge').classList.add('error');
  line(bosa,'Dernière tentative enregistrée',h.attempt);line(bosa,'Dernière collecte réussie',h.success);
  if(!b.last_attempt&&b.last_success)bosa.append(node('p','Historique ancien : les tentatives échouées avant cette version ne sont pas connues.','muted'));
  if(b.period_from)bosa.append(node('p','Dernier parcours réussi : du '+b.period_from+' au '+(b.period_to||'non enregistré')+' · '+(b.pages||0)+' pages · '+(b.scanned||0)+' publications examinées.'));
  if(b.last_error)bosa.append(node('p','Erreur : '+b.last_error,'error'));
  bosa.append(node('p','Trois passages programmés par jour. Fenêtre habituelle : 14 jours. Une période parcourue ne garantit pas que tous les marchés souhaités ont été retenus.','muted'));
  const ted=card('TED — avis européens',data.collector_status==='ok'?'Dernières données publiées':data.collector_status==='partial'?'Collecte partielle':'État à vérifier',false);ted.id='tedHealth';
  line(ted,'Date des données TED',data.generated_at);ted.append(node('p','Trois passages programmés par jour. Cette date ne remplace pas la date de collecte BOSA.','muted'));
  const local=data.sources?.COMMUNES_DOCUMENTS||{};
  const communes=card('Documents communaux','Couverture progressive · non exhaustive',false);
  line(communes,'Dernière tentative documentaire',local.last_attempt);
  line(communes,'Dernier passage avec lecture ou contrôle réussi',local.last_success);
  if(local.last_attempt)communes.append(node('p','Dernier lot : '+(local.last_batch||0)+' communes · '+(local.documents_checked||0)+' PDF contrôlés · '+(local.documents_modified||0)+' versions modifiées · '+(local.errors_count||0)+' erreurs.'));
  communes.append(node('p','Consulter les dates de chaque commune ci-dessous. Une page accessible ne prouve pas que ses délibérations ont été lues. PDF textuels publics uniquement ; pas d’OCR.','muted'));
  box.append(ted,bosa,communes);
 }
 function renderProvinces(){
  const box=$('provinces');box.replaceChildren();
  for(const [id,label] of [['all','Toute la Wallonie'],...Object.entries(api.provinces)]){
   const group=list.filter(c=>id==='all'||api.provinceOf(c)===id),n=api.counts(group);
   const b=node('button',label,province===id?'active':'');b.type='button';b.dataset.province=id;b.setAttribute('aria-pressed',String(province===id));b.append(node('small',n.read+'/'+n.total+' avec lectures'));
   b.addEventListener('click',()=>{province=id;$('collectProvince').value=id;updateCommuneChoices();render()});box.append(b);
  }
 }
 function render(){
  renderProvinces();const group=list.filter(c=>province==='all'||api.provinceOf(c)===province),n=api.counts(group),summary=$('summary');summary.replaceChildren();
  for(const [value,label] of [[n.total,'communes dans la sélection'],[n.sites,'sites déjà consultés'],[n.read,'communes avec documents lus'],[n.documents,'documents lus, cumul']]){
   const e=node('div',undefined,'stat');e.append(node('b',value),node('span',label));summary.append(e);
  }
  const q=fold($('search').value).trim(),st=$('status').value,z=$('zone').value;
  const rows=group.filter(c=>(!q||fold(c.name+' '+c.ins).includes(q))&&(st==='all'||api.communeState(c).key===st)&&(z==='all'||c.zone===z));
  const body=$('rows');body.replaceChildren();
  for(const c of rows){
   const tr=node('tr');tr.dataset.ins=c.ins;const first=node('td');first.append(safeLink(c.officialSite,c.name),node('small',(api.provinces[api.provinceOf(c)]||'Province à vérifier')+' · INS '+c.ins));
   const state=api.communeState(c),status=node('td');status.append(node('span',state.label,'badge'+(state.key==='error'?' error':state.key==='read'?' ok':'')));
   if(state.errors.length)status.append(node('small',state.errors.join(' · ')));
   const when=node('td');when.append(node('span','Site : '+api.date(c.lastSiteCheck)),node('small','Documents : '+api.date(c.lastDocumentCheck)));
   const successful=c.lastDocumentSuccess||Object.values(c.documentChecks||{}).map(v=>v.lastSuccess).filter(Boolean).sort().at(-1);
   if(successful)when.append(node('small','Dernier PDF contrôlé : '+api.date(successful)));
   const read=node('td',api.docs(c));
   if(c.documentProgress){const p=c.documentProgress;read.append(node('small','À traiter : '+p.pagesPending+' pages · '+p.documentsPending+' PDF'));if(p.limited)read.append(node('small','Limite d’exploration atteinte : contrôle complémentaire nécessaire.'));}
   else read.append(node('small','Exploration restante non encore mesurée.'));
   if(c.lastDocumentResult)read.append(node('small','Dernier lot : '+c.lastDocumentResult.checked+' contrôlés, '+c.lastDocumentResult.errors+' erreurs'));
   const actions=node('td'),details=node('details'),sources=c.deliberationSources||[];details.append(node('summary',sources.length+' source(s) repérée(s)'));
   const ul=node('ul');for(const s of sources){const li=node('li');li.append(safeLink(s.url,s.title||s.url),node('small',s.status==='page_accessible'?'Page accessible lors du contrôle du '+api.date(s.last_success):s.status==='document_pdf_a_analyser'?'Lien PDF à analyser':'Lien à vérifier'));ul.append(li)}
   if(!sources.length)ul.append(node('li','Aucune publication localisée.'));details.append(ul);actions.append(details);
   const launch=node('button','Préparer une relance…','row-launch');launch.type='button';launch.addEventListener('click',()=>{$('collectProvince').value=api.provinceOf(c);updateCommuneChoices(c.ins);$('prepare').scrollIntoView({block:'start',behavior:'smooth'})});actions.append(launch);
   tr.append(first,status,when,read,actions);body.append(tr);
  }
  if(!rows.length){const tr=node('tr'),td=node('td','Aucune commune dans cette sélection.','empty');td.colSpan=5;tr.append(td);body.append(tr)}
  $('viewcount').textContent=rows.length+' communes affichées · '+n.errors+' avec erreur dans la sélection provinciale.';
 }
 function instructions(){
  const p=$('collectProvince').value,c=$('collectCommune').value;
  $('launchInstructions').textContent='Dans « Run workflow », choisir province = '+p+(c?', commune = '+c:', laisser commune vide')+'. Le lancement traitera '+(c?'cette commune uniquement':'un lot de 12 sites au maximum et de 4 communes pour les PDF, dans cette province')+'. Relancer un lot poursuit la rotation.';
 }
 function updateCommuneChoices(ins=''){
  const box=$('collectCommune'),p=$('collectProvince').value;box.replaceChildren();const opt=node('option','Rotation automatique');opt.value='';box.append(opt);
  for(const c of list.filter(c=>p==='all'||api.provinceOf(c)===p)){const o=node('option',c.name+' — '+c.ins);o.value=c.ins;box.append(o)}box.value=ins;instructions();
 }
 async function load(){
  $('reload').disabled=true;$('sourceError').hidden=true;$('directoryError').hidden=true;
  const read=async path=>{const r=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  const [data,inventory]=await Promise.allSettled([read('data.json'),read('communes.json')]);
  if(data.status==='fulfilled'&&Array.isArray(data.value.items))renderSources(data.value);
  else{$('sources').replaceChildren();$('sourceError').hidden=false;$('sourceError').textContent='Les dates de collecte ne sont pas accessibles. Aucune actualité des sources ne peut être confirmée.'}
  if(inventory.status==='fulfilled'&&Array.isArray(inventory.value.communes)){
   list=inventory.value.communes.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));render();updateCommuneChoices();
  }else{$('directoryError').hidden=false;$('directoryError').textContent='Annuaire indisponible. '+(list.length?'La dernière liste chargée reste affichée ; ses dates ne sont pas actualisées.':'Aucune couverture ne peut être confirmée.');}
  $('loadedAt').textContent='Lecture du site : '+api.date(new Date().toISOString())+' (heure belge). Cette heure ne correspond pas à un nouveau passage des collecteurs.';
  $('reload').disabled=false;
 }
 for(const [id,label] of Object.entries(api.provinces)){const o=node('option',label);o.value=id;$('collectProvince').append(o)}
 for(const id of ['search','status','zone'])$(id).addEventListener(id==='search'?'input':'change',render);
 $('collectProvince').addEventListener('change',()=>updateCommuneChoices());$('collectCommune').addEventListener('change',instructions);$('reload').addEventListener('click',load);
 load();
})();
