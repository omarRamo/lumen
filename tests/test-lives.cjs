'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./test-places-playthrough.cjs');
const DT=1/120;
const tick=(game,seconds)=>{for(let f=0;f<seconds*120;f++){game.update(DT);game.input.clearFrame();}};
for(const style of ['campaign','gentle','flow']) {
  const {game,window,storage}=environment();
  if(style==='campaign')game.start(0);else game.startSong(0,{style});
  assert.equal(game.lives,3,style+' starts with three lives');
  game.store.recordChapter('prairies-aurore',{completed:true,stars:2,time:95,coins:40,score:1000,medal:"silver"});
  game.store.save();
  const saved=JSON.stringify(game.store.chapter('prairies-aurore'));
  const spawn={...game.level.spawn},flag=game.checkpoints[0];
  Object.assign(game.player,{x:flag.x,y:flag.y-46});game.updateCheckpoints();
  const checkpoint={...game.checkpoint};
  const token=game.collectibles.find(c=>c.type==='life');
  Object.assign(game.player,{x:token.x-16,y:token.y-22});game.updateCollectibles();
  assert.equal(game.lives,4);assert.equal(token.taken,true);
  game.updateCollectibles();assert.equal(game.lives,4,'A token counts only once');
  game.player.hp=1;
  game.collectibles.push({type:'heart',x:game.player.x+16,y:game.player.y+22,taken:false});
  game.updateCollectibles();assert.equal(game.player.hp,2);assert.equal(game.lives,4,'Hearts heal, they are not lives');
  for(let expected=3;expected>=0;expected--){
    game.die();game.die();assert.equal(game.lives,expected,'A death consumes exactly one life');
    tick(game,1);
    assert.equal(game.mode,expected?'playing':'gameover',style);
    assert.equal(token.taken,true,'Respawning cannot farm lives');
    if(expected)assert.equal(game.player.hp,3);
  }
  game.resume();assert.equal(game.mode,'gameover');
  game.showMap();game.returnFromJourneyMap();assert.equal(game.mode,'gameover','Atlas cannot bypass exhaustion');
  game.retry();assert.equal(game.lives,3);assert.equal(game.mode,'playing');assert.equal(game.deaths,0);
  assert.deepEqual({...game.level.spawn},spawn);assert.equal(game.player.x,spawn.x);
  assert.notEqual(game.checkpoint.x,checkpoint.x,'Retry discards the old checkpoint');
  assert.ok(game.collectibles.filter(c=>c.type==='life').every(c=>!c.taken));
  game.lives=8;
  const extra=game.collectibles.find(c=>c.type==='life');
  Object.assign(game.player,{x:extra.x-16,y:extra.y-22});game.updateCollectibles();assert.equal(game.lives,9);
  const another=game.collectibles.filter(c=>c.type==='life')[1];
  Object.assign(game.player,{x:another.x-16,y:another.y-22});game.updateCollectibles();
  assert.equal(game.lives,9);assert.equal(another.taken,false,'At the cap the token stays available');
  game.start(0);assert.equal(game.lives,3,'Lives do not carry into another stage');
  assert.equal(game.store.profile.schema,3);
  assert.equal(JSON.stringify(game.store.chapter('prairies-aurore')),saved,'Previously saved progress survives defeat and retry');
  const restored=new window.LumenSave.SaveStore({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  assert.equal(JSON.stringify(restored.chapter('prairies-aurore')),saved,'Saved progress survives a new store');
  console.log('PASS '+style+': pickups, health, finite deaths, no farming, retry, cap and stage reset');
}
// Every chapter/island has two identifiable, physically reachable life pickups.
const {window}=environment();let stages=0,pickups=0;
for(const source of [...window.LUMEN_LEVELS.filter(l=>!l.hub),...window.LumenSong.ISLANDS]) {
  const tokens=source.collectibles.filter(c=>c.type==='life');assert.equal(tokens.length,2,source.key);
  for(let index=0;index<tokens.length;index++) {
    const {game}=environment();
    const songIndex=window.LumenSong.ISLANDS.findIndex(s=>s.key===source.key);
    if(songIndex>=0){game.session='song';game.applyLevel(window.LumenSong.create(songIndex),-1);}
    else game.loadLevel(game.indexOfKey(source.key));
    const token=game.collectibles.filter(c=>c.type==='life')[index];
    const support=game.platforms.find(p=>p.active&&p.type==='ground'&&token.x>=p.x&&token.x<=p.x+p.w&&p.y>token.y&&p.y-token.y<100);
    assert.ok(support,source.key+' life has no safe foothold');
    Object.assign(game.player,{x:token.x-16,y:support.y-46,grounded:true,standingPlatform:support});
    game.input.virtual('jump',true,'life-test');tick(game,.35);
    assert.equal(token.taken,true,source.key+' life unreachable with ordinary jump');pickups++;
  }
  stages++;
}
assert.equal(stages,20);assert.equal(pickups,40);
console.log('PASS '+pickups+' life pickups reached with actual jumps in '+stages+' stages.');
