/**
 * 疗愈向垫音（Web Audio，无外部文件）：雨棍质感（低通粉噪颗粒）+ 稀疏风铃高频短音 + 颂钵式低频衰减音。
 * 参考常见音疗组合：雨声柔和铺底、风铃轻点缀、颂钵长延音不抢戏。
 */
export type BreathingAmbientStop = () => void;

function makeNoiseLoopBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    const pink = b0 + b1 + b2 + white * 0.5362;
    ch[i] = pink * 0.11;
  }
  return buf;
}

export function startBreathingAmbient(): BreathingAmbientStop | null {
  const Ctx = typeof window !== 'undefined' ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : null;
  if (!Ctx) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }

  let cancelled = false;
  const master = ctx.createGain();
  master.gain.value = 0.22;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -28;
  comp.knee.value = 18;
  comp.ratio.value = 2.2;
  comp.attack.value = 0.02;
  comp.release.value = 0.65;
  master.connect(comp);
  comp.connect(ctx.destination);

  // —— 雨棍 / 细雨：粉噪 + 低通 + 很慢的音量起伏 ——
  const rainBuf = makeNoiseLoopBuffer(ctx, 2.4);
  const rainSrc = ctx.createBufferSource();
  rainSrc.buffer = rainBuf;
  rainSrc.loop = true;
  const rainLp = ctx.createBiquadFilter();
  rainLp.type = 'lowpass';
  rainLp.frequency.value = 520;
  rainLp.Q.value = 0.45;
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0.045;
  const rainLfo = ctx.createOscillator();
  rainLfo.type = 'sine';
  rainLfo.frequency.value = 0.028;
  const rainLfoGain = ctx.createGain();
  rainLfoGain.gain.value = 0.018;
  rainLfo.connect(rainLfoGain);
  rainLfoGain.connect(rainGain.gain);
  rainSrc.connect(rainLp).connect(rainGain).connect(master);
  rainSrc.start();
  rainLfo.start();

  function playWindChime() {
    if (cancelled) return;
    const t = ctx.currentTime;
    const base = 1320 + Math.random() * 880;
    const partials = [1, 1.62, 2.41].map((m) => base * m);
    const dur = 0.9 + Math.random() * 0.55;
    partials.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const peak = (0.04 / (i + 1)) * (0.55 + Math.random() * 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.012 + i * 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + i * 0.05);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  function playBowlStrike() {
    if (cancelled) return;
    const t = ctx.currentTime;
    const f0 = 154 + Math.random() * 18;
    const ratios = [1, 2.07, 3.18, 4.85];
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * r;
      const g = ctx.createGain();
      const peak = 0.055 / (i + 1);
      const sustain = 2.8 + Math.random() * 1.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
      g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sustain);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + sustain + 0.05);
    });
  }

  const pendingTimers = new Set<number>();

  function armTimer(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      pendingTimers.delete(id);
      fn();
    }, ms);
    pendingTimers.add(id);
  }

  function scheduleBowl() {
    if (cancelled) return;
    const wait = 8200 + Math.random() * 7000;
    armTimer(() => {
      if (cancelled) return;
      playBowlStrike();
      scheduleBowl();
    }, wait);
  }

  function scheduleChime() {
    if (cancelled) return;
    const wait = 3800 + Math.random() * 5200;
    armTimer(() => {
      if (cancelled) return;
      if (Math.random() > 0.35) playWindChime();
      scheduleChime();
    }, wait);
  }

  scheduleBowl();
  scheduleChime();
  playBowlStrike();

  void ctx.resume().catch(() => {
    /* 部分环境需用户手势后 resume */
  });

  const stop = () => {
    cancelled = true;
    pendingTimers.forEach((id) => window.clearTimeout(id));
    pendingTimers.clear();
    try {
      rainSrc.stop();
      rainLfo.stop();
    } catch {
      /* already stopped */
    }
    try {
      master.disconnect();
      comp.disconnect();
    } catch {
      /* */
    }
    void ctx.close();
  };

  return stop;
}
