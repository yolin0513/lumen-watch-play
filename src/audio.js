// 音效與背景音樂（M8 第三輪第二批）：全部用 Web Audio 當場合成——不下載、不附帶任何音檔，沒有版權疑慮，離線也有聲音。
// 瀏覽器的東西（AudioContext、document、window、navigator）一律由外面傳進來：meta-test 用假的 AudioContext 測解鎖、背景恢復、靜音、預算。
//
// iPhone Safari（擁有者主要的遊玩環境）的限制，先處理：
//   - 音訊要由使用者手勢啟動：第一次點畫面（例如「點燈出發」）時建立並 resume AudioContext，並播一個極短的無聲緩衝（iOS 的慣用解鎖法）。
//     手勢監聽不拿掉：之後被來電、鬧鐘打斷（iOS 的 'interrupted'）或被系統暫停時，下一次點畫面就再 resume。
//   - 切到背景／鎖屏：頁面隱藏時 suspend（省電、不在背景出聲），回到前景時 resume；resume 被擋（沒有手勢）就等下一次點畫面。
//   - 靜音開關：有 navigator.audioSession 的 Safari 設成 'ambient'——跟著手機的靜音開關走（開靜音就不出聲），也不會打斷使用者正在聽的音樂。
// 發聲預算在 sfx.js（純邏輯）；這裡只負責「照排程發出來」。
import { createMixer, SFX } from './sfx.js';

export const AUDIO_DEFAULTS = { musicVol: 0.5, sfxVol: 0.8, muted: false };

export function createAudio({ Ctor, doc, win, nav } = {}) {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, settings = { ...AUDIO_DEFAULTS }, mode = 'menu', eco = 1;
  const mixer = createMixer(), stats = { started: 0, resumes: 0, suspends: 0, unlocks: 0 };
  let music = null;

  function build() {
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination); // 很多聲音同時響時不爆音
    master = ctx.createGain(); master.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    const n = Math.floor(ctx.sampleRate * 0.5); noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    ctx.onstatechange = () => { if (ctx.state === 'running') ensureMusic(); };
    applyGains();
  }
  function applyGains() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.02);
    sfxBus.gain.setTargetAtTime(settings.sfxVol, t, 0.02);
    musicBus.gain.setTargetAtTime(settings.musicVol * (mode === 'pause' ? 0.35 : 1), t, 0.1);
  }
  function resume() { if (ctx && ctx.state !== 'running' && !(doc?.hidden)) { stats.resumes++; ctx.resume()?.catch?.(() => {}); } }
  // 手勢：第一次建立並解鎖；之後每次手勢都檢查一下，被打斷就恢復
  function unlock() {
    if (!Ctor) return;
    if (!ctx) {
      build(); stats.unlocks++;
      const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0); // iOS 解鎖用的無聲緩衝
      try { if (nav?.audioSession) nav.audioSession.type = 'ambient'; } catch { /* 舊版 Safari 沒有 */ }
    }
    resume(); // 每次手勢都檢查一次：被打斷（interrupted）或被系統暫停就恢復
  }
  function onVisibility() {
    if (!ctx) return;
    if (doc.hidden) { if (ctx.state === 'running') { stats.suspends++; ctx.suspend()?.catch?.(() => {}); } }
    else resume();
  }
  if (doc && win) {
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) win.addEventListener(ev, unlock, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pagehide', () => { if (ctx && ctx.state === 'running') { stats.suspends++; ctx.suspend()?.catch?.(() => {}); } });
    win.addEventListener('pageshow', () => resume());
  }

  // ---- 合成：兩種積木（音調、雜訊），每種聲音是幾塊積木的組合 ----
  function tone(t, f0, f1, dur, type, vol, { attack = 0.004, dest = sfxBus, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, filter, f0, f1, vol, { q = 1, dest = sfxBus } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = filter; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  const jitter = (x, k = 0.08) => x * (1 + (Math.random() - 0.5) * k); // 同一種聲音每次略有不同，連續命中才不會像機關槍
  const VOICE = {
    // 命中：短促的「啪」＋往下掉的音頭——要脆、要短
    hit: (t, v) => { noise(t, 0.05, 'bandpass', jitter(2400), 900, v * 0.9, { q: 1.5 }); tone(t, jitter(620), 220, 0.07, 'triangle', v * 0.6); },
    // 擊倒：低頻「砰」＋碎裂的高頻
    kill: (t, v) => { tone(t, jitter(260), 55, 0.18, 'sine', v); noise(t, 0.12, 'highpass', 3000, 1200, v * 0.45); tone(t + 0.01, jitter(1200), 500, 0.06, 'square', v * 0.12); },
    gem: (t, v) => { tone(t, jitter(1400, 0.15), 2100, 0.09, 'sine', v); },
    blast: (t, v) => { noise(t, 0.4, 'lowpass', 1400, 160, v); tone(t, 110, 38, 0.35, 'sine', v * 0.9); },
    hurt: (t, v) => { tone(t, 150, 70, 0.22, 'sawtooth', v * 0.35); noise(t, 0.15, 'lowpass', 700, 200, v * 0.6); },
    // 升級：明亮的上行琶音
    level: (t, v) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.06, f, f, 0.35, 'triangle', v * 0.55, { attack: 0.005 })); },
    chest: (t, v) => { [784, 988, 1175, 1568].forEach((f, i) => { tone(t + i * 0.09, f, f * 1.002, 0.9, 'sine', v * 0.35, { attack: 0.02 }); tone(t + i * 0.09, f * 2, f * 2, 0.5, 'sine', v * 0.1); }); },
    // 共鳴：往上掃的音＋和弦
    evo: (t, v) => { tone(t, 220, 880, 0.6, 'sawtooth', v * 0.2, { attack: 0.3 }); [440, 554, 659, 880].forEach((f) => tone(t + 0.55, f, f, 1.0, 'triangle', v * 0.3, { attack: 0.02 })); },
    boss: (t, v) => { tone(t, 55, 52, 2.0, 'sawtooth', v * 0.3, { attack: 0.6 }); tone(t, 82, 78, 2.0, 'sawtooth', v * 0.22, { attack: 0.6, detune: 7 }); noise(t, 1.2, 'lowpass', 300, 80, v * 0.3); },
    bossdown: (t, v) => { noise(t, 0.8, 'lowpass', 2000, 120, v * 0.8); tone(t, 90, 30, 0.8, 'sine', v); [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + 0.3 + i * 0.12, f, f, 1.2, 'sine', v * 0.3, { attack: 0.01 })); },
    heal: (t, v) => { tone(t, 660, 990, 0.3, 'sine', v * 0.7, { attack: 0.02 }); },
  };

  // ---- 背景音樂（樸素：柔和的和弦＋低音脈動＋偶爾的鈴聲；打擊音效優先，所以音樂刻意安靜、不搶頻率） ----
  const ROOT = { 1: 57, 2: 55, 3: 60, 4: 52, 5: 59, 6: 53 }; // 每個生態系一個調（MIDI 音高）
  const PROG = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]]; // 小調的四個和弦（相對根音）
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  function ensureMusic() {
    if (music || !ctx || ctx.state !== 'running' || !win) return;
    const beat = 60 / 76; let next = ctx.currentTime + 0.1, step = 0;
    music = win.setInterval(() => {
      if (!ctx || ctx.state !== 'running' || settings.muted || settings.musicVol <= 0) { next = ctx ? ctx.currentTime + 0.1 : next; return; }
      while (next < ctx.currentTime + 0.6) {
        const bar = Math.floor(step / 4) % PROG.length, root = ROOT[eco] ?? 57, chord = PROG[bar];
        if (step % 8 === 0) for (const iv of chord) { tone(next, hz(root + iv), hz(root + iv), beat * 8, 'triangle', 0.05, { attack: 1.2, dest: musicBus }); tone(next, hz(root + iv + 12), hz(root + iv + 12), beat * 8, 'sine', 0.02, { attack: 1.5, dest: musicBus, detune: 6 }); }
        tone(next, hz(root - 12 + chord[0]), hz(root - 12 + chord[0]), beat * 0.9, 'sine', mode === 'run' ? 0.09 : 0.05, { attack: 0.01, dest: musicBus });
        if (step % 2 === 1 && Math.random() < 0.35) { const iv = chord[Math.floor(Math.random() * 3)]; tone(next, hz(root + 12 + iv), hz(root + 12 + iv), beat * 2, 'sine', 0.03, { attack: 0.005, dest: musicBus }); }
        next += beat; step++;
      }
    }, 150);
  }

  return {
    unlock, stats, mixer,
    get ctx() { return ctx; },
    // 這一幀的遊戲事件 → 依預算發聲（靜音、音效音量 0、還沒解鎖、在背景時都不建立任何聲音節點）
    onEvents(events, now) {
      const plan = mixer.plan(events, now);
      if (!ctx || ctx.state !== 'running' || settings.muted || settings.sfxVol <= 0) return [];
      const t = ctx.currentTime + 0.005;
      for (const p of plan) { VOICE[p.id](t, p.vol); stats.started++; }
      return plan;
    },
    apply(s) { settings = { ...AUDIO_DEFAULTS, ...s }; applyGains(); },
    setMode(m) { mode = m; applyGains(); },
    setEco(id) { eco = id; },
    get settings() { return settings; },
  };
}
export const SOUND_IDS = Object.keys(SFX);
