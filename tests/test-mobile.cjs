/* Real browser layout + simulated native bridge/input. This is not physical iOS validation. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const engine = process.env.LUMEN_BROWSER || 'chromium';
const browserType = require('playwright')[engine];
const browserTools = require('../tools/browser.cjs');
const root = path.resolve(__dirname, '..');
const views = [
  {name:'iPhone Pro Max',width:956,height:440,side:62,bottom:21},
  {name:'iPhone landscape',width:844,height:390,side:47,bottom:21},
  {name:'iPhone SE',width:667,height:375,side:16,bottom:12},
  {name:'small landscape',width:568,height:320,side:16,bottom:12},
  {name:'iPad portrait',width:768,height:1024,side:16,bottom:21},
  {name:'iPad landscape',width:1024,height:768,side:16,bottom:21}
];
let browser, passed=0;
async function open(view,language='fr',native=true) {
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},isMobile:true,hasTouch:true,deviceScaleFactor:3,locale:language});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!/^(file|data):/.test(r.url()))external.push(r.url());});
  await page.addInitScript(({native,language})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,Plugins:{}};
    localStorage.setItem('lumen.gardens.v3',JSON.stringify({schema:3,settings:{muted:true,language,appearance:language==='ar'?'dark':'light'}}));
  },{native,language});
  await page.goto(pathToFileURL(path.join(root,'LUMEN.html')).href);
  await page.waitForFunction(()=>window.lumen?.frames>2);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:`:root{--play-left:${view.side}px;--play-right:${view.side}px;--play-bottom:${view.bottom}px;}`});
  return {page,context,errors,external};
}
async function targets(page,selector,view,{overlap=true}={}) {
  const result=await page.evaluate(({selector,side,bottom})=>{
    const nodes=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&!n.closest('[hidden],.hidden'));
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
async function pauseAndSettings(page,view,song) {
  const header=song?'.song-header':'#hud';
  await targets(page,`${header} button`,view);
  await page.locator(`${header} [data-command="pause"]`).tap();
  const pause=song?'#song-panel':'#pause-screen';
  await page.locator(pause).waitFor({state:'visible'});
  await targets(page,`${pause} button`,view);
  await page.locator(`${pause} [data-command="resume"]`).tap();
  await page.locator(`${header} [data-command="${song?'song-settings':'help'}"]`).tap();
  const panel=page.locator(song?'#song-panel':'.help-card');
  const close=song?'#song-panel > .song-icon[data-command="song-close"]':'.help-card > .close-button[data-command="close-help"]';
  await page.locator(close).waitFor({state:'visible'});
  await targets(page,close,view);
  await panel.evaluate(n=>{n.scrollTop=n.scrollHeight;});
  await targets(page,close,view);
  await page.locator(close).tap();
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
      await targets(page,'#touch-controls button',view);
      await pauseAndSettings(page,view,true);
      await finishScreen(page,view,true);
      await exhaustedLives(page,view,true);
      await page.evaluate(()=>lumen.start(0));
      await targets(page,'#touch-controls button',view);
      await pauseAndSettings(page,view,false);
      await finishScreen(page,view,false);
      await exhaustedLives(page,view,false);
      assert.equal(await page.locator("#power-indicator").count(),0);
      assert.equal(await page.evaluate(()=>LumenAppearance.current),"light");
      await page.evaluate(()=>lumen.showMap());
      for(const act of [1,2,3]) {
        await page.locator(`[data-journey-act="${act}"]`).tap();
        await targets(page,'#map-screen button',view);
        const nodes=await page.locator('.journey-region.is-current [data-place]').evaluateAll(ns=>ns.map(n=>n.dataset.place));
        for(const id of nodes) {
          await page.locator(`[data-place="${id}"]`).tap();
          await targets(page,'[data-journey-launch],[data-journey-requirement]',view);
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
    const web=await open(views[0],'fr',false);
    assert.equal(await web.page.evaluate(()=>document.documentElement.classList.contains('lumen-native')),false);
    assert.ok(!(await web.page.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable'));
    await close(web);passed++;console.log('PASS portable edition preserves browser zoom');
  } finally {await browser.close();}
  console.log(`${passed} mobile checks passed (${engine}; simulated input and native bridge, no physical device).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
