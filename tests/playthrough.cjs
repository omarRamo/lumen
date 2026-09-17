'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..')+path.sep;
const DT=1/120;
function create(stage,options){
  const window={innerWidth:1280,innerHeight:720,addEventListener(){},LumenRenderer:class{resize(){}},
    LumenAudio:class{setMuted(){}setTheme(){}setDanger(v){this.danger=v}setBossPhase(v){this.bossPhase=v}unlock(){}resume(){}pause(){}sfx(){}}};
  const document={addEventListener(){},body:{classList:{contains:()=>true}}};
  const context=vm.createContext({window,document,localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},console,Math});
  for(const file of ['rng.js','save.js','resonance.js','modules.js','expedition.js','upgrades.js','places.js','levels.js','song.js','journey.js','engine.js'])vm.runInContext(fs.readFileSync(root+'js/'+file,'utf8'),context);
  const game=new window.LumenGame({});
  if(options)game.start(stage,options);else game.loadLevel(stage);
  game.levels=window.LUMEN_LEVELS;return game;
}
const FINAL=create(0).levels.findIndex(l=>l.final);
const RESONANCE=create(0).levels.findIndex(l=>l.key==='verger-qui-reve');
function key(g,action,down){g.input.virtual(action,down,'bot');}
function tick(g){g.update(DT);g.input.clearFrame();}
function movement(g,target){
  const p=g.player, predicted=p.x+p.vx*.13;
  key(g,'left',predicted>target+5);key(g,'right',predicted<target-5);
}
const results=[];
{
  const g=create(0);let jumpUntil=0,lastJump=-10,maxX=g.player.x;const trace=[];
  g.on('mode',mode=>{if(mode==='dead')trace.push({event:'death',x:+g.player.x.toFixed(1),y:+g.player.y.toFixed(1),time:+g.elapsed.toFixed(2)});});
  for(let frame=0;frame<120*120&&g.mode!=='complete'&&g.mode!=='gameover';frame++){
    if(g.mode==='playing'){
      key(g,'right',true);key(g,'run',true);
      const p=g.player;
      const source=g.platforms.filter(s=>s.type==='ground'&&s.x<=p.x+16&&s.x+s.w>=p.x+16).sort((a,b)=>b.x-a.x)[0];
      const edge=source?source.x+source.w:Infinity;
      const upcoming=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-p.x<135&&Math.abs(e.y-p.y)<115);
      if(p.grounded&&g.elapsed-lastJump>.12&&(edge-p.x<95||upcoming)){
        trace.push({event:'jump',x:+p.x.toFixed(1),y:+p.y.toFixed(1),edge,time:+g.elapsed.toFixed(2)});
        key(g,'jump',true);jumpUntil=g.elapsed+.45;lastJump=g.elapsed;
      }else if(g.elapsed>jumpUntil)key(g,'jump',false);
    }
    tick(g);maxX=Math.max(maxX,g.player.x);
  }
  results.push({test:'stage 0 spawn to exit, actual enemies and pickups',mode:g.mode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,lives:g.lives,hp:g.player.hp,coins:g.levelCoins,maxX:+maxX.toFixed(1),trace});
}
// The two new chapters are driven by the same naive bot, purely to prove that the
// added creatures actually run inside the authored geometry and that the route
// stays survivable well past its first lantern.
for(const stableKey of ['vergers-vent','galerie-echos']){
  const stage=create(0).levels.findIndex(level=>level.key===stableKey);
  const g=create(stage);const level=g.levels[stage];
  let jumpUntil=0,lastJump=-10,maxX=g.player.x;const awakened=new Set(),hunted=new Set(),scattered=new Set();
  for(let frame=0;frame<120*100&&g.mode!=='complete'&&g.mode!=='gameover';frame++){
    if(g.mode==='playing'){
      key(g,'right',true);
      const p=g.player;
      const source=g.platforms.filter(s=>s.type==='ground'&&s.x<=p.x+16&&s.x+s.w>=p.x+16).sort((a,b)=>b.x-a.x)[0];
      const edge=source?source.x+source.w:Infinity;
      const upcoming=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-p.x<135&&Math.abs(e.y-p.y)<120);
      if(p.grounded&&g.elapsed-lastJump>.12&&(edge-p.x<85||upcoming)){
        key(g,'jump',true);jumpUntil=g.elapsed+.45;lastJump=g.elapsed;
      }else if(g.elapsed>jumpUntil)key(g,'jump',false);
      g.enemies.forEach((e,i)=>{
        if(e.type==='sleeper'&&e.state!=='sleep')awakened.add(i);
        if(e.type==='swarm'&&e.state==='hunt')hunted.add(i);
        if(e.type==='swarm'&&e.scatterTime>0)scattered.add(i);
      });
    }
    tick(g);maxX=Math.max(maxX,g.player.x);
  }
  const lanterns=g.checkpoints.filter(c=>c.active).length;
  results.push({test:'chapter '+(stage+1)+' ('+level.name+') exercised by a naive bot',
    mode:g.mode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,lives:g.lives,
    maxX:+maxX.toFixed(1),width:level.width,lanternsLit:lanterns,
    coins:g.levelCoins,enemiesDefeated:g.enemiesDefeated,damageTaken:g.damageTaken,
    sleepersWoken:awakened.size,swarmsHunting:hunted.size,swarmsScattered:scattered.size,
    ok:g.lives>0&&lanterns>=1&&maxX>level.width*.3});
}
{
  // Le chapitre de la Résonance, joué de bout en bout par un pilote qui ne sait
  // que trois choses : avancer, sauter au bon moment, et appeler. C'est la
  // preuve que le chapitre se termine avec de vraies entrées, sans état forcé.
  const g=create(RESONANCE);const level=g.levels[RESONANCE];
  let jumpUntil=0,lastJump=-10,lastCall=-10,maxX=g.player.x;
  const woken=new Set();let relays=0,calmed=0;
  for(let frame=0;frame<120*180&&g.mode!=='complete'&&g.mode!=='gameover';frame++){
    if(g.mode==='playing'){
      const p=g.player;
      key(g,'right',true);
      // Appeler dès qu'un élément endormi est à portée, ou qu'un pont réveillé
      // s'apprête à s'éteindre sous les pieds.
      const R=g.resonanceRules;
      const near=g.wakeables.some(w=>R.distance(p.x+16,p.y+22,w.x,w.y)<=R.BASE_REACH*.92&&w.state!=='awake');
      const fading=g.wakeables.some(w=>w.state==='awake'&&w.remaining<1.8&&R.distance(p.x+16,p.y+22,w.x,w.y)<=R.BASE_REACH*.92);
      const sleeperNear=g.enemies.some(e=>e.alive&&e.type==='sleeper'&&e.state==='sleep'&&R.distance(p.x+16,p.y+22,e.x+e.w/2,e.y)<=R.BASE_REACH*.92);
      if(p.actionCooldown<=0&&g.elapsed-lastCall>.2&&(near||fading||sleeperNear)){
        key(g,'action',true);lastCall=g.elapsed;
      }else key(g,'action',false);
      const source=g.platforms.filter(s=>s.active&&s.x<=p.x+16&&s.x+s.w>=p.x+16&&s.y>=p.y).sort((a,b)=>a.y-b.y)[0];
      const edge=source?source.x+source.w:Infinity;
      if(p.grounded&&g.elapsed-lastJump>.14&&edge-p.x<90){
        key(g,'jump',true);key(g,'run',true);jumpUntil=g.elapsed+.46;lastJump=g.elapsed;
      }else if(g.elapsed>jumpUntil){key(g,'jump',false);key(g,'run',false);}
      g.wakeables.forEach(w=>{if(w.state==='awake')woken.add(w.id);});
      relays=Math.max(relays,g.waves.filter(w=>w.source==='chime').length);
      calmed=Math.max(calmed,g.enemies.filter(e=>e.state==='calm').length);
    }
    tick(g);maxX=Math.max(maxX,g.player.x);
  }
  results.push({test:'chapitre « '+level.name+' » terminé au clavier, Résonance comprise',
    mode:g.mode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,lives:g.lives,
    maxX:+maxX.toFixed(1),width:level.width,coins:g.levelCoins,stars:g.levelStars,
    wakeablesUsed:woken.size,wakeablesTotal:level.wakeables.length,
    chimeRelays:relays,creaturesCalmed:calmed,
    ok:g.mode==='complete'&&woken.size>=4});
}
{
  const g=create(FINAL);
  // The only placement is the permitted arena checkpoint initialization.
  const arenaOffset=g.level.width-4800;
  Object.assign(g.player,{x:3404+arenaOffset,y:552});g.checkpoint={x:3404+arenaOffset,y:552};
  let jumpUntil=0,lastJump=-10,lastState='',changes=[];
  for(let frame=0;frame<120*180&&g.mode!=='ending'&&g.mode!=='gameover';frame++){
    const b=g.boss,p=g.player;
    if(b.state!==lastState){changes.push({time:+g.elapsed.toFixed(2),state:b.state,bossHp:b.hp,playerHp:p.hp});lastState=b.state;}
    if(g.mode==='playing'){
      if(b.hp<=0){
        key(g,'right',true);key(g,'left',false);key(g,'jump',false);
      }else{
        let target;
        if(b.vulnerable){target=b.x+b.w/2-p.w/2;}
        else if(b.state==='leap'){
          const remaining=(-b.vy+Math.sqrt(b.vy*b.vy+2*1550*(470-b.y)))/1550;
          const landing=Math.max(3470+arenaOffset,Math.min(4540+arenaOffset,b.x+b.vx*remaining));
          target=p.x<landing+b.w/2?landing-155:landing+b.w+125;
        }else target=p.x<b.x+b.w/2?b.x-180:b.x+b.w+155;
        target=Math.max(3430+arenaOffset,Math.min(4650+arenaOffset,target));
        movement(g,target);
        const danger=g.projectiles.some(s=>!s.friendly&&Math.abs(s.x-(p.x+16))<125&&s.y>p.y-20&&s.y<p.y+p.h+20&&s.vx*(p.x-s.x)>0);
        const close=Math.abs(p.x+p.w/2-(b.x+b.w/2))<175;
        if(p.grounded&&g.elapsed-lastJump>.15&&((b.vulnerable&&close)||danger)){
          key(g,'jump',true);jumpUntil=g.elapsed+.48;lastJump=g.elapsed;
        }else if(g.elapsed>jumpUntil)key(g,'jump',false);
      }
    }
    tick(g);
  }
  results.push({test:'arena checkpoint to boss victory and final exit, unpowered inputs only',mode:g.mode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,lives:g.lives,hp:g.player.hp,bossHp:g.boss.hp,playerX:+g.player.x.toFixed(1),changes});
}
{
  // A timed race of the opening chapter, to prove the clock, the medal and the
  // personal best all survive a real run driven by real inputs.
  const g=create(0,{timed:true});let finish=null;
  g.on('complete',detail=>{finish=detail;});
  let jumpUntil=0,lastJump=-10;
  for(let frame=0;frame<120*140&&g.mode!=='complete'&&g.mode!=='gameover';frame++){
    if(g.mode==='playing'){
      key(g,'right',true);key(g,'run',true);
      const p=g.player;
      const source=g.platforms.filter(s=>s.type==='ground'&&s.x<=p.x+16&&s.x+s.w>=p.x+16).sort((a,b)=>b.x-a.x)[0];
      const edge=source?source.x+source.w:Infinity;
      const upcoming=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-p.x<135&&Math.abs(e.y-p.y)<115);
      if(p.grounded&&g.elapsed-lastJump>.12&&(edge-p.x<95||upcoming)){
        key(g,'jump',true);jumpUntil=g.elapsed+.45;lastJump=g.elapsed;
      }else if(g.elapsed>jumpUntil)key(g,'jump',false);
    }
    tick(g);
  }
  const record=g.recordFor(0)||{};
  results.push({test:'timed race of chapter 1 records a medal and a personal best',
    mode:g.mode,runMode:g.runMode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,
    medal:finish&&finish.medal,timed:finish&&finish.timed,newRecord:finish&&finish.record,
    bestTimedTime:record.bestTimedTime===undefined?null:+record.bestTimedTime.toFixed(2),
    goldTarget:g.level.medalTargets.gold,
    ok:g.mode==='complete'&&!!finish&&finish.timed===true&&Number.isFinite(record.bestTimedTime)});
}
const songPilot = require('./song-pilot.cjs');
for (const style of ['gentle', 'flow']) {
  const game = create(0);
  // Fixture d'accès historique : ce contrôle joue la géométrie des trois îles.
  // Les règles des actes sont vérifiées séparément par test-order.cjs. La
  // frontière héritée passe par la migration, comme au chargement d'un disque.
  game.store.unlock('coeur-eclipse'); game.migrateJourneyFrontier();
  for (let index = 0; index < 3; index++) {
    if (!game.startSong(index, { style })) {
      results.push({ test: 'song island ' + (index + 1) + ' (' + style + ') unlocked by previous completion', ok: false });
      break;
    }
    const pilot = songPilot.create(game);
    for (let frame = 0; frame < 120 * 240 && ['playing', 'dead'].includes(game.mode); frame++) {
      pilot.step(); tick(game);
    }
    results.push({ test: 'song island ' + (index + 1) + ' (' + style + ') from spawn to exit, real inputs only',
      ...pilot.summary(), ok: ['complete', 'ending'].includes(game.mode) && game.song.count === 3 && game.levelStars === 3 && pilot.maxInputs <= 2 });
    if (!['complete', 'ending'].includes(game.mode)) break;
  }
}
// Every iteration-06 place uses its authored spawn, real input and mechanics.
// Completion alone is insufficient: each result also proves its specific idea.
const placesPlaythrough = require('./test-places-playthrough.cjs');
results.push(...placesPlaythrough.runAll().map(result => ({ test: 'authored place ' + result.key + ' from spawn to saved completion, real inputs only', ...result })));
console.log(JSON.stringify(results,null,2));
fs.writeFileSync(path.join(__dirname,'playthrough-results.json'),JSON.stringify(results,null,2));
process.exitCode=results.some(r=>r.ok===false||(r.ok===undefined&&!['complete','ending'].includes(r.mode)))?1:0;
