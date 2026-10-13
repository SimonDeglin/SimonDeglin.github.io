'use strict';
const results = [["1 000 000 %", "", "Je suis fou de toi ❤️"], ["À l’infini", "", "Et encore, c’est pas assez."], ["Beaucoup trop", "", "Viens me faire un bisou 😘"], ["Plus qu’hier", "", "Moins que demain."], ["À la folie", "", "Et ça, c’est ta faute ❤️"], ["100 % toi", "", "C’est toi que je veux."], ["∞ + 1", "", "Toujours un peu plus."], ["À mort", "", "Je t’aime, ma Sarah ❤️"], ["Tout mon cœur", "", "Il est à toi."], ["999 999 %", "", "Il manque juste un bisou."], ["Sans limite", "", "Comme mes envies de te câliner."], ["1000 / 10", "", "Oui, tu dépasses tout."], ["Énormément", "", "T’es mon bonheur ❤️"], ["Bien trop", "", "Impossible de te résister."], ["100 % accro", "", "À toi et à tes bisous."], ["Un milliard %", "", "Et c’est une petite estimation."], ["À fond", "", "Toi, moi, et plein de bisous."], ["Toujours plus", "", "Tu me fais craquer chaque jour."], ["Incalculable", "", "Mais viens, je te montre ❤️"], ["Pour toujours", "", "C’est ce que je veux avec toi."], ["100 % gaga", "", "Regarde ce que tu me fais 😘"], ["Sans fin", "", "Comme les câlins que je te dois."], ["Bien au-delà", "", "De tout ce que je peux te dire."], ["10 millions %", "", "Mon cœur a explosé ❤️"], ["Plus que tout", "", "T’es ma préférée."], ["À en fondre", "", "Un sourire et je suis foutu."], ["100 % nous", "", "Mon duo préféré ❤️"], ["Trop fort", "", "Même le calculateur le sait."], ["Une éternité", "", "Dans tes bras, s’il te plaît."], ["À cœur perdu", "", "Tu peux le garder ❤️"], ["100 % charmé", "", "Sarah, tu triches avec ce sourire."], ["À en déborder", "", "Tout cet amour, c’est pour toi."], ["Un océan", "", "De bisous rien que pour toi."], ["100 % chanceux", "", "Parce que je t’ai ❤️"], ["À l’infini²", "", "J’ai recompté. C’est confirmé."], ["7 millions %", "", "Et un câlin en bonus."], ["100 % fondu", "", "Tu me fais cet effet-là ❤️"], ["Hors limites", "", "T’as fait buguer mon cœur."], ["Encore plus", "", "Que la dernière fois 😘"], ["Éperdument", "", "C’est toi, mon amour."], ["∞ bisous", "", "À venir chercher dans mes bras."], ["À en sourire", "", "Rien qu’en pensant à toi."], ["100 % amoureux", "", "Et pas envie de guérir ❤️"], ["2 millions %", "", "Le reste arrive avec un bisou."], ["À la démesure", "", "T’es petite dans mes bras, immense dans mon cœur."], ["Juste toi", "", "Et c’est déjà tout ❤️"], ["100 % heureux", "", "Quand tu es près de moi."], ["À en rêver", "", "De notre prochain câlin."], ["Bien trop²", "", "Je vais encore te coller 😘"], ["Tout, tout, tout", "", "Mon cœur. Mes bisous. Mon amour ❤️"]];
const stages = Array(5).fill("Attends, je compte…");
const $ = id => document.getElementById(id);
let running = false, bag = [], last = -1;
function pickResult(){
  if (!bag.length) {
    bag = results.map((_,i)=>i);
    for(let i=bag.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    if (bag[bag.length-1]===last) [bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
  }
  last=bag.pop(); return results[last];
}
function screen(id){ for(const name of ['home','loading','result']) $(name).hidden=name!==id; }
function celebrate(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for(let i=0;i<20;i++) { const h=document.createElement('span'); h.className='particle'; h.textContent=i%3?'♡':'♥'; h.style.left=Math.random()*100+'%'; h.style.fontSize=(12+Math.random()*18)+'px'; h.style.animationDelay=Math.random()*.8+'s'; $('confetti').append(h); setTimeout(()=>h.remove(),4500); }
}
function calculate(){
  if(running) return; running=true;
  $('calculate').disabled=true; $('again').disabled=true;
  $('bar').style.width='0%'; $('ring').style.strokeDashoffset='578'; $('percent').textContent='0 %'; $('status').textContent=stages[0];
  document.querySelector('.progress').setAttribute('aria-valuenow','0');screen('loading');
  const start=performance.now();
  function frame(now){
    const elapsed=now-start, p=Math.min(100,elapsed/50);
    $('bar').style.width=p+'%'; $('ring').style.strokeDashoffset=578*(1-p/100);
    $('percent').textContent=Math.floor(p)+' %';
    document.querySelector('.progress').setAttribute('aria-valuenow',String(Math.floor(p)));
    const stage=stages[Math.min(4,Math.floor(elapsed/1000))]; if($('status').textContent!==stage) $('status').textContent=stage;
    if(elapsed<5000){ requestAnimationFrame(frame); return; }
    const [score,subtitle,message]=pickResult(); $('result-title').textContent=score; $('subtitle').textContent=subtitle; $('message').textContent=message;
    screen('result'); running=false; $('calculate').disabled=false; $('again').disabled=false;
    $('result-title').setAttribute('tabindex','-1'); $('result-title').focus({preventScroll:true});celebrate();
  }
  requestAnimationFrame(frame);
}
$('calculate').addEventListener('click',calculate); $('again').addEventListener('click',calculate);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
