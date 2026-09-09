// Streams official B/W tracks from archive.org with crossfades. Falls back to a
// tiny WebAudio chiptune loop when a stream fails. Nothing plays until unlock().
import { AUDIO_BASE, TRACKS } from './data.js';

const url = name => AUDIO_BASE + name.split('/').map(encodeURIComponent).join('/');

class Layer {
  constructor() {
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = 0;
    this.name = null;
    this.target = 0;
    this.failed = false;
    this.el.addEventListener('error', () => { this.failed = true; });
  }
}

export class Music {
  constructor() {
    this.unlocked = false;
    this.enabled = false;
    this.layers = [new Layer(), new Layer()];
    this.active = 0;
    this.master = 0.55;
    this.current = null;
    this.stinger = new Audio(url(TRACKS.badge));
    this.stinger.volume = 0.7;
    this.synth = null;
    this._raf = null;
    this._lastT = performance.now();
    this._loop = this._loop.bind(this);
    this._loop();
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const l of this.layers) { l.el.play().then(() => l.el.pause()).catch(() => {}); }
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) {
      this.unlock();
      if (this.current) this.play(this.current, true);
    } else {
      for (const l of this.layers) l.target = 0;
      this.stopSynth();
    }
  }

  // Crossfade to a track by name (path inside the archive item).
  play(name, force = false) {
    if (name === this.current && !force) return;
    this.current = name;
    if (!this.enabled) return;
    const next = this.layers[1 - this.active];
    const prev = this.layers[this.active];
    prev.target = 0;
    next.failed = false;
    if (next.name !== name) {
      next.name = name;
      next.el.src = url(name);
      next.el.load();
    }
    next.el.currentTime = 0;
    next.target = 1;
    next.el.play().catch(() => { next.failed = true; });
    this.active = 1 - this.active;
    this.stopSynth();
  }

  badge() {
    if (!this.enabled) return;
    try { this.stinger.currentTime = 0; this.stinger.play().catch(() => {}); } catch {}
  }

  _loop() {
    const now = performance.now();
    const dt = Math.min((now - this._lastT) / 1000, 0.1);
    this._lastT = now;
    for (const l of this.layers) {
      const want = l.target * this.master;
      const v = l.el.volume;
      const step = dt * (l.target > 0 ? 0.6 : 0.9);
      const nv = v < want ? Math.min(want, v + step) : Math.max(want, v - step);
      if (nv !== v) { try { l.el.volume = nv; } catch {} }
      if (nv === 0 && l.target === 0 && !l.el.paused) l.el.pause();
      if (l.failed && l.target > 0 && this.enabled) this.startSynth();
    }
    this._raf = setTimeout(this._loop, 50);
  }

  // --- fallback: a four-bar chip arpeggio so the site is never silent when sound is on
  startSynth() {
    if (this.synth) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const gain = ctx.createGain(); gain.gain.value = 0.05; gain.connect(ctx.destination);
    const notes = [0, 4, 7, 12, 7, 4, 0, -5, 2, 5, 9, 14, 9, 5, 2, -3];
    let i = 0;
    const base = 220;
    const timer = setInterval(() => {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = base * Math.pow(2, notes[i % notes.length] / 12);
      const g = ctx.createGain(); g.gain.setValueAtTime(1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g); g.connect(gain); o.start(); o.stop(ctx.currentTime + 0.22);
      i++;
    }, 170);
    this.synth = { ctx, timer };
  }
  stopSynth() {
    if (!this.synth) return;
    clearInterval(this.synth.timer);
    this.synth.ctx.close().catch(() => {});
    this.synth = null;
  }
}
