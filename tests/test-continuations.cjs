/* Only the initial checkpoint is a fixture. Every new jump uses actual input,
 * collisions, pickups and hazards. The six places also have full spawn pilots. */
'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./test-places-playthrough.cjs');
const pilot=require('./place-pilot.cjs');
const DT=1/120;
let passed=0;
const {window}=environment();
for(const definition of window.LUMEN_LEVELS.filter(l=>l.continuation)) {
  const {game}=environment();game.loadLevel(game.indexOfKey(definition.key));
  const route=game.level.continuation.route;
  const first=route[0];
  Object.assign(game.player,{x:first.x-16,y:first.surfaceY-game.player.h});
  game.checkpoint={x:game.player.x,y:game.player.y};
  // Give the input pilot its route without installing a new gameplay mechanic.
  const view=Object.create(game);
  view.level={...game.level,place:{pilot:route}};view.place={kind:'continuation'};
  const controller=pilot.create(view);
  for(let f=0;f<120*100&&game.mode==='playing'&&game.player.x<game.level.continuation.end-190;f++) {
    controller.step();game.update(DT);game.input.clearFrame();
  }
  assert.equal(game.deaths,0,definition.key+' new route caused a fall');
  assert.ok(game.player.x>=game.level.continuation.end-190,definition.key+' blocked: '+JSON.stringify(controller.summary()));
  assert.ok(game.levelCoins>=20,definition.key+' new route is empty');
  assert.ok(controller.jumps>=5,definition.key+' new route should contain real jumps');
  assert.ok(game.level.width>game.level.originalWidth+2000,definition.key+' insufficient extension');
  passed++;
}
assert.equal(window.LUMEN_LEVELS[0].width,3900);
assert.equal(window.LumenSong.ISLANDS[0].width,4200);
// The camera follows the real jumping motion at multiple render cadences.
for(const hz of [30,60,120]) {
  const {game}=environment();game.loadLevel(0);
  game.renderer.width=956;game.renderer.height=440;
  const ledge=game.platforms.find(p=>p.x===3390);
  Object.assign(game.player,{x:ledge.x+30,y:ledge.y-46,grounded:true,standingPlatform:ledge});
  game.camera.y=0;game.followCamera(0,true);
  game.input.virtual('jump',true,'camera-test');
  let min=Infinity,maxDelta=0,previous=game.camera.y;
  for(let frame=0;frame<hz;frame++) {
    for(let sub=0;sub<120/hz;sub++){game.update(DT);game.input.clearFrame();}
    min=Math.min(min,440*.69-600*.64+(game.player.y-game.camera.y)*.64);
    maxDelta=Math.max(maxDelta,Math.abs(game.camera.y-previous)*.64);previous=game.camera.y;
  }
  assert.ok(min>88,'Player entered the HUD at '+hz+' Hz: '+min);
  assert.ok(maxDelta<20,'Abrupt vertical camera at '+hz+' Hz');
  game.loadLevel(0);assert.equal(game.camera.y,0,'New stage must reset vertical camera');
}
console.log(passed+' extended routes crossed with real inputs; vertical camera checked at 30/60/120 Hz.');
