/* LUMEN — original, procedurally performed score. No audio assets required.
 * Music uses a small eighth-note sequencer with a look-ahead clock. All sound
 * nodes are short-lived and disconnected when their envelopes finish.
 */
(function (global) {
  'use strict';

  const THEMES = {
    meadow: { root: 50, scale: [0, 2, 4, 7, 9], bpm: 100, color: 'wood', pad: 1400, air: .014, rhythm: .032, harmony: [0, 3, 4, 2], melody: [7,-1,6,4,5,-1,4,-1,2,4,5,-1,6,-1,4,-1,7,-1,9,7,6,-1,5,4,2,-1,4,5,4,-1,-1,-1] },
    cavern: { root: 45, scale: [0, 3, 5, 7, 10], bpm: 76, color: 'glass', pad: 670, air: .011, rhythm: .012, harmony: [0, 3, 2, 0], melody: [9,-1,-1,7,-1,-1,6,-1,4,-1,6,-1,7,-1,-1,-1,9,-1,11,-1,9,-1,-1,7,6,-1,-1,4,-1,-1,-1,-1] },
    tide: { root: 48, scale: [0, 2, 5, 7, 9], bpm: 88, color: 'water', pad: 1100, air: .024, rhythm: .02, harmony: [0, 2, 3, 1], melody: [5,-1,7,6,5,-1,4,-1,2,-1,4,5,7,-1,-1,6,5,-1,4,2,4,-1,5,-1,7,9,7,-1,5,-1,-1,-1] },
    sky: { root: 52, scale: [0, 2, 4, 7, 9], bpm: 118, color: 'wood', pad: 1900, air: .014, rhythm: .041, harmony: [0, 4, 3, 2], melody: [5,7,9,-1,7,-1,6,5,4,-1,5,6,7,-1,9,-1,10,-1,9,7,6,7,5,-1,4,-1,2,4,5,-1,-1,-1] },
    forge: { root: 43, scale: [0, 2, 3, 7, 10], bpm: 128, color: 'pluck', pad: 750, air: .004, rhythm: .047, harmony: [0, 0, 3, 2], melody: [4,-1,4,5,7,-1,5,4,2,-1,4,-1,5,-1,2,-1,4,-1,7,-1,9,7,5,-1,4,2,4,-1,2,-1,-1,-1] },
    frost: { root: 47, scale: [0, 2, 3, 7, 9], bpm: 72, color: 'glass', pad: 850, air: .01, rhythm: .012, harmony: [0, 3, 1, 2], melody: [9,-1,7,-1,6,-1,-1,4,5,-1,6,-1,7,-1,-1,-1,9,-1,11,9,7,-1,6,-1,5,-1,4,-1,6,-1,-1,-1] },
    secret: { root: 54, scale: [0, 2, 4, 7, 9], bpm: 114, color: 'glass', pad: 1800, air: .018, rhythm: .026, harmony: [0, 3, 4, 0], melody: [5,7,9,-1,10,-1,9,7,6,-1,7,9,7,-1,5,-1,4,5,7,-1,9,10,12,-1,10,-1,9,7,5,-1,-1,-1] },
    eclipse: { root: 41, scale: [0, 2, 3, 7, 10], bpm: 112, color: 'pluck', pad: 700, air: .006, rhythm: .05, harmony: [0, 2, 3, 0], melody: [4,-1,4,-1,5,4,2,-1,4,-1,7,-1,6,-1,5,-1,4,5,7,-1,9,-1,7,5,4,-1,2,-1,4,-1,-1,-1] }
  };

  const midi = note => 440 * Math.pow(2, (note - 69) / 12);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const MOTIF = [5, 7, 9, 6, 5];
  const SONG_SCORES = [
    { root: 50, scale: [0,2,4,7,9], bpm: 88, color: 'kalimba', harmony: [0,3,1,4],
      melody: [5,-1,7,9,-1,7,6,-1,4,-1,5,-1, 2,-1,4,5,-1,7,6,-1,4,-1,-1,-1,
        5,-1,7,9,-1,11,9,-1,7,6,-1,5, 4,-1,2,4,-1,6,5,-1,-1,-1,-1,-1] },
    { root: 55, scale: [0,2,4,7,9], bpm: 108, color: 'reed', harmony: [0,4,3,1],
      melody: [5,7,-1,9,-1,7,6,4,-1,5,-1,-1, 7,9,-1,11,-1,9,7,6,-1,4,-1,-1,
        5,-1,7,9,11,-1,12,-1,9,7,-1,6, 4,6,-1,7,-1,4,5,-1,-1,-1,-1,-1] },
    { root: 48, scale: [0,2,4,7,9], bpm: 76, color: 'glass', harmony: [0,1,3,0],
      melody: [5,-1,-1,7,-1,9,6,-1,-1,5,-1,-1, 4,-1,-1,2,-1,4,5,-1,7,-1,-1,-1,
        9,-1,11,9,-1,7,6,-1,-1,4,-1,-1, 2,-1,4,5,-1,7,5,-1,-1,-1,-1,-1] }
  ];

  class LumenAudio {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.muted = false;
      this.paused = false;
      this.theme = 'meadow';
      this._volume = .35;
      this._step = 0;
      this._next = 0;
      this._timer = null;
      this._voices = new Set();
      this._lastSfx = new Map();
      // Dynamic layers: tension answers nearby danger, boss phase drives the tempo.
      this._danger = 0;
      this._bossPhase = 0;
      this._mix = { music: .8, effects: .9, ambience: .6 };
      this._songIndex = -1; this._songLayer = 0; this._night = false;
      this._beds = []; this._world = { speed: 0, height: 0, water: 0, wind: 0, pan: 0 };
      this._worldClock = 0; this._footstep = 0; this._gliding = false; this._audioSeed = 0x6c756d65;
    }

    /** 0 = calm, 1 = something is actively hunting Lumen. Ramped by the engine. */
    setDanger(value) { this._danger = clamp(Number(value) || 0, 0, 1); }
    /** 0 = no boss, 1-3 = the Veilleur's remaining thirds. */
    setBossPhase(stage) { this._bossPhase = clamp(Math.floor(Number(stage) || 0), 0, 3); }
    setSongLayer(value) { this._songLayer = clamp(Number(value) || 0, 0, 1); }
    setNight(value) { this._night = !!value; }
    setScene(index = -1) {
      this._songIndex = Number.isInteger(index) && SONG_SCORES[index] ? index : -1;
      this._step = 0; this._songLayer = 0; this._footstep = 0; this._gliding = false;
      this._world = { speed: 0, height: 0, water: 0, wind: 0, pan: 0 };
      if (this.ctx) { this._releaseMusic(); this._next = this.ctx.currentTime + .08; this._updateBeds(); }
    }
    setMix(settings = {}) {
      for (const channel of ['music', 'effects', 'ambience']) {
        const value = settings[channel + 'Volume'];
        if (Number.isFinite(value)) this._mix[channel] = clamp(value, 0, 1);
      }
      this._applyMix();
    }
    get mix() { return { ...this._mix }; }
    _applyMix() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const ramp = (parameter, value, duration) => {
        if(parameter.cancelAndHoldAtTime)parameter.cancelAndHoldAtTime(now);
        else {parameter.cancelScheduledValues(now);parameter.setValueAtTime(parameter.value,now);}
        parameter.linearRampToValueAtTime(value,now+duration);
      };
      ramp(this.music.gain, this.paused ? 0 : .78 * this._mix.music, .1);
      ramp(this.effects.gain, this.paused ? 0 : this._mix.effects, .07);
      ramp(this.ambience.gain, this.paused ? 0 : this._mix.ambience, .12);
      ramp(this.preview.gain, this._mix.effects, .03);
      ramp(this._reverb.gain, this.paused ? 0 : .15, .1);
    }
    _score() { return SONG_SCORES[this._songIndex] || THEMES[this.theme]; }
    _random() {
      this._audioSeed = (Math.imul(this._audioSeed, 1664525) + 1013904223) >>> 0;
      return this._audioSeed / 4294967296;
    }
    songNote(index, pan = 0) {
      if (!this.ctx || !this.unlocked || this.muted || this.paused) return;
      const now = this.ctx.currentTime;
      if (now - (this._lastSongNote ?? -1) < .045) return;
      this._lastSongNote = now;
      const score = this._score();
      const degree = MOTIF[index % MOTIF.length] + 5 + Math.floor(index / 5) % 2 * 5;
      this._tone(midi(this._degree(degree, score)), now, .62, .13, 'kalimba', false, clamp(pan,-.8,.8));
      if (index > 0 && index % 10 === 0) this._tone(midi(this._degree(degree-5,score)),now+.06,.8,.07,'glass',false,-pan*.5);
    }
    rescue(voice, pan = 0, count = 1) {
      if (!this.ctx || !this.unlocked || this.muted || this.paused) return;
      const score = this._score(), now = this.ctx.currentTime;
      MOTIF.slice(0, 3).forEach((degree, index) => this._tone(midi(this._degree(degree+voice%3,score)),now+index*.14,.85,.12,'reed',false,pan));
      this._tone(midi(this._degree(voice%3,score)),now+.16,1.3,.065,'voice',false,-pan*.4,1400);
      if(count===3) this._tone(midi(this._degree(12,score)),now+.55,1.5,.08,'glass',false,0);
    }
    audition() {
      if (!this.ctx || !this.unlocked || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - (this._lastAudition ?? -10) < 1.8) return;
      this._lastAudition = now;
      const score = this._score();
      MOTIF.forEach((degree,index) => this._tone(midi(this._degree(degree,score)),now+index*.2,.8,.12,index%2?'reed':'kalimba','preview',(index-2)*.2));
      this._hush(now,.9,.025,1200,'preview',true,-.5);
    }

    get volume() { return this._volume; }
    set volume(value) {
      this._volume = clamp(Number(value) || 0, 0, 1);
      if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this._volume, this.ctx.currentTime, .035);
    }

    async prepare() {
      try {
        if (!this.ctx) this._init();
        if (this.ctx?.state === 'running') await this.ctx.suspend();
        return !!this.ctx;
      } catch (_) { return false; } // Audio is optional; the game still opens.
    }

    /** Call this directly from a click, keydown or pointerdown handler. */
    async unlock() {
      try {
        if (!this.ctx) this._init();
        if (!this.ctx) return false;
        if (['suspended','interrupted'].includes(this.ctx.state)) await this.ctx.resume();
        this.unlocked = this.ctx.state === 'running';
        if (this.unlocked) {
          this._next = Math.max(this._next, this.ctx.currentTime + .07);
          if (!this._timer) this._timer = global.setInterval(() => this._schedule(), 80);
          this._schedule();
        }
        return this.unlocked;
      } catch (_) { return false; }
    }

    _init(context) {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!context && !AudioContext) return;
      const ctx = this.ctx = context || new AudioContext();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this._volume;
      this.music = ctx.createGain();
      this.music.gain.value = this.paused ? 0 : .78 * this._mix.music;
      this.effects = ctx.createGain();
      this.effects.gain.value = this.paused ? 0 : this._mix.effects;
      this.ambience = ctx.createGain(); this.ambience.gain.value = this.paused ? 0 : this._mix.ambience;
      this.preview = ctx.createGain(); this.preview.gain.value = this._mix.effects;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 18;
      limiter.ratio.value = 5;
      limiter.attack.value = .008;
      limiter.release.value = .22;
      this.music.connect(limiter);
      this.effects.connect(limiter);
      this.ambience.connect(limiter); this.preview.connect(limiter);
      limiter.connect(this.master);
      this.master.connect(ctx.destination);

      // A handmade, soft diffusion tail gives the tiny ensemble its own space.
      const frames = Math.floor(ctx.sampleRate * 1.55);
      const impulse = ctx.createBuffer(2, frames, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < frames; i++) {
          const t = i / frames;
          data[i] = (this._random() * 2 - 1) * Math.pow(1 - t, 3.8) * .42;
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;
      const wet = this._reverb = ctx.createGain();
      wet.gain.value = this.paused ? 0 : .15;
      this.music.connect(convolver);
      this.effects.connect(convolver);
      convolver.connect(wet);
      wet.connect(limiter);

      this._noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this._noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = .83 * previous + .17 * (this._random() * 2 - 1);
        data[i] = previous * 2;
      }
      this._next = ctx.currentTime + .08;
      for (const [kind, frequency, pan] of [['wind', 950, -.25], ['water', 430, .45], ['leaves', 2900, -.6]]) {
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        source.buffer = this._noise; source.loop = true;
        filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = kind === 'water' ? .35 : .8;
        gain.gain.value = 0; if(panner.pan)panner.pan.value=pan;
        source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(this.ambience);
        source.start(); this._beds.push({kind,source,filter,gain,panner});
      }
    }

    setMuted(muted) {
      this.muted = !!muted;
      if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this._volume, this.ctx.currentTime, .04);
      return this.muted;
    }
    toggle() { return this.setMuted(!this.muted); }

    setTheme(theme) {
      const next = Object.prototype.hasOwnProperty.call(THEMES, theme) ? theme : 'meadow';
      if (next === this.theme) return;
      this.theme = next;
      this._step = 0;
      if (!this.ctx) return;
      this._releaseMusic();
      this._next = this.ctx.currentTime + .15;
    }

    pause() {
      this.paused = true;
      this._applyMix();
      if (this.ctx) for (const voice of this._voices) {
        if (voice.bus === 'preview') continue;
        try { voice.sources.forEach(source => source.stop(this.ctx.currentTime + .16)); } catch (_) {}
      }
    }
    resume() {
      if (!this.paused) return;
      this.paused = false;
      if (!this.ctx) return;
      this._next = this.ctx.currentTime + .07;
      this._applyMix();
      this._schedule();
    }

    // Scheduling also works when the game owns the clock. The look-ahead guard
    // prevents duplicate notes when both update() and the timer are in use.
    update() { this._schedule(); }
    updateWorld(game, dt) {
      if (game.mode !== 'playing') return;
      const player = game.player, song = game.song;
      const wind = (game.level.song?.wind || []).some(current => player.x+player.w>current.x && player.x<current.x+current.w && player.y+player.h>current.y && player.y<current.y+current.h);
      const waterfalls = song && song.count >= 2 ? game.platforms.filter(platform=>platform.type==='ground'&&platform.x>1000).map(platform=>platform.x+platform.w-70) : [];
      const nearest = waterfalls.sort((first,second)=>Math.abs(first-player.x)-Math.abs(second-player.x))[0];
      this._world = { speed: clamp(Math.abs(player.vx)/490,0,1), height: clamp((560-player.y)/450,0,1),
        water: Number.isFinite(nearest)?clamp(1-Math.abs(nearest-player.x)/550,0,1):player.wet?.7:game.level.theme==='tide'?.25:0,
        wind: wind?1:0, pan: Number.isFinite(nearest)?clamp((nearest-player.x)/500,-.8,.8):.3 };
      if (song && player.gliding && !this._gliding) this.sfx('wings');
      this._gliding=!!player.gliding;
      if(song && player.grounded && !player.wet && Math.abs(player.vx)>110) {
        this._footstep+=Math.abs(player.vx)*dt;
        if(this._footstep>88){this._footstep%=88;this.sfx('footstep');}
      } else this._footstep=0;
      this._worldClock+=dt;
      if(this._worldClock>=.08){this._worldClock=0;this._updateBeds();}
    }
    _updateBeds() {
      if (!this.ctx) return;
      const world=this._world, now=this.ctx.currentTime, active=this._songIndex>=0;
      for(const bed of this._beds) {
        const gain=bed.kind==='wind' ? (active?.016:.008)+world.speed*.012+world.wind*.055+(this._gliding?.028:0)
          :bed.kind==='water'?world.water*.095:active?(this._night?.009:.016)*(1-world.height*.8):.002;
        bed.gain.gain.setTargetAtTime(gain,now,.18);
        if(bed.kind==='wind')bed.filter.frequency.setTargetAtTime(620+world.height*700+world.speed*450,now,.15);
        if(bed.kind==='water'&&bed.panner.pan)bed.panner.pan.setTargetAtTime(world.pan,now,.15);
      }
    }

    _releaseMusic() {
      const now = this.ctx.currentTime;
      for (const voice of this._voices) {
        if (!voice.music) continue;
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setTargetAtTime(.0001, now, .07);
          voice.sources.forEach(source => source.stop(now + .3));
        } catch (_) { /* Already stopped voices clean themselves up. */ }
      }
    }

    _degree(degree, theme) {
      const octave = Math.floor(degree / theme.scale.length);
      const index = ((degree % theme.scale.length) + theme.scale.length) % theme.scale.length;
      return theme.root + octave * 12 + theme.scale[index];
    }

    _schedule() {
      if (!this.unlocked || !this.ctx || this.paused || this.muted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const theme = this._score();
      // The final fight tightens the pulse a little with every third of life removed.
      const eighth = 30 / (theme.bpm * (1 + this._bossPhase * .055));
      if (this._next < now - .2) this._next = now + .04;
      let count = 0;
      while (this._next < now + .22 && count++ < 8) {
        if(this._songIndex>=0)this._playSongStep(this._step++,this._next,eighth,theme);
        else this._playStep(this._step++, this._next, eighth, theme);
        this._next += eighth;
      }
    }

    _playSongStep(step, at, eighth, score) {
      const beat=step%12, bar=Math.floor(step/12), harmony=score.harmony[Math.floor(bar/2)%score.harmony.length];
      const melody=score.melody[step%score.melody.length];
      if(melody>=0)this._tone(midi(this._degree(melody,score)),at,eighth*(this._night?3.8:2.1),.083,
        this._night?'reed':score.color,true,Math.sin(bar*.8)*.3);
      if(beat===0||beat===6)this._tone(midi(this._degree(harmony-5+(beat===6?3:0),score)),at,eighth*5.4,.095,'nylon',true,0);
      if(beat%3===0)this._tone(midi(this._degree(harmony+2+beat/3,score)),at+.012,eighth*2.2,.041,'kalimba',true,(beat/12-.5)*.9);
      if(beat===0) for(const [index,degree] of [0,2,4].entries())this._tone(midi(this._degree(harmony+degree,score)),at+index*.021,eighth*11.5,.023,'voice',true,(index-1)*.5,this._night?850:1350);
      if(beat===0||beat===6)this._tone(96,at,.2,this._night?.018:.03,'kick',true);
      if(beat===4||beat===10)this._hush(at,.065,this._night?.012:.022,1450,true,false,(beat-7)/7);
      if(this._songLayer>.08&&beat%3===2)this._tone(midi(this._degree(harmony+8+beat%5,score)),at,eighth*3,.052*this._songLayer,'glass',true,beat%2?.55:-.55);
      if(this._songLayer>.6&&beat===9)this._tone(midi(this._degree(harmony+5,score)),at,eighth*7,.04*this._songLayer,'voice',true,-.3,1700);
      if(step%48===35){
        const degree=this._night?3:10;
        this._tone(midi(this._degree(degree,score)),at,1.65,.055,this._night?'voice':'reed','ambience',.65,950,midi(this._degree(degree+2,score)));
        this._tone(midi(this._degree(degree+2,score)),at+.55,1.2,.035,'reed','ambience',-.5);
      }
    }

    _playStep(step, at, eighth, theme) {
      const bar = Math.floor(step / 8);
      const beat = step % 8;
      const harmonic = theme.harmony[Math.floor(bar / 2) % theme.harmony.length];
      const degree = theme.melody[step % theme.melody.length];
      const phrase = Math.floor(step / 32) % 4;

      if (this._songLayer > .05 && beat % 2 === 0) {
        this._tone(midi(this._degree(harmonic + 10 + beat, theme)), at, eighth * 3,
          .045 * this._songLayer, 'air', true, beat / 8 - .5);
      }

      if (degree >= 0) {
        const pitch = this._degree(degree + (phrase === 3 && beat === 6 ? 1 : 0), theme);
        this._tone(midi(pitch), at, eighth * (theme.color === 'glass' ? 3.5 : 1.65), .105, theme.color, true, Math.sin(step * .7) * .28);
      }
      // A sparse answering voice only enters in the second half of a phrase.
      if (step % 32 >= 16 && beat === 7 && this.theme !== 'forge') {
        this._tone(midi(this._degree(harmonic + 10, theme)), at, eighth * 2.6, .034, 'air', true, .5);
      }
      if (beat === 0 || beat === 4) {
        const bassDegree = harmonic + (beat === 4 ? 3 : 0) - 5;
        this._tone(midi(this._degree(bassDegree, theme)), at, eighth * 3.6, .15, 'bass', true, 0);
      }
      if (step % 16 === 0) {
        [0, 2, 4].forEach((offset, index) => {
          this._tone(midi(this._degree(harmonic + offset, theme)), at + index * .023, eighth * 15.8, .035, 'pad', true, (index - 1) * .5, theme.pad);
        });
      }
      if (beat === 0 || beat === 4) {
        this._tone(85, at, .19, theme.rhythm * 1.35, 'kick', true);
      }
      if (beat === 2 || beat === 6) this._hush(at, .12, theme.rhythm, 1650, true);
      if (beat % 2 === 1) this._hush(at, .045, theme.rhythm * .35, 3800, true);
      if (theme.air && step % 16 === 8) this._hush(at, eighth * 6, theme.air, this.theme === 'tide' ? 550 : 1200, true, true);
      this._tensionLayer(step, beat, harmonic, at, eighth, theme);
    }

    /** An extra layer that grows with danger instead of switching to another track.
     *  It borrows the current theme's own scale, so nothing ever clashes. */
    _tensionLayer(step, beat, harmonic, at, eighth, theme) {
      const tension = this._danger;
      if (tension > .1) {
        // A low heartbeat under the melody: the first thing a player notices.
        if (beat % 2 === 0) this._tone(midi(this._degree(harmonic - 9, theme)), at, eighth * 1.85, .052 * tension, 'bass', true, 0);
        // Then an uneasy breath between the beats.
        if (tension > .45 && beat % 4 === 2) this._hush(at, eighth * 1.3, .024 * tension, 2500, true);
        // Finally a high, nervous shimmer when the threat is right behind Lumen.
        if (tension > .7 && step % 8 === 5) this._tone(midi(this._degree(harmonic + 7, theme) + 12), at, eighth * .95, .032 * tension, 'glass', true, .38);
      }
      if (this._bossPhase >= 2 && beat % 2 === 1) this._tone(85, at, .11, theme.rhythm * (this._bossPhase >= 3 ? 1.25 : .85), 'kick', true);
      if (this._bossPhase >= 3 && beat === 3) this._tone(midi(this._degree(harmonic - 12, theme)), at, eighth * 3, .06, 'pad', true, 0, 520);
    }

    _track(sources, nodes, gain, music, end) {
      const voice = { sources, nodes, gain, music: music===true, bus: music===true?'music':typeof music==='string'?music:'effects', end };
      this._voices.add(voice);
      sources[0].onended = () => {
        this._voices.delete(voice);
        for (const node of nodes) { try { node.disconnect(); } catch (_) {} }
      };
    }

    _tone(freq, at, duration, volume, color = 'wood', music = false, pan = 0, cutoff = 1400, target = null) {
      if (!this.ctx || !this.unlocked || this._voices.size>=90) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(color === 'bass' ? 360 : color === 'pad'||color==='voice' ? cutoff : color==='reed'?2500:color==='nylon'?2200:5800, at);
      filter.Q.value = .45;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (panner.pan) panner.pan.value = pan;
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(music===true?this.music:music==='ambience'?this.ambience:music==='preview'?this.preview:this.effects);
      const peak = Math.max(.0001, volume);
      const attack = color === 'pad'||color==='voice' ? .45 : color === 'air'||color==='reed' ? .07 : .007;
      const end = at + Math.max(duration, attack + .04);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + attack);
      if (color === 'pad'||color==='voice') {
        gain.gain.setValueAtTime(peak * .7, Math.max(at + attack, end - .7));
        gain.gain.exponentialRampToValueAtTime(.0001, end);
      } else gain.gain.exponentialRampToValueAtTime(.0001, end);

      const sources = [];
      const nodes = [filter, gain, panner];
      const partials = color === 'kalimba' ? [[1,.9,'sine'],[2.76,.07,'sine'],[5.4,.015,'sine']]
        : color === 'reed' ? [[1,.83,'sine'],[2,.12,'triangle'],[3,.035,'sine']]
        : color === 'voice' ? [[.999,.5,'sine'],[1.001,.5,'triangle'],[3,.028,'sine']]
        : color === 'nylon' ? [[1,.8,'triangle'],[2,.12,'sine'],[4,.015,'sine']]
        : color === 'glass' ? [[1, 1, 'sine'], [2.001, .15, 'sine'], [3, .028, 'sine']]
        : color === 'water' ? [[1, 1, 'sine'], [2, .11, 'triangle']]
        : color === 'pad' ? [[.9985, .55, 'triangle'], [1.0015, .55, 'sine']]
        : color === 'pluck' ? [[1, .8, 'triangle'], [2, .08, 'sine']]
        : color === 'wood' ? [[1, .9, 'sine'], [2, .16, 'sine'], [3, .035, 'sine']]
        : [[1, 1, 'sine']];
      partials.forEach(([ratio, amount, type]) => {
        const osc = ctx.createOscillator();
        const partialGain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq * ratio), at);
        if (color === 'kick') osc.frequency.exponentialRampToValueAtTime(38, at + .12);
        else if (target) osc.frequency.exponentialRampToValueAtTime(Math.max(20, target * ratio), end);
        partialGain.gain.value = amount;
        osc.connect(partialGain);
        partialGain.connect(filter);
        sources.push(osc);
        nodes.push(osc, partialGain);
        if ((color==='reed'||color==='voice')&&ratio<1.01&&osc.detune) {
          const vibrato=ctx.createOscillator(), depth=ctx.createGain();
          vibrato.frequency.value=color==='reed'?4.7:3.2;depth.gain.value=color==='reed'?5:3;
          vibrato.connect(depth);depth.connect(osc.detune);vibrato.start(at);vibrato.stop(end+.03);
          sources.push(vibrato);nodes.push(vibrato,depth);
        }
        osc.start(at);
        osc.stop(end + .03);
      });
      this._track(sources, nodes, gain, music, end);
    }

    _hush(at, duration, volume, frequency = 1600, music = false, swell = false, pan = 0) {
      if (!this.ctx || !this.unlocked || this._voices.size>=90) return;
      const ctx = this.ctx;
      const source = ctx.createBufferSource();
      source.buffer = this._noise;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = .65;
      const gain = ctx.createGain();
      const end = at + duration;
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume), at + (swell ? duration * .4 : .005));
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      source.connect(filter);
      filter.connect(gain);
      const panner=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();
      if(panner.pan)panner.pan.value=pan;
      gain.connect(panner);
      panner.connect(music===true?this.music:music==='ambience'?this.ambience:music==='preview'?this.preview:this.effects);
      source.start(at);
      source.stop(end + .03);
      this._track([source], [source, filter, gain, panner], gain, music, end);
    }

    /** Names intentionally describe game events, keeping entity code simple. */
    sfx(name) {
      if (!this.unlocked || !this.ctx || this.ctx.state !== 'running' || this.muted || (this.paused&&name!=='menu')) return;
      const at = this.ctx.currentTime + .004;
      const cooldown = name === 'coin' ? .025 : name === 'land'||name==='menu' ? .08 : name === 'conveyor'||name==='wings' ? .3 : name==='footstep'?.12:.035;
      if (at - (this._lastSfx.get(name) || -100) < cooldown) return;
      this._lastSfx.set(name, at);
      const score=this._score();
      if(name==='menu'){this._tone(midi(this._degree(9,score)),at,.13,.042,'kalimba','preview');return;}
      if(name==='footstep'){this._hush(at,.075,.032,680+this._random()*220,false,false,(this._random()-.5)*.3);this._tone(115+this._random()*35,at,.07,.022,'nylon');return;}
      if(name==='wings'){this._hush(at,.42,.06,1600,false,true,-.3);this._hush(at+.06,.34,.042,2200,false,true,.35);return;}
      if(this._songIndex>=0&&['jump','doubleJump','resonance','victory'].includes(name)){
        const degree=name==='jump'?2:name==='doubleJump'?5:0;
        if(name==='victory'){
          MOTIF.concat([9,10]).forEach((pitch,index)=>this._tone(midi(this._degree(pitch,score)),at+index*.18,.85,.14,'kalimba'));
          [0,2,4,7].forEach((pitch,index)=>this._tone(midi(this._degree(pitch,score)),at+.8+index*.03,2.4,.055,'voice',false,(index-1.5)*.2));
        } else {
          this._tone(midi(this._degree(degree,score)),at,name==='resonance'?.68:.24,.1,'reed',false,0,1400,midi(this._degree(degree+2,score)));
          this._hush(at,name==='resonance'?.48:.18,name==='resonance'?.035:.04,1300,false,true);
          if(name==='resonance')this._tone(midi(this._degree(5,score)),at+.11,.9,.062,'glass',false,.22);
          if(name==='doubleJump')this._tone(midi(this._degree(10,score)),at+.05,.5,.065,'kalimba',false,-.2);
        }
        return;
      }
      const tone = (frequency, offset, duration, gain, color = 'wood', end = null) =>
        this._tone(frequency, at + offset, duration, gain, color, false, 0, 1500, end);
      const notes = (pitches, spacing, length = .3, gain = .19, color = 'glass') =>
        pitches.forEach((pitch, index) => tone(midi(pitch), index * spacing, length, gain, color));
      switch (name) {
        case 'jump': tone(280, 0, .17, .19, 'water', 620); break;
        case 'doubleJump': tone(460, 0, .2, .17, 'glass', 1000); this._hush(at, .16, .09, 2500); break;
        case 'land': tone(110, 0, .09, .12, 'bass'); this._hush(at, .075, .08, 420); break;
        case 'coin': notes([86, 93], .055, .25, .15); break;
        case 'star': notes([74, 81, 86, 90, 93], .072, .5, .18); break;
        case 'power': notes([62, 69, 74, 78, 81, 86], .065, .38, .19); this._hush(at, .4, .1, 1100, false, true); break;
        case 'hit': tone(190, 0, .23, .25, 'pluck', 75); this._hush(at, .18, .19, 650); break;
        case 'death': notes([69, 65, 62, 57, 50], .12, .4, .19, 'water'); break;
        case 'checkpoint': notes([62, 66, 69, 74], .095, .48, .18); tone(midi(50), .1, .7, .13, 'pad'); break;
        case 'shoot': tone(690, 0, .13, .12, 'water', 290); this._hush(at, .07, .055, 2100); break;
        case 'dash': this._hush(at, .24, .15, 1700); tone(220, 0, .16, .1, 'water', 700); break;
        case 'stomp': tone(160, 0, .12, .19, 'water', 420); this._hush(at, .065, .1, 500); break;
        case 'spring': tone(190, 0, .26, .22, 'water', 1120); tone(540, .1, .22, .08, 'glass', 1500); break;
        case 'break': this._hush(at, .22, .21, 930); tone(130, 0, .15, .14, 'pluck', 60); break;
        case 'secret': notes([74, 78, 81, 86, 90, 93, 98], .085, .6, .17); break;
        case 'victory':
          notes([62, 66, 69, 74, 69, 74, 78, 81], .13, .5, .2);
          [50, 57, 62, 66].forEach((pitch, index) => tone(midi(pitch), .77 + index * .018, 1.3, .11, 'pad'));
          break;
        case 'bossHit': tone(135, 0, .28, .29, 'pluck', 55); notes([69, 74], .07, .2, .13); this._hush(at, .2, .22, 780); break;
        case 'bossAttack': tone(95, 0, .45, .24, 'bass', 180); this._hush(at, .45, .18, 900, false, true); break;
        // A third of the Veilleur's light gone: a struck bell over a falling drone.
        case 'bossStage': notes([86, 81, 74], .09, .7, .2); tone(70, 0, .9, .26, 'bass', 40); this._hush(at, .7, .24, 700, false, true); break;
        // The arena closing in: a slow rising sweep with no melodic pitch of its own.
        case 'arena': this._hush(at, .95, .17, 380, false, true); tone(110, 0, .95, .11, 'pad', 300); break;
        // Each special platform answers differently, by ear alone:
        // a dry creak when a crumbling note gives way under Lumen's weight,
        case 'crumble': tone(240, 0, .14, .13, 'pluck', 150); this._hush(at, .13, .12, 1350); break;
        // a soft mechanical tick while a conveyor carries him,
        case 'conveyor': tone(430, 0, .06, .055, 'pluck', 360); this._hush(at, .05, .04, 2700); break;
        // (spring and break keep their own established voices above).
        // The bell reveals: a bright strike whose harmonics stay in the air.
        case 'echo': notes([78, 85, 90], .055, 1.1, .16); tone(midi(66), .02, 1.5, .09, 'pad'); this._hush(at, .9, .07, 2200, false, true); break;
        // Two quiet taps five seconds before any power fades. Never alarming.
        case 'powerWarning': notes([81, 76], .13, .2, .085); break;
        // The mound stirs: a low swell that clearly comes from the ground.
        case 'sleeperWake': tone(64, 0, .55, .22, 'bass', 120); this._hush(at, .5, .2, 460, false, true); tone(190, .12, .3, .1, 'pluck', 330); break;
        // The swarm bursts apart: a flutter, then motes scattering upwards.
        case 'swarm': this._hush(at, .26, .16, 3100); notes([81, 88, 93, 97], .038, .3, .11); break;
        // La voix de Lumen : une note ronde qui s'ouvre, suivie de son souffle.
        // Elle doit rester douce — on l'entendra des milliers de fois.
        case 'resonance': tone(196, 0, .5, .13, 'water', 340); tone(midi(74), .03, .55, .07, 'glass'); this._hush(at, .32, .045, 1700, false, true); break;
        // Le relais d'un carillon : la même idée, plus haute et plus courte, pour
        // qu'on entende que l'onde est repartie d'ailleurs.
        case 'resonanceRelay': notes([81, 88], .05, .5, .09); this._hush(at, .2, .03, 2600, false, true); break;
        case 'wakeBloom': notes([69, 76, 81], .05, .42, .13, 'wood'); this._hush(at, .25, .05, 1200, false, true); break;
        case 'wakeBridge': notes([62, 69, 73], .06, .8, .12); tone(midi(50), .04, .9, .07, 'pad'); break;
        case 'wakeChime': notes([86, 90, 93, 97], .045, .65, .11); break;
        case 'wakeCalm': tone(110, 0, .6, .14, 'bass', 165); notes([64, 71], .1, .5, .08, 'wood'); break;
        // L'extinction : une note qui retombe, assez nette pour qu'on la remarque
        // sans qu'elle ressemble à une punition.
        case 'wakeEnd': notes([74, 67], .09, .3, .075, 'water'); break;
        // A gold medal deserves more than the usual chapter fanfare.
        case 'medal': notes([74, 78, 81, 86, 90, 93], .085, .75, .19); [62, 69, 74].forEach((p, i) => tone(midi(p), .5 + i * .02, 1.6, .1, 'pad')); break;
        default:
          // Every power fades with its own colour, so the ear knows what was lost.
          if (name.startsWith('expire_')) {
            const figures = { bloom: [81, 74], breeze: [86, 79], comet: [78, 71], echo: [83, 76] };
            notes(figures[name.slice(7)] || [79, 72], .11, .34, .11, 'water');
            this._hush(at, .3, .05, 1500, false, true);
          }
          break;
      }
    }

    /** Optional teardown for embedding the game in a page with navigation. */
    destroy() {
      if (this._timer) global.clearInterval(this._timer);
      this._timer = null;
      this.unlocked = false;
      for(const voice of this._voices){for(const source of voice.sources){try{source.stop();}catch(_){}}for(const node of voice.nodes){try{node.disconnect();}catch(_){}}}
      this._voices.clear();
      for(const bed of this._beds){try{bed.source.stop();}catch(_){}for(const node of [bed.source,bed.filter,bed.gain,bed.panner]){try{node.disconnect();}catch(_){}}}
      this._beds=[];
      this._lastSfx.clear();this._lastAudition=undefined;this._lastSongNote=undefined;
      if (this.ctx) {
        try { this.ctx.close(); } catch (_) {}
      }
      this.ctx = null;
    }
  }

  LumenAudio.THEMES = Object.keys(THEMES);
  LumenAudio.SONG_SCORES = SONG_SCORES;
  global.LumenAudio = LumenAudio;
})(window);
