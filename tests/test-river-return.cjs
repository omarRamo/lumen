'use strict';
const assert=require('node:assert/strict');
const {environment}=require('./test-places-playthrough.cjs');
const pilot=require('./place-pilot.cjs');
const DT=1/120;
const {game}=environment();game.loadLevel(game.indexOfKey('riviere-sans-lune'));
// Reproduce the report: three optional fragments, one missed reflection, at
// the final flag. All temporary bridges have expired. No power or invulnerability.
const flag=game.checkpoints.at(-1);
Object.assign(game.player,{x:flag.x,y:flag.y-46});
game.checkpoint={x:game.player.x,y:game.player.y};game.levelStars=3;
game.wokenOnce.add('riviere-reflet');game.wokenOnce.add('riviere-lune');
const reverse=Array.from(game.level.continuation.route).slice(0,-1).reverse();
reverse[0]={x:flag.x+16,surfaceY:flag.y};
reverse.push(...[3400,3090,2250,1940,1560,780,585].map(x=>({x,surfaceY:600})));
const view=Object.create(game);view.level={...game.level,place:{...game.level.place,pilot:reverse}};
const controller=pilot.create(view);
for(let f=0;f<120*150&&game.mode==='playing'&&!game.wokenOnce.has('riviere-source');f++){
  controller.step();game.update(DT);game.input.clearFrame();
}
assert.equal(game.deaths,0,'Return must not cost a life: '+JSON.stringify(controller.summary()));
assert.ok(game.wokenOnce.has('riviere-source'),'Source unreachable: '+JSON.stringify(controller.summary()));
assert.equal(game.exit.open,true,'All three reflections open the portal, independently of fragments');
// Now travel from the source back to the same exit, through real resonance,
// collisions and enemy encounters, without teleporting or reloading the stage.
game.input.reset();const onward=pilot.create(game);
for(let f=0;f<120*180&&['playing','dead'].includes(game.mode);f++){
  onward.step();game.update(DT);game.input.clearFrame();
}
assert.equal(game.mode,'complete',JSON.stringify(onward.summary()));
assert.equal(game.deaths,0,'Full recovery must not need a sacrificial respawn');
console.log('PASS Moonless River: final flag → missed source → portal, without deaths or powers.');
