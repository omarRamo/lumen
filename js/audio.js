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
    }

    /** 0 = calm, 1 = something is actively hunting Nilo. Ramped by the engine. */
    setDanger(value) { this._danger = clamp(Number(value) || 0, 0, 1); }
    /** 0 = no boss, 1-3 = the Veilleur's remaining thirds. */
    setBossPhase(stage) { this._bossPhase = clamp(Math.floor(Number(stage) || 0), 0, 3); }
    setSongLayer(value) { this._songLayer = clamp(Number(value) || 0, 0, 1); }
    songNote(index) {
      if (!this.ctx || !this.unlocked || this.muted || this.paused) return;
      const now = this.ctx.currentTime;
      if (now - (this._lastSongNote ?? -1) < .045) return;
      this._lastSongNote = now;
      const theme = THEMES[this.theme];
      this._tone(midi(this._degree(8 + index % 10, theme)), now, .55, .15, 'glass', false, 0);
    }

    get volume() { return this._volume; }
    set volume(value) {
      this._volume = clamp(Number(value) || 0, 0, 1);
      if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this._volume, this.ctx.currentTime, .035);
    }

    /** Call this directly from a click, keydown or pointerdown handler. */
    async unlock() {
      try {
        if (!this.ctx) this._init();
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.unlocked = this.ctx.state === 'running';
        if (this.unlocked) {
          this._next = Math.max(this._next, this.ctx.currentTime + .07);
          if (!this._timer) this._timer = global.setInterval(() => this._schedule(), 80);
          this._schedule();
        }
        return this.unlocked;
      } catch (_) { return false; }
    }

    _init() {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this._volume;
      this.music = ctx.createGain();
      this.music.gain.value = this.paused ? 0 : .78;
      this.effects = ctx.createGain();
      this.effects.gain.value = 1;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 18;
      limiter.ratio.value = 5;
      limiter.attack.value = .008;
      limiter.release.value = .22;
      this.music.connect(limiter);
      this.effects.connect(limiter);
      limiter.connect(this.master);
      this.master.connect(ctx.destination);

      // A handmade, soft diffusion tail gives the tiny ensemble its own space.
      const frames = Math.floor(ctx.sampleRate * 1.55);
      const impulse = ctx.createBuffer(2, frames, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < frames; i++) {
          const t = i / frames;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.8) * .42;
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = .17;
      this.music.connect(convolver);
      convolver.connect(wet);
      wet.connect(limiter);

      this._noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this._noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = .83 * previous + .17 * (Math.random() * 2 - 1);
        data[i] = previous * 2;
      }
      this._next = ctx.currentTime + .08;
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
      if (this.ctx) this.music.gain.setTargetAtTime(0, this.ctx.currentTime, .08);
    }
    resume() {
      if (!this.paused) return;
      this.paused = false;
      if (!this.ctx) return;
      this._next = this.ctx.currentTime + .07;
      this.music.gain.setTargetAtTime(.78, this.ctx.currentTime, .12);
      this._schedule();
    }

    // Scheduling also works when the game owns the clock. The look-ahead guard
    // prevents duplicate notes when both update() and the timer are in use.
    update() { this._schedule(); }

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
      if (!this.unlocked || !this.ctx || this.paused || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const theme = THEMES[this.theme];
      // The final fight tightens the pulse a little with every third of life removed.
      const eighth = 30 / (theme.bpm * (1 + this._bossPhase * .055));
      if (this._next < now - .2) this._next = now + .04;
      let count = 0;
      while (this._next < now + .22 && count++ < 8) {
        this._playStep(this._step++, this._next, eighth, theme);
        this._next += eighth;
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
        // Finally a high, nervous shimmer when the threat is right behind Nilo.
        if (tension > .7 && step % 8 === 5) this._tone(midi(this._degree(harmonic + 7, theme) + 12), at, eighth * .95, .032 * tension, 'glass', true, .38);
      }
      if (this._bossPhase >= 2 && beat % 2 === 1) this._tone(85, at, .11, theme.rhythm * (this._bossPhase >= 3 ? 1.25 : .85), 'kick', true);
      if (this._bossPhase >= 3 && beat === 3) this._tone(midi(this._degree(harmonic - 12, theme)), at, eighth * 3, .06, 'pad', true, 0, 520);
    }

    _track(sources, nodes, gain, music, end) {
      const voice = { sources, nodes, gain, music, end };
      this._voices.add(voice);
      sources[0].onended = () => {
        this._voices.delete(voice);
        for (const node of nodes) { try { node.disconnect(); } catch (_) {} }
      };
      // Keep pathological bursts (e.g. hundreds of collectibles) bounded.
      if (this._voices.size > 90) {
        const oldest = this._voices.values().next().value;
        try { oldest.sources.forEach(source => source.stop(this.ctx.currentTime + .02)); } catch (_) {}
      }
    }

    _tone(freq, at, duration, volume, color = 'wood', music = false, pan = 0, cutoff = 1400, target = null) {
      if (!this.ctx || !this.unlocked) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(color === 'bass' ? 360 : color === 'pad' ? cutoff : 5800, at);
      filter.Q.value = .45;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (panner.pan) panner.pan.value = pan;
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(music ? this.music : this.effects);
      const peak = Math.max(.0001, volume);
      const attack = color === 'pad' ? .45 : color === 'air' ? .07 : .007;
      const end = at + Math.max(duration, attack + .04);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + attack);
      if (color === 'pad') {
        gain.gain.setValueAtTime(peak * .7, Math.max(at + attack, end - .7));
        gain.gain.exponentialRampToValueAtTime(.0001, end);
      } else gain.gain.exponentialRampToValueAtTime(.0001, end);

      const sources = [];
      const nodes = [filter, gain, panner];
      const partials = color === 'glass' ? [[1, 1, 'sine'], [2.001, .15, 'sine'], [3, .028, 'sine']]
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
        osc.start(at);
        osc.stop(end + .03);
      });
      this._track(sources, nodes, gain, music, end);
    }

    _hush(at, duration, volume, frequency = 1600, music = false, swell = false) {
      if (!this.ctx || !this.unlocked) return;
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
      gain.connect(music ? this.music : this.effects);
      source.start(at);
      source.stop(end + .03);
      this._track([source], [source, filter, gain], gain, music, end);
    }

    /** Names intentionally describe game events, keeping entity code simple. */
    sfx(name) {
      if (!this.unlocked || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const at = this.ctx.currentTime + .004;
      const cooldown = name === 'coin' ? .025 : name === 'land' ? .08 : name === 'conveyor' ? .3 : .035;
      if (at - (this._lastSfx.get(name) || -100) < cooldown) return;
      this._lastSfx.set(name, at);
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
        // a dry creak when a crumbling note gives way under Nilo's weight,
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
        // La voix de Nilo : une note ronde qui s'ouvre, suivie de son souffle.
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
      this._voices.clear();
      if (this.ctx) {
        try { this.ctx.close(); } catch (_) {}
      }
      this.ctx = null;
    }
  }

  LumenAudio.THEMES = Object.keys(THEMES);
  global.LumenAudio = LumenAudio;
})(window);
