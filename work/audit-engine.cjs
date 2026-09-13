const fs = require('fs');
const vm = require('vm');
const events = {};
const fakeAudio = class { setMuted() {} setTheme() {} unlock() {} resume() {} pause() {} sfx() {} };
const window = { innerWidth:1280, innerHeight:720, LumenAudio:fakeAudio,
  LumenRenderer:class { resize() {} }, addEventListener(name,fn) { (events[name] ||= []).push(fn); } };
const document = { body:{ classList:{contains:()=>true} }, addEventListener() {} };
const context = vm.createContext({ window, document, localStorage:{getItem(){return null},setItem(){}}, requestAnimationFrame(){}, Math, console });
for (const file of ['levels.js','engine.js']) vm.runInContext(fs.readFileSync('D:/Astra examples/LUMEN/js/'+file,'utf8'),context);
const game = new window.LumenGame({});
game.loadLevel(0);
game.enemies = [];
game.collectibles = [];
game.player.x=100;
game.player.y=535;
game.player.vy=200;
game.player.grounded=false;
game.input.virtual('jump',true);
game.update(1/120);game.input.clearFrame();
game.input.virtual('jump',false);
game.update(1/120);game.input.clearFrame();
let grounded=false;
for(let i=0;i<20;i++){
  game.update(1/120);game.input.clearFrame();
  if(game.player.grounded)grounded=true;
  if(game.player.vy < 0){console.log('buffered tap',{grounded,jumpHeld:game.input.down('jump'),vy:game.player.vy});break;}
}

game.loadLevel(0);
game.player.x=100;game.player.y=554;game.player.grounded=true;game.player.hp=1;
game.enemies=[{type:'patrol',x:105,y:566,w:36,h:34,vx:0,vy:0,phase:0,timer:1,facing:1,spawnX:105,spawnY:566,minX:100,maxX:200,alive:true,hp:1}];
game.collectibles=[{type:'heart',x:116,y:570,taken:false},{type:'coin',x:117,y:571,taken:false}];
game.update(1/120);
console.log('lethal enemy + pickup',{mode:game.mode,hp:game.player.hp,heartTaken:game.collectibles[0].taken,coins:game.levelCoins});

// Verify a standard unpowered jump can hit the lowered boss crown.
game.loadLevel(7);
game.enemies=[];game.collectibles=[];
Object.assign(game.boss,{activated:true,state:'recover',timer:3.4,vulnerable:true,y:530});
Object.assign(game.player,{x:game.boss.x-100,y:554,grounded:true,coyote:.12,vx:0,vy:0});
game.input.virtual('jump',true);game.input.virtual('right',true);
let hit=false;
for(let i=0;i<120;i++){
  if(game.player.x > game.boss.x+35){game.input.virtual('right',false);game.player.vx=0;}
  game.update(1/120);game.input.clearFrame();
  if(game.boss.hp<12){hit=true;console.log('normal jump hits boss',{hp:game.boss.hp,playerHp:game.player.hp,time:i/120});break;}
}
if(!hit)throw new Error('Unable to reach boss crown with normal jump');
