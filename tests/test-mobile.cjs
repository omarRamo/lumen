/* Real browser layout + simulated native bridge/input. This is not physical iOS validation. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const engine = process.env.LUMEN_BROWSER || 'chromium';
const browserType = require('playwright')[engine];
const browserTools = require('../tools/browser.cjs');
const root = path.resolve(__dirname, '..');
// Les quatre premiers sont des iPhone, les deux iPad, puis trois Android. En paysage,
// la pastille d'un Android tombe sur un bord court ; ses barres sont masquées, donc
// le bas retombe sur le plancher CSS de 12 px, sauf pliable où la pilule reste.
const views = [
  {name:'iPhone Pro Max',width:956,height:440,side:62,bottom:21},
  {name:'iPhone landscape',width:844,height:390,side:47,bottom:21},
  {name:'iPhone SE',width:667,height:375,side:16,bottom:12},
  {name:'small landscape',width:568,height:320,side:16,bottom:12},
  {name:'iPad portrait',width:768,height:1024,side:16,bottom:21},
  {name:'iPad landscape',width:1024,height:768,side:16,bottom:21},
  {name:'Android pastille',width:915,height:412,side:34,bottom:12},
  {name:'Android compact',width:780,height:360,side:16,bottom:12},
  {name:'Android pliable',width:841,height:701,side:16,bottom:24}
];
let browser, passed=0;
async function open(view,language='fr',native=true) {
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},isMobile:true,hasTouch:true,deviceScaleFactor:3,locale:language});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!/^(file|data):/.test(r.url()))external.push(r.url());});
  await page.addInitScript(({native,language})=>{
    // Le pont d'Android retient ses écouteurs : le test peut appuyer sur « retour ».
    if(native)window.Capacitor={isNativePlatform:()=>true,Plugins:{App:{
      addListener(name,fn){(window.__bridge??={})[name]=fn;return Promise.resolve({remove(){}});},
      minimizeApp(){window.__minimized=(window.__minimized||0)+1;return Promise.resolve();}
    }}};
    localStorage.setItem('lumen.gardens.v3',JSON.stringify({schema:3,settings:{muted:true,language,appearance:language==='ar'?'dark':'light'}}));
  },{native,language});
  await page.goto(pathToFileURL(path.join(root,'LUMEN.html')).href);
  await page.waitForFunction(()=>window.LumenBoot?.ready);
  assert.ok(await page.evaluate(()=>LumenBoot.elapsed)>=1200);
  assert.deepEqual(await page.evaluate(()=>LumenBoot.steps.sort()),['atlas','audio','fonts','save']);
  assert.equal(await page.evaluate(()=>lumen.mode),'title');
  assert.equal(await page.locator('#touch-controls').isVisible(),false);
  await page.addStyleTag({content:`:root{--play-left:${view.side}px;--play-right:${view.side}px;--play-bottom:${view.bottom}px;}`});
  await targets(page,'#title-enter',view);
  await require('./browser-entry.cjs').enter(page,{play:false});
  await targets(page,'#journey-continue,[data-journey-settings]',view);
  const next=await page.evaluate(()=>LumenJourney.next(lumen).id);
  const marker=await page.locator('.journey-region.is-current .journey-lumen').evaluate(n=>{
    const r=n.getBoundingClientRect();return {id:n.dataset.currentPlace,x:r.x+r.width/2};
  });
  assert.equal(marker.id,next);assert.ok(Math.abs(marker.x-view.width/2)<2,JSON.stringify(marker));
  assert.ok(await page.locator('#journey-continue').evaluate(n=>n.getBoundingClientRect().height>=56));
  await page.locator('#journey-continue').tap();
  await page.waitForFunction(next=>lumen.mode==='playing'&&lumen.level.key===next,next);
  await page.waitForFunction(()=>window.lumen?.frames>2);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:`:root{--play-left:${view.side}px;--play-right:${view.side}px;--play-bottom:${view.bottom}px;}`});
  return {page,context,errors,external};
}
async function targets(page,selector,view,{overlap=true}={}) {
  const result=await page.evaluate(({selector,side,bottom})=>{
    const nodes=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&!n.closest('[hidden],.hidden') && (!n.closest('.journey-region') || (()=>{const r=n.getBoundingClientRect(),p=n.closest('.journey-region').getBoundingClientRect();return r.left>=p.left&&r.right<=p.right;})()));
    const rects=nodes.map(n=>({id:n.dataset.place||n.dataset.command||n.dataset.touch||n.textContent.trim(),r:n.getBoundingClientRect().toJSON(),n}));
    const bad=[],pairs=[];
    for(const {id,r,n} of rects) {
      if(r.width<47.9||r.height<47.9||r.left<side-1||r.right>innerWidth-side+1||r.top<9||r.bottom>innerHeight-bottom+1)bad.push({id,r});
      const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      if(!hit||(!n.contains(hit)&&hit!==n))bad.push({id,coveredBy:hit?.outerHTML.slice(0,120)});
    }
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const a=rects[i].r,b=rects[j].r;
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)pairs.push([rects[i].id,rects[j].id]);
    }
    return {bad,pairs,count:rects.length};
  },{selector,side:view.side,bottom:view.bottom});
  assert.ok(result.count,selector+' has no targets');
  assert.deepEqual(result.bad,[],view.name+' '+selector);
  if(overlap)assert.deepEqual(result.pairs,[],view.name+' overlapping controls');
}
async function controlGeometry(page,view) {
  for(const scale of [.85,1,1.3])for(const left of [false,true]) {
    await page.evaluate(({scale,left})=>{
      lumen.store.setSetting('touchScale',scale);lumen.store.setSetting('leftHanded',left);
      document.documentElement.style.setProperty('--touch-scale',scale);
      document.body.classList.toggle('left-handed',left);
    },{scale,left});
    await targets(page,'#touch-controls button',view);
    const measured=await page.evaluate(()=>[...document.querySelectorAll('[data-touch]')].filter(n=>n.getClientRects().length).map(n=>{
      const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y-3);
      const inset=parseFloat(getComputedStyle(n,'::before').insetBlockStart)||0;
      return {action:n.dataset.touch,width:r.width,height:r.height,extra:!!hit&&n.contains(hit),ink:r.width-inset*2};
    }));
    for(const item of measured){
      const size=({left:88,right:88,jump:96,action:80})[item.action];
      assert.ok(size,'Unexpected touch control: '+item.action);
      const expected=Math.max(48,size*scale);
      assert.ok(Math.abs(item.width-expected)<.1&&Math.abs(item.height-expected)<.1,JSON.stringify({view,scale,left,item}));
      assert.ok(item.extra,'Missing 4px hit margin: '+item.action);
      // L'encre reste plus petite que la cible : le décor vit sous le pouce.
      assert.ok(item.ink>0&&item.ink<item.width-12,'Ink must stay inside the target: '+JSON.stringify(item));
    }
    const pos=await page.evaluate(()=>{
      const r=document.querySelector('.touch-controls').getBoundingClientRect(),m=document.querySelector('.touch-move').getBoundingClientRect();
      return {left:r.left,right:innerWidth-r.right,bottom:innerHeight-r.bottom,moveLeft:m.left,moveRight:innerWidth-m.right};
    });
    assert.equal(pos.left,view.side+12);assert.equal(pos.right,view.side+12);assert.equal(pos.bottom,view.bottom+20);
    assert.ok(Math.abs((left?pos.moveRight:pos.moveLeft)-(view.side+12))<1);
  }
  await page.evaluate(()=>{lumen.store.setSetting('touchScale',1);lumen.store.setSetting('leftHanded',false);document.documentElement.style.setProperty('--touch-scale',1);document.body.classList.remove('left-handed');});
}
// Issue 5 : sur un téléphone couché, le sol du jeu passe au-dessus des disques
// au lieu de s'y coller, et un écran très allongé zoome au lieu d'élargir.
async function groundClearance(page,view) {
  if(view.width<view.height||view.height>=500)return;
  const frame=await page.evaluate(()=>{
    const r=lumen.renderer,top=Math.min(...[...document.querySelectorAll('[data-touch]')].map(n=>n.getBoundingClientRect().top));
    return {ground:r.offsetY+600*r.scale,top,worldWidth:r.worldWidth,scale:r.scale};
  });
  assert.ok(frame.ground<=frame.top-8,view.name+' ground under the controls: '+JSON.stringify(frame));
  assert.ok(frame.worldWidth<=1340.5||frame.scale===.64,view.name+' wide screen must zoom: '+JSON.stringify(frame));
}
// Issue 6 : une bulle reste dans la bande du haut. Elle ne touche ni un bouton
// ni Lumen, et tient sur trois lignes au plus, même pour l'aide la plus longue.
const rectsMeet=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
async function playerRect(page) {
  return page.evaluate(()=>{const r=lumen.renderer,p=lumen.player,x=r.offsetX+(p.x-lumen.camera.x)*r.scale,y=r.offsetY+(p.y-lumen.camera.y)*r.scale;
    return {left:x,top:y,right:x+p.w*r.scale,bottom:y+p.h*r.scale};});
}
async function toastBand(page,view) {
  await page.evaluate(()=>lumen.emit('toast','Au-dessus de la lave, un saut précis vaut mieux qu’un départ précipité. Les sommets récompensent la patience.'));
  await page.waitForTimeout(350);
  const m=await page.evaluate(()=>{
    const t=document.getElementById('toast'),r=t.getBoundingClientRect().toJSON();
    const buttons=[...document.querySelectorAll('#hud button,.song-header button,#touch-controls button')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().toJSON());
    return {r,buttons,lines:Math.round(r.height/parseFloat(getComputedStyle(t).lineHeight))};
  });
  assert.ok(m.r.bottom<=76,view.name+' toast leaves the top band: '+JSON.stringify(m.r));
  for(const b of m.buttons)assert.ok(!rectsMeet(m.r,b),view.name+' toast covers a button: '+JSON.stringify({toast:m.r,b}));
  assert.ok(!rectsMeet(m.r,await playerRect(page)),view.name+' toast covers Lumen');
  await page.evaluate(()=>{lumen.emit('toast','');document.getElementById('toast').classList.remove('show');document.body.classList.remove('toast-on');});
}
async function pauseAndSettings(page,view,song) {
  const header=song?'.song-header':'#hud';
  await targets(page,`${header} button`,view);
  await page.locator(`${header} [data-command="pause"]`).tap();
  const pause=song?'#song-panel':'#pause-screen';
  await page.locator(pause).waitFor({state:'visible'});
  await targets(page,`${pause} button`,view);
  await page.locator(`${pause} [data-command="resume"]`).tap();
  assert.equal(await page.locator(`${header} [data-command="help"], ${header} [data-command="song-settings"]`).count(),0);
  assert.equal(await page.evaluate(()=>lumen.mode),'playing');
}
async function finishScreen(page,view,song) {
  // Display fixture only. Actual completion is covered by the input-only pilots.
  await page.evaluate(song=>{
    if(song){lumen.song.lights.forEach(e=>e.found=true);lumen.song.count=3;}
    lumen.levelStars=3;lumen.complete();lumen.emit('frame',.1);
  },song);
  const panel=song?'#song-panel':'.complete-card';
  await page.locator(panel).waitFor({state:'visible'});
  await targets(page,`${panel} button`,view);
  assert.ok(await page.locator(panel).evaluate(n=>n.scrollHeight<=n.clientHeight+1),'Completion must fit without scrolling');
  assert.equal(await page.locator(`${panel} .results,${panel} .song-results`).count(),0);
  await page.locator(`${panel} [data-command="${song?'song-retry':'replay'}"]`).tap();
  await page.waitForFunction(()=>lumen.mode==='playing');
}
async function exhaustedLives(page,view,song) {
  await page.evaluate(()=>{
    for(let n=0;n<3;n++){lumen.die();lumen.respawn();}
    lumen.emit('frame',.1);
  });
  assert.equal(await page.evaluate(()=>lumen.mode),'gameover');
  const panel=song?'#song-panel':'#pause-screen';
  await page.locator(panel).waitFor({state:'visible'});
  await targets(page,`${panel} button`,view);
  assert.equal(await page.locator(`${panel} [data-command="resume"]:visible`).count(),0);
  assert.ok(await page.locator(song?'#song-panel':'.pause-card').evaluate(n=>n.scrollHeight<=n.clientHeight+1),'Game over must fit without scrolling');
  await page.locator(`${panel} [data-command="${song?'song-retry':'retry'}"]`).tap();
  await page.waitForFunction(()=>lumen.mode==='playing');
  assert.equal(await page.evaluate(()=>lumen.lives),3);
  await page.waitForFunction(song=>document.getElementById(song?'song-life-count':'life-count').textContent==='×3',song);
  assert.ok(await page.locator(song?'#song-life-count':'#life-count').isVisible(),'Lives must stay visible on mobile');
}
async function close(run) {
  assert.deepEqual(run.errors,[]);assert.deepEqual(run.external,[]);await run.context.close();
}
(async()=>{
  browser=await browserType.launch(browserTools.launchOptions());
  try {
    for(const view of views)for(const language of ['fr','ar']) {
      const run=await open(view,language),{page}=run;
      await controlGeometry(page,view);
      await groundClearance(page,view);
      await toastBand(page,view);
      await pauseAndSettings(page,view,true);
      await finishScreen(page,view,true);
      await exhaustedLives(page,view,true);
      await page.evaluate(()=>lumen.start(0));
      await controlGeometry(page,view);
      await groundClearance(page,view);
      await toastBand(page,view);
      await pauseAndSettings(page,view,false);
      await finishScreen(page,view,false);
      await exhaustedLives(page,view,false);
      assert.equal(await page.locator("#power-indicator").count(),0);
      assert.equal(await page.evaluate(()=>LumenAppearance.current),"light");
      await page.evaluate(()=>lumen.showMap());
      await targets(page,'#journey-continue,[data-journey-settings]',view);
      const current=await page.evaluate(()=>LumenJourney.next(lumen).id);
      assert.equal(await page.locator('.journey-lumen').getAttribute('data-current-place'),current);
      await page.locator('[data-journey-settings]').tap();
      await targets(page,'#song-panel > .song-icon[data-command="song-close"]',view);
      await page.locator('#song-panel').evaluate(n=>n.scrollTop=n.scrollHeight);
      await targets(page,'#song-panel > .song-icon[data-command="song-close"]',view);
      await page.locator('#song-panel > .song-icon[data-command="song-close"]').tap();
      assert.equal(await page.evaluate(()=>lumen.mode),'map');
      // Un appui ouvre la fiche, un second lance. La fiche vient du bas mais ne
      // recouvre jamais le quai : « Continuer » reste visible et touchable.
      await page.locator(`[data-place="${current}"]`).tap();
      await page.locator('#journey-details').waitFor({state:'visible'});
      const sheet=await page.evaluate(()=>{
        const card=document.getElementById('journey-details').getBoundingClientRect();
        const dock=document.getElementById('journey-continue').getBoundingClientRect();
        const launch=document.querySelector('#journey-details [data-journey-launch]').getBoundingClientRect();
        return {covers:card.bottom>dock.top+1,height:launch.height,inView:launch.top>=0&&launch.bottom<=innerHeight,
          hit:document.elementFromPoint(launch.x+launch.width/2,launch.y+launch.height/2)?.closest('[data-journey-launch]')!==null};
      });
      assert.equal(sheet.covers,false,view.name+' : la fiche recouvre le quai de départ');
      assert.ok(sheet.inView&&sheet.hit,JSON.stringify(sheet));
      assert.ok(sheet.height>=56,JSON.stringify(sheet));
      // Sur un écran court la fiche recouvre la lumière choisie : le second appui
      // n'est plus possible au doigt, et le bouton de la fiche — déjà prouvé visible
      // et touchable ci-dessus — devient le seul chemin. Prendre celui qui existe.
      const exposed=await page.locator(`[data-place="${current}"]`).evaluate(n=>{
        const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return !!hit&&(n.contains(hit)||hit===n);
      });
      await page.locator(exposed?`[data-place="${current}"]`:'#journey-details [data-journey-launch]').tap();
      await page.waitForFunction(key=>lumen.mode==='playing'&&lumen.level.key===key,current);
      await page.evaluate(()=>lumen.showMap());
      for(const act of [1,2,3]) {
        await page.locator(`[data-journey-act="${act}"]`).tap();
        await targets(page,'#map-screen button',view);
        const nodes=await page.locator('.journey-region.is-current [data-place]').evaluateAll(ns=>ns.map(n=>n.dataset.place));
        for(const id of nodes) {
          await page.locator(`[data-place="${id}"]`).tap();
          await targets(page,'#journey-details [data-journey-launch],#journey-details [data-journey-requirement],#journey-continue',view);
          await page.locator('[data-journey-sky]').tap();
          assert.equal(await page.locator('#map-screen').evaluate(n=>n.scrollTop),0,'Selecting a level must not scroll the atlas');
        }
      }
      await close(run);passed++;console.log('PASS '+engine+' '+view.name+' '+language+': safe areas, pause, settings, compact finishes, all stages');
    }
    {
      const run=await open(views[0]),{page}=run;
      await page.addScriptTag({path:path.join(__dirname,'song-pilot.cjs')});
      const camera=await page.evaluate(()=>{
        lumen.running=false;
        const pilot=LumenSongPilot.create(lumen),r=lumen.renderer;
        let highest=Infinity,nearestHUD=Infinity,maxStep=0,previous=lumen.camera.y;
        for(let frame=0;frame<120*180&&lumen.mode==='playing';frame++) {
          pilot.step();lumen.update(1/120);lumen.input.clearFrame();
          const y=r.offsetY+(lumen.player.y-lumen.camera.y)*r.scale;
          highest=Math.min(highest,lumen.player.y);nearestHUD=Math.min(nearestHUD,y);
          maxStep=Math.max(maxStep,Math.abs(lumen.camera.y-previous)*r.scale);previous=lumen.camera.y;
        }
        r.draw(lumen,0);
        return {mode:lumen.mode,highest,nearestHUD,maxStep,cameraY:r.cameraY,expected:lumen.camera.y};
      });
      assert.equal(camera.mode,'complete');assert.ok(camera.highest<200,JSON.stringify(camera));
      assert.ok(camera.nearestHUD>views[0].height*.20,JSON.stringify(camera));
      assert.ok(camera.maxStep<7,JSON.stringify(camera));
      assert.equal(camera.cameraY,camera.expected,'Song renderer must apply vertical camera');
      await close(run);passed++;console.log('PASS '+engine+' continuous vertical camera through a real island run');
    }
    const run=await open(views[0]),{page}=run;
    assert.equal(await page.evaluate(()=>lumen.renderer.dpr),1.5);
    assert.ok(await page.evaluate(()=>document.querySelector('meta[name=viewport]').content.includes('user-scalable=no')));
    const protections=await page.evaluate(()=>['#game','.song-header','.song-objective','#touch-controls'].map(selector=>{
      const n=document.querySelector(selector),e=new Event('contextmenu',{bubbles:true,cancelable:true});n.dispatchEvent(e);
      return {select:getComputedStyle(n).webkitUserSelect||getComputedStyle(n).userSelect,blocked:e.defaultPrevented};
    }));
    assert.ok(protections.every(p=>p.select==='none'&&p.blocked),JSON.stringify(protections));
    for(let i=0;i<4;i++)await page.locator('[data-touch="jump"]').tap();
    assert.equal(await page.evaluate(()=>visualViewport.scale),1);
    // Simultaneous pointers and a direction change without lifting either thumb.
    await page.evaluate(()=>{lumen.start(0);lumen.running=false;});
    const box=await page.locator('.touch-move').boundingBox();
    const pointer=(name,id,x)=>({pointerId:id,pointerType:'touch',isPrimary:id===10,bubbles:true,cancelable:true,clientX:x,clientY:box.y+box.height/2,buttons:name==='pointerup'?0:1});
    await page.locator('[data-touch=left]').dispatchEvent('pointerdown',pointer('pointerdown',10,box.x+20));
    await page.locator('[data-touch=jump]').dispatchEvent('pointerdown',pointer('pointerdown',11,800));
    assert.deepEqual(await page.evaluate(()=>[lumen.input.down('left'),lumen.input.down('jump')]),[true,true]);
    await page.evaluate(()=>{for(let i=0;i<3;i++){lumen.update(1/120);lumen.input.clearFrame();}});
    assert.ok(await page.evaluate(()=>lumen.player.vy<0),'Jump must work while moving');
    await page.locator('[data-touch=left]').dispatchEvent('pointermove',pointer('pointermove',10,box.x+box.width-20));
    assert.deepEqual(await page.evaluate(()=>[lumen.input.down('left'),lumen.input.down('right'),lumen.input.down('jump')]),[false,true,true]);
    await page.waitForTimeout(420);assert.ok(await page.evaluate(()=>lumen.input.down('run')));
    await page.locator('[data-touch=jump]').dispatchEvent('pointercancel',pointer('pointercancel',11,800));
    assert.deepEqual(await page.evaluate(()=>[lumen.input.down('jump'),lumen.input.down('right')]),[false,true]);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>lumen.input.touchActive),false,'Keyboard restores its original jump tolerance');
    await page.evaluate(()=>lumen.pause());
    assert.equal(await page.evaluate(()=>lumen.input.keys.size),0);
    assert.equal(await page.locator('.touch-controls .held').count(),0);
    // A paused game must not redraw at display refresh rate, but must redraw after rotation.
    const draws=await page.evaluate(()=>{
      let count=0;const draw=lumen.renderer.draw.bind(lumen.renderer);lumen.renderer.draw=(...args)=>{count++;draw(...args);};
      window.requestAnimationFrame=()=>0;lumen.running=true;
      for(let i=0;i<10;i++)lumen.frame(1000+i*16.67);
      const paused=count;lumen.renderer.resize(900,440);lumen.frame(1300);
      return {paused,rotated:count};
    });
    assert.equal(draws.paused,1);assert.equal(draws.rotated,2);
    await close(run);passed++;console.log('PASS native gestures, simultaneous touch, cancellation, render budget');

    // Android n'a pas de touche Échap. Son bouton « retour » doit ouvrir la pause,
    // la refermer, reculer dans l'atlas, puis rendre le téléphone au titre.
    {
      const run=await open(views[6]),{page}=run;
      const back=async()=>{await page.evaluate(()=>window.__bridge.backButton({canGoBack:false}));await page.waitForTimeout(60);};
      assert.equal(await page.evaluate(()=>lumen.mode),'playing');
      await back();assert.equal(await page.evaluate(()=>lumen.mode),'paused');
      // open() laisse le jeu sur la première île : sa pause est le panneau du Chant.
      await page.locator('#song-panel').waitFor({state:'visible'});
      await back();assert.equal(await page.evaluate(()=>lumen.mode),'playing');
      await page.evaluate(()=>lumen.showMap());
      await page.locator(`[data-place="${await page.evaluate(()=>LumenJourney.next(lumen).id)}"]`).tap();
      await page.locator('#journey-details').waitFor({state:'visible'});
      await back();
      assert.equal(await page.evaluate(()=>lumen.mode),'map','Le retour recule dans l’atlas, il n’en sort pas');
      assert.equal(await page.evaluate(()=>window.__minimized||0),0,'Une partie ouverte garde le téléphone');
      await page.evaluate(()=>{lumen.mode='title';});
      await back();
      assert.equal(await page.evaluate(()=>window.__minimized||0),1,'Au titre, le retour rend la main à Android');
      await close(run);passed++;console.log('PASS Android back button through the real atlas, pause and title');
    }
    const web=await open(views[0],'fr',false);
    assert.equal(await web.page.evaluate(()=>document.documentElement.classList.contains('lumen-native')),false);
    assert.ok(!(await web.page.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable'));
    await close(web);passed++;console.log('PASS portable edition preserves browser zoom');
    // Issue 6 : la réplique de Vesper est une bulle au-dessus de lui ; la quête,
    // une pastille. Rien ne recouvre les commandes ni Lumen.
    for(const view of views.filter(v=>['Android compact','iPhone Pro Max','Android pastille'].includes(v.name))) {
      const run=await open(view),{page}=run;
      await page.evaluate(()=>{lumen.isUnlocked=()=>true;lumen.start(lumen.indexOfKey('observatoire'));});
      await page.waitForFunction(()=>lumen.level.key==='observatoire'&&lumen.mode==='playing');
      await page.evaluate(()=>{const c=lumen.characters.find(c=>c.id==='vesper');lumen.player.x=c.x-60;lumen.player.y=c.y-lumen.player.h;lumen.player.vx=0;});
      await page.waitForFunction(()=>!document.getElementById('dialogue').classList.contains('hidden'));
      await page.waitForTimeout(300);
      const m=await page.evaluate(()=>({
        bubble:document.getElementById('dialogue').getBoundingClientRect().toJSON(),
        quest:document.getElementById('quest-banner').getBoundingClientRect().toJSON(),
        compact:document.getElementById('quest-banner').classList.contains('compact'),
        buttons:[...document.querySelectorAll('#touch-controls button,#hud button')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().toJSON())
      }));
      const lumenBox=await playerRect(page);
      assert.ok(m.compact,view.name+' quest stays folded while Vesper speaks');
      assert.ok(m.quest.height<=40&&m.quest.width<=120,view.name+' quest chip too large: '+JSON.stringify(m.quest));
      for(const b of m.buttons)assert.ok(!rectsMeet(m.bubble,b),view.name+' dialogue covers a button: '+JSON.stringify({bubble:m.bubble,b}));
      assert.ok(!rectsMeet(m.bubble,lumenBox),view.name+' dialogue covers Lumen: '+JSON.stringify({bubble:m.bubble,lumenBox}));
      assert.ok(!rectsMeet(m.bubble,m.quest),view.name+' dialogue covers the quest chip');
      await close(run);passed++;console.log('PASS '+view.name+': dialogue bubble and quest chip leave the scene free');
    }
  } finally {await browser.close();}
  console.log(`${passed} mobile checks passed (${engine}; simulated input and native bridge, no physical device).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
