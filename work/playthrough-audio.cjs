'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const root='D:/Astra examples/LUMEN/';
const DT=1/120;
function create(stage){
  const window={innerWidth:1280,innerHeight:720,addEventListener(){},LumenRenderer:class{resize(){}},LumenAudio:class{setMuted(){}setTheme(){}unlock(){}resume(){}pause(){}sfx(){}}};
  const document={addEventListener(){},body:{classList:{contains:()=>true}}};
  const context=vm.createContext({window,document,localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},console,Math});
  for(const file of ['levels.js','engine.js'])vm.runInContext(fs.readFileSync(root+'js/'+file,'utf8'),context);
  const game=new window.LumenGame({});game.loadLevel(stage);return game;
}
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
      key(g,'right',true);
      const p=g.player;
      const source=g.platforms.filter(s=>s.type==='ground'&&s.x<=p.x+16&&s.x+s.w>=p.x+16).sort((a,b)=>b.x-a.x)[0];
      const edge=source?source.x+source.w:Infinity;
      const upcoming=g.enemies.some(e=>e.alive&&e.x>p.x&&e.x-p.x<125&&Math.abs(e.y-p.y)<110);
      if(p.grounded&&g.elapsed-lastJump>.12&&(edge-p.x<80||upcoming)){
        trace.push({event:'jump',x:+p.x.toFixed(1),y:+p.y.toFixed(1),edge,time:+g.elapsed.toFixed(2)});
        key(g,'jump',true);jumpUntil=g.elapsed+.45;lastJump=g.elapsed;
      }else if(g.elapsed>jumpUntil)key(g,'jump',false);
    }
    tick(g);maxX=Math.max(maxX,g.player.x);
  }
  results.push({test:'stage 0 spawn to exit, actual enemies and pickups',mode:g.mode,seconds:+g.elapsed.toFixed(2),deaths:g.deaths,lives:g.lives,hp:g.player.hp,coins:g.levelCoins,maxX:+maxX.toFixed(1),trace});
}
{
  const g=create(7);
  // The only placement is the permitted arena checkpoint initialization.
  Object.assign(g.player,{x:3404,y:552});g.checkpoint={x:3404,y:552};
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
          const landing=Math.max(3470,Math.min(4540,b.x+b.vx*remaining));
          target=p.x<landing+b.w/2?landing-155:landing+b.w+125;
        }else target=p.x<b.x+b.w/2?b.x-180:b.x+b.w+155;
        target=Math.max(3430,Math.min(4650,target));
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
console.log(JSON.stringify(results,null,2));
fs.writeFileSync(root+'work/playthrough-results.json',JSON.stringify(results,null,2));
process.exitCode=results.some(r=>!['complete','ending'].includes(r.mode))?1:0;
