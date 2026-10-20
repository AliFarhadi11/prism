// Sound: each target hums its note while its colour arrives; solving plays the level's chord.
// Web Audio only starts after a user gesture, so `start()` is called from the first input.

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: Array<{ gain: GainNode; stop: () => void }> = [];
  private on = true;

  get enabled() {
    return this.on;
  }

  start() {
    if (this.ctx) return void this.ctx.resume();
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.on ? 0.9 : 0;
    // A soft room: a generated impulse response, decaying noise.
    const verb = ctx.createConvolver();
    const n = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    master.connect(ctx.destination);
    master.connect(verb);
    verb.connect(wet);
    wet.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
  }

  /** One sustained voice per target, silent until its colour arrives. */
  setNotes(notes: number[]) {
    for (const v of this.voices) v.stop();
    this.voices = [];
    const { ctx, master } = this;
    if (!ctx || !master) return;
    this.voices = notes.map((f) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.value = f * 2;
      o2.detune.value = 5;
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o1.connect(lp);
      o2.connect(g2);
      g2.connect(lp);
      lp.connect(gain);
      gain.connect(master);
      o1.start();
      o2.start();
      return {
        gain,
        stop: () => {
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
          o1.stop(ctx.currentTime + 1.5);
          o2.stop(ctx.currentTime + 1.5);
        },
      };
    });
  }

  /** How strongly each target's colour arrives (0–1), and whether it is lit. */
  setLevels(levels: Array<{ progress: number; lit: boolean }>) {
    const { ctx } = this;
    if (!ctx) return;
    levels.forEach((l, i) => this.voices[i]?.gain.gain.setTargetAtTime(l.lit ? 0.09 : l.progress * 0.025, ctx.currentTime, 0.25));
  }

  pluck(freq: number, delay = 0, gain = 0.1) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const when = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.4);
    o.connect(g);
    g.connect(master);
    o.start(when);
    o.stop(when + 2.5);
  }

  /** The level's chord, rolled upward an octave higher, when the puzzle is solved. */
  chord(notes: number[]) {
    [...notes, notes[0] * 2].forEach((f, i) => this.pluck(f * 2, 0.05 + i * 0.13, 0.1));
  }

  toggle() {
    this.on = !this.on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.1);
    return this.on;
  }
}
