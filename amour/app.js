'use strict';
const results = [
['∞ %', 'L’infini paraît encore un peu petit.', 'Si je devais compter tout l’amour que j’ai pour toi, il me faudrait une éternité. Et même après, je serais encore en train de compter.'],
['1 000 000 %', 'Le compteur vient de rendre les armes.', 'Je t’aime dans les grands moments, dans les petits détails, et dans toutes ces secondes où je me dis que j’ai une chance folle de t’avoir.'],
['Bien trop ♥', 'Impossible de rester raisonnable.', 'Je t’aime à un point où un simple message de toi peut changer toute ma journée. Alors imagine ce que ça me fait quand tu es dans mes bras.'],
['À la folie', 'Diagnostic : complètement amoureux.', 'Tu sais ce que je préfère chez toi ? Toi. Toute entière. Ton sourire, tes petites habitudes, et cette façon que tu as de rendre ma vie plus belle.'],
['999 999 %', 'Le dernier pour cent est un bisou.', 'Je t’aime tellement que si les bisous étaient une monnaie, tu serais la personne la plus riche du monde. Et je continuerais à te payer chaque jour.'],
['∞ + 1', 'Même l’infini a été dépassé.', 'Si l’univers a une limite, mon amour pour toi n’est pas au courant. Il continue, tranquillement, à grandir chaque fois que je te regarde.'],
['100 % toi', 'Mon choix préféré, tous les jours.', 'Parmi toutes les personnes, tous les endroits, toutes les possibilités… c’est avec toi que j’ai envie d’être. Encore. Et encore.'],
['10 000 %', 'Un peu, beaucoup… énormément.', 'Je ne t’aime pas seulement pour les beaux jours. Je t’aime aussi les jours compliqués, les jours fatigués, et ceux où tu as juste besoin d’un câlin.'],
['Sans limite', 'Aucune unité ne convient.', 'Je t’aime plus que ce que je sais dire. Alors je vais passer mon temps à te le montrer, avec des bisous, des câlins et toutes mes petites attentions.'],
['À l’infini', 'Et bien plus loin que ça.', 'Avec toi, même ne rien faire devient quelque chose que j’adore. Un canapé, tes bras, et je suis exactement là où j’ai envie d’être.'],
['8 milliards %', 'Et pourtant, il n’y a que toi.', 'Il y a des milliards de personnes sur Terre. Mais ce sourire-là, cette voix-là, cette personne-là… c’est toi que mon cœur veut.'],
['Hors limites', 'Le calculateur n’était pas prêt.', 'J’ai essayé d’être raisonnable avec mes sentiments. Puis tu as souri. Bon… maintenant je suis complètement foutu. Je t’aime à mort.'],
['365 000 %', 'Et ça augmente tous les jours.', 'Je ne promets pas des journées parfaites. Je te promets un amoureux qui a envie de te choisir, de prendre soin de toi et de te faire rire.'],
['Toujours plus', 'Le cœur ne connaît pas de plafond.', 'Je pensais déjà t’aimer énormément hier. Et puis aujourd’hui, tu as encore trouvé le moyen de me faire tomber un peu plus amoureux.'],
['1 milliard %', 'C’est beaucoup. Toi, c’est encore plus.', 'Si je pouvais te prêter mes yeux quelques secondes, tu comprendrais à quel point je te trouve belle. Et à quel point je suis amoureux de toi.'],
['1000 / 10', 'Oui, je sais. Ça dépasse.', 'Mon endroit préféré n’a pas d’adresse. C’est juste là, tout près de toi, quand tu me prends dans tes bras.'],
['Énormément', 'Et ce mot reste trop petit.', 'Je t’aime pour ce que tu es, pas pour ce que tu pourrais être. Tu n’as pas besoin d’être parfaite pour être ma personne préférée.'],
['À en déborder', 'Trop d’amour pour un seul cœur.', 'Tu es ce petit bonheur qui n’a rien de petit. Celui qui se glisse dans ma tête au milieu de la journée et me fait sourire tout seul.'],
['4 000 000 %', 'Résultat confirmé par les papillons.', 'Quand je te vois, mon cœur fait toujours son petit cinéma. Et honnêtement, j’espère qu’il ne se calmera jamais.'],
['Bien au-delà', 'Des mots, des chiffres, de tout.', 'J’aime ta présence dans ma vie. J’aime te raconter des choses bêtes. J’aime savoir que je vais te revoir. J’aime nous.'],
['∞ bisous', 'À récupérer dans mes bras.', 'Le calcul est terminé : je te dois une quantité infinie de bisous. Tu peux commencer à les réclamer tout de suite.'],
['12 000 %', 'Mon cœur a signé sans hésiter.', 'Même après une longue journée, tu restes la personne que j’ai envie de retrouver. Mon moment doux. Mon sourire. Mon amour.'],
['Plus que tout', 'Le résultat le plus simple.', 'Je t’aime à mort. Pas besoin d’une formule compliquée : je suis heureux que ce soit toi, et j’ai envie que tu le saches chaque jour.'],
['100 % accro', 'À toi, évidemment.', 'Ton rire devrait être remboursé tellement il me fait du bien. Et tes câlins ? Clairement mon traitement préféré.'],
['7 000 000 %', 'L’amour a fait sauter le fusible.', 'Tu as ce talent incroyable : rendre une journée ordinaire beaucoup plus belle simplement en étant dedans.'],
['Pour toujours', 'C’est la direction que je choisis.', 'J’ai envie de collectionner les souvenirs avec toi. Les grands voyages, les petits dimanches, les fous rires et les bisous avant de dormir.'],
['À cœur perdu', 'Et je ne veux pas le récupérer.', 'Mon cœur s’est installé chez toi. Il a posé ses affaires, il est bien, et il n’a absolument aucune intention de déménager.'],
['2 000 000 %', 'Une estimation très prudente.', 'Je te regarde parfois sans rien dire. Ce n’est pas parce que je n’ai rien à raconter. C’est juste que je me dis : qu’est-ce que je l’aime, celle-là.'],
['Plus qu’hier', 'Mais moins que demain.', 'Ce que j’aime avec toi, c’est que notre histoire continue de s’écrire. Et que j’ai toujours envie de découvrir la page suivante avec toi.'],
['100 % nous', 'Mon duo préféré.', 'Toi et moi, les petites blagues que personne ne comprend, les regards qui disent tout… je ne remplacerais ça pour rien au monde.'],
['9 999 999 %', 'La machine demande un câlin.', 'Le calculateur a essayé de comprendre. Il a fini par conclure qu’un long câlin serait beaucoup plus précis que tous ces chiffres.'],
['Incalculable', 'Mais très facile à ressentir.', 'Je t’aime dans ma façon de te chercher du regard, de penser à toi sans raison et d’avoir envie de partager même les plus petites choses avec toi.'],
['100 % fondu', 'Tu connais le coupable : ton sourire.', 'Tu peux me faire fondre avec un regard. Un seul. C’est un pouvoir assez injuste, mais je ne vais certainement pas m’en plaindre.'],
['À perte de vue', 'Un horizon rempli de toi.', 'Si mes sentiments étaient un paysage, tu ne verrais pas le bout. Juste de l’amour, encore de l’amour, et quelques bisous au milieu.'],
['600 000 %', 'Validé à chaque battement.', 'Mon cœur ne fait pas beaucoup de choses compliquées. Il bat, et dès qu’il s’agit de toi, il s’emballe.'],
['Sans fin', 'Aucun point final prévu.', 'J’ai envie de te faire rire quand tu en as besoin, de te serrer quand ça ne va pas, et de célébrer avec toi tout ce qui te rend heureuse.'],
['100 % chanceux', 'Parce que je t’ai dans ma vie.', 'Parfois je me demande comment j’ai fait pour avoir autant de chance. Puis je te vois, et je préfère simplement profiter de toi.'],
['Trop fort', 'Même le silence le dit.', 'Je t’aime aussi dans le calme. Quand on ne dit rien, quand on est juste ensemble, et que ça suffit pour que je me sente bien.'],
['42 millions %', 'La réponse à tout : toi.', 'La meilleure partie de mes projets, c’est quand je peux y ajouter : avec toi. Même les choses toutes simples deviennent plus belles.'],
['100 % charmé', 'Et totalement consentant.', 'Je pourrais faire une longue liste de tout ce que j’aime chez toi. Mais elle commencerait par toi et elle finirait beaucoup, beaucoup trop tard.'],
['À la démesure', 'Un amour qui voit grand.', 'Je t’aime plus que tous les je t’aime que je t’ai déjà dits. Et je compte bien t’en dire encore un paquet.'],
['3 600 000 %', 'Un peu plus à chaque seconde.', 'Si chaque pensée pour toi allumait une étoile, la nuit ne serait jamais vraiment noire.'],
['100 % heureux', 'Quand je suis près de toi.', 'Tu ne le vois peut-être pas toujours, mais tu mets tellement de douceur dans ma vie. Merci d’être toi. Je t’aime, mon amour.'],
['Un océan', 'Et pas une goutte de moins.', 'Mon amour pour toi, c’est un océan. Les bisous, ce sont les vagues. Prépare-toi, la marée monte.'],
['100 % gaga', 'Le cœur assume complètement.', 'Oui, je souris comme un idiot quand je pense à toi. Oui, c’est souvent. Non, je n’ai aucune envie que ça s’arrête.'],
['À en sourire', 'Même tout seul devant mon téléphone.', 'Un message de toi, et me voilà avec ce petit sourire que je n’arrive même pas à cacher. Voilà le genre d’effet que tu me fais.'],
['28 000 %', 'Les câlins ont faussé les statistiques.', 'Je t’aime assez pour avoir encore envie d’un câlin juste après un câlin. Et encore un après celui-là. Tu vois le problème.'],
['Une éternité', 'C’est le minimum demandé.', 'S’il existait un bouton pour arrêter le temps, je l’utiliserais quand tu es blottie contre moi. Juste pour rester là un peu plus longtemps.'],
['À fond', 'Aucun mode économie d’amour.', 'Je t’aime à fond, avec mes petits défauts, mes grandes envies de te rendre heureuse et mon cœur qui fait toujours de la place pour toi.'],
['Tout mon cœur', 'Pas un petit morceau. Tout.', 'Le résultat est simple : tu as tout mon cœur. Et si tu doutes un jour, reviens ici… ou viens directement dans mes bras.']
];
const stages = ['Analyse de tous mes sourires quand je te vois…','Comptage des bisous que je veux te faire…','Mesure des papillons dans mon ventre…','Oups… les sentiments dépassent la capacité !','Confirmation : complètement amoureux.'];
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
