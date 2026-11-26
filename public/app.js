'use strict';
const names=['Sarah','Simon','San','Lola','Giovanni','Sylvie','Thomas','Mimi','Olivia'];
const demoAssignments={Giovanni:'Simon',Sarah:'Lola',Simon:'Sylvie',San:'Mimi',Lola:'Olivia',Sylvie:'Thomas',Thomas:'Sarah',Mimi:'San',Olivia:'Giovanni'};
const $=id=>document.getElementById(id);
const params = new URLSearchParams(location.search);
const trial = params.get('essai') === '1';
const demo = !trial && params.get('demo') === '1';
let ready = false;
let user = '', tab = 'draw', spinning = false, game = null;
let busy = false;
const getDemo=()=>{try{return JSON.parse(localStorage.getItem('criscenzo-demo-2026')||'{}')}catch{return {}}};
const saveDemo=obj=>{try{localStorage.setItem('criscenzo-demo-2026',JSON.stringify(obj))}catch{}};
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const notice=(msg,error=false)=>{const e=$('status');e.textContent=msg;e.classList.toggle('error',error)};
async function remote(action, name, body) {
  const url = new URL('/.netlify/functions/game', location.origin);
  if (trial) url.searchParams.set('essai', '1');
  const reading = action === 'status' || action === 'state';
  if (reading) url.searchParams.set('action', action);
  if (action === 'state') url.searchParams.set('name', name);
  const response = await fetch(url, reading ? { cache: 'no-store' } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, name, body }),
  });
  let result;
  try { result = await response.json(); }
  catch { throw Error('Le service du tirage est momentanément indisponible.'); }
  if (!response.ok) throw Error(result.error || 'Le service du tirage est momentanément indisponible.');
  return result;
}
function demoState(name){const d=getDemo();return {name,revealed:!!d.revealed?.[name],recipient:demoAssignments[name],ownWishes:d.wishes?.[name]||'',recipientWishes:d.wishes?.[demoAssignments[name]]||''};}
async function updateState() {
  const profile = user;
  const state = demo ? demoState(profile) : await remote('state', profile);
  if (user !== profile) return;
  game = state;
  render();
}
function refreshEntry() {
  $('enter').disabled = !ready || busy || !names.includes($('person').value);
}
async function init() {
  try {
    if (!demo) await remote('status');
    ready = true;
    $('modeFlag').textContent = demo ? 'Démonstration locale'
      : trial ? 'Essai partagé · aucun tirage définitif'
      : 'Tirage familial · résultats définitifs';
  } catch (error) {
    $('modeFlag').textContent = error.message;
  }
  refreshEntry();
}
$('person').addEventListener('change', refreshEntry);
$('enter').addEventListener('click', async () => {
  const name = $('person').value;
  if (!ready || busy || !names.includes(name)) return;
  user = name;
  busy = true;
  refreshEntry();
  tab = 'draw';
  try {
    await updateState();
    $('login').classList.add('hide');
    $('dashboard').classList.remove('hide');
    $('hello').textContent = 'Ciao, ' + user + ' !';
    $('modeFlag').textContent = demo ? 'Démonstration locale' : trial
      ? 'Essai partagé · aucun tirage définitif' : 'Tirage familial · résultats définitifs';
  } catch (error) {
    $('modeFlag').textContent = error.message;
  } finally {
    busy = false;
    refreshEntry();
  }
});
$('back').addEventListener('click', () => {
  if (spinning || busy) return;
  user = '';
  game = null;
  $('dashboard').classList.add('hide');
  $('login').classList.remove('hide');
  $('person').value = '';
  refreshEntry();
  notice('');
});
$('drawTab').onclick = () => { if (!spinning && !busy) { tab = 'draw'; render(); } };
$('listTab').onclick = () => { if (!spinning && !busy) { tab = 'list'; render(); } };
function render(){if(!game)return; $('drawTab').classList.toggle('active',tab==='draw');$('listTab').classList.toggle('active',tab==='list');const view=$('view');view.replaceChildren();notice('');
 if(tab==='list')return renderWishes(view);
 view.append(make('h2','content-heading','À qui offres-tu un cadeau ?'));
 if(game.revealed){showResult(view);return}
 const wheel=make('div','wheel'); wheel.append(make('strong','','NOËL'));
 const btn=make('button','','Faire tourner la roulette');btn.type='button';
 btn.onclick=async()=>{
  if(spinning)return;spinning=true;btn.disabled=true;notice('Le Père Noël prépare la surprise…');
  try{
    if(!demo)game=await remote('reveal',user);
    else{const d=getDemo();d.revealed={...(d.revealed||{}),[user]:true};saveDemo(d);game=demoState(user)}
    wheel.style.transform='rotate(1785deg)';
    window.setTimeout(()=>{spinning=false;render()},3800);
  }catch(e){spinning=false;btn.disabled=false;notice(e.message,true)}
 };
 view.append(wheel,btn);
}
function showResult(view){
 view.append(make('p','hint','Tu offres un cadeau à'),make('p','reveal',game.recipient));
 const h=make('h3','content-heading','Sa liste de Noël');h.style.marginTop='24px';view.append(h);
 const wish=make('div','wish',game.recipientWishes?.trim()||'Pas encore de liste 🎁');view.append(wish);
 const btn=make('button','secondary','Actualiser sa liste');btn.type='button';btn.style.marginTop='14px';btn.onclick=async()=>{try{await updateState()}catch(e){notice(e.message,true)}};view.append(btn);
}
function renderWishes(view){
 view.append(make('h2','content-heading','Ma liste de Noël'));
 const ta=make('textarea');ta.maxLength=1500;ta.placeholder='Une idée de cadeau par ligne…';ta.value=game.ownWishes||'';view.append(ta);
 const b=make('button','','Enregistrer ma liste');b.type='button';b.onclick=async()=>{
  if (busy) return;
  busy = true;
  b.disabled=true;notice('Enregistrement…');
  try{if(!demo)game=await remote('save',user,ta.value);else{const d=getDemo();d.wishes={...(d.wishes||{}),[user]:ta.value};saveDemo(d);game=demoState(user)}notice('✓ Liste enregistrée');}
  catch(e){notice(e.message,true)}finally{busy=false;b.disabled=false}
 };view.append(b);
 const note=make('p','wish-note',demo?'La liste reste sur cet appareil.':'La personne qui t’offre un cadeau retrouve ta liste après avoir révélé son tirage.');view.append(note);
}
init();
