// Sound, synthesised with WebAudio — no audio files. Engine hum, siren, gunshots, punches,
// pickups, mission jingles and a car door thunk. The context is created on the first user
// gesture (browsers block audio before that) and everything is guarded, so a silent browser
// never breaks the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* a failed blip is never worth crashing the game */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    gunshot() { noise(0.14, 0.4, 2500); blip(160, 0.08, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.25, 500); },
    pickup() { blip(880, 0.12, 'sine', 0.2, 1320); },
    cash() { blip(660, 0.1, 'sine', 0.2); setTimeout(() => blip(990, 0.14, 'sine', 0.2), 90); },
    door() { noise(0.07, 0.2, 800); blip(120, 0.08, 'triangle', 0.2, 80); },
    crash() { noise(0.25, 0.35, 900); },
    missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.2), i * 130)); },
    busted() { blip(220, 0.5, 'sawtooth', 0.2, 110); },
    /** Continuous engine and siren levels, called every frame. */
    update(speed, wanted) {
      if (!ctx || muted) return;
      try {
        const target = speed > 10 ? 0.03 + Math.min(0.09, Math.abs(speed) / 6000) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + Math.abs(speed) * 0.12, ctx.currentTime, 0.1);
        if (wanted > 0) {
          sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2);
          const t = ctx.currentTime;
          sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 4) * 180, t, 0.05);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        }
      } catch { /* ignore */ }
    },
  };
}
