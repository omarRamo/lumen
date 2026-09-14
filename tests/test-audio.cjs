'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={setInterval,clearInterval};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8'),{window});
let passed=0;
function test(name,check){check();passed++;console.log('PASS  '+name);}
function recorder(){
  const audio=new window.LumenAudio(), events=[];
  audio.ctx={currentTime:1,state:'running'};audio.unlocked=true;
  audio._tone=(...args)=>events.push({kind:'tone',args});audio._hush=(...args)=>events.push({kind:'noise',args});
  return {audio,events};
}
test('Three original scores are distinct, finite and share a playable pentatonic vocabulary',()=>{
  const scores=window.LumenAudio.SONG_SCORES;
  assert.equal(scores.length,3);
  assert.equal(new Set(scores.map(score=>JSON.stringify(score.melody))).size,3);
  for(const score of scores){assert.equal(score.melody.length,48);assert.equal(score.scale.length,5);assert.ok(score.bpm>=70&&score.bpm<=120);}
});
test('A full phrase uses pitched instruments, percussion and the ambient answering voice',()=>{
  const {audio,events}=recorder();
  for(let index=0;index<3;index++){
    audio.setScene(index);audio.setSongLayer(.85);
    const score=window.LumenAudio.SONG_SCORES[index];
    for(let step=0;step<48;step++)audio._playSongStep(step,1+step*.3,.3,score);
  }
  assert.ok(events.some(event=>event.kind==='noise'));
  for(const color of ['nylon','kalimba','reed','voice','glass'])assert.ok(events.some(event=>event.kind==='tone'&&event.args[4]===color),color);
  assert.ok(events.some(event=>event.kind==='tone'&&event.args[5]==='ambience'));
  assert.ok(events.every(event=>event.args.filter(value=>typeof value==='number').every(Number.isFinite)));
});
test('Night changes orchestration but keeps the musical clock and progression intact',()=>{
  const {audio,events}=recorder();audio.setScene(0);
  const score=window.LumenAudio.SONG_SCORES[0];
  audio._playSongStep(0,1,.3,score);const day=events[0];events.length=0;
  audio._step=14;audio.setNight(true);audio._playSongStep(0,1,.3,score);
  assert.equal(audio._step,14);assert.equal(day.args[0],events[0].args[0]);
  assert.equal(day.args[4],'kalimba');assert.equal(events[0].args[4],'reed');
});
test('Sound events use distinct gestures and respect mute, pause and repeat limits',()=>{
  const {audio,events}=recorder();audio.setScene(0);
  for(const name of ['jump','doubleJump','resonance','wings','footstep','victory'])audio.sfx(name);
  assert.ok(events.length>15);
  const total=events.length;audio.sfx('wings');assert.equal(events.length,total);
  audio.paused=true;audio.sfx('jump');audio.songNote(3);audio.rescue(1);assert.equal(events.length,total);
  audio.muted=true;audio.audition();audio.sfx('menu');assert.equal(events.length,total);
  audio.muted=false;audio.audition();assert.ok(events.length>total);
  assert.ok(events.slice(total).every(event=>event.args[event.kind==='tone'?5:4]==='preview'));
});
test('Mixer values clamp safely without needing browser audio, and scene transitions clear flight',()=>{
  const audio=new window.LumenAudio();audio.setMix({musicVolume:0,effectsVolume:5,ambienceVolume:-1});
  assert.deepEqual(JSON.parse(JSON.stringify(audio.mix)),{music:0,effects:1,ambience:0});
  audio.setMix({musicVolume:NaN});assert.equal(audio.mix.music,0);
  audio._gliding=true;audio.setScene(2);assert.equal(audio._gliding,false);
  audio.setScene(-1);assert.equal(audio._songIndex,-1);assert.equal(audio._songLayer,0);
});
console.log('\n'+passed+' audio composition checks passed.');