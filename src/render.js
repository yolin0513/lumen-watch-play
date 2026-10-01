// 畫面層：讀 sim.state 畫圖；粒子、飄字、震動、橫幅這些純視覺效果由 state.events 觸發，只存在這裡。
import { VW, terrainIn, ventState } from './sim.js';
import { ENEMIES, WEAPONS, PASSIVES, CHAPTER1, BONDS, AFFINITY, AFFINITIES } from './content.js';
import { glow, makeGround, makeCreature, drawPlayer, makeIcon, makeChest, makePillar, PALETTES } from './art.js';
import { chestGuides, GUIDE } from './guide.js';

// shared：各章共用的怪，會依章節 hue 偏移換色，讓同一種怪在不同地區看起來屬於那片土地
const CREATURE_ART = {
  mite:     { seed: 11, radius: 11, hue: 290, eyes: 1, shared: true },
  swarm:    { seed: 17, radius: 9,  hue: 45,  eyes: 1, spikes: 2, shared: true }, // 菌潮的潮孢：偏金色，一眼看得出是「送經驗的」
  moth:     { seed: 5,  radius: 9,  hue: 20,  eyes: 1, spikes: 3, shared: true },
  brute:    { seed: 23, radius: 20, hue: 150, eyes: 2, spikes: 7, shared: true },
  spitter:  { seed: 41, radius: 13, hue: 95,  eyes: 3, shared: true },
  splitter: { seed: 64, radius: 15, hue: 200, eyes: 2, spikes: 4, shared: true },
  leech:    { seed: 91, radius: 12, hue: 110, eyes: 2 },
  bloater:  { seed: 37, radius: 16, hue: 60,  eyes: 1, spikes: 6 },
  turret:   { seed: 13, radius: 14, hue: 190, eyes: 1, spikes: 9 },
  blinker:  { seed: 58, radius: 10, hue: 300, eyes: 2, spikes: 2 },
  shell:    { seed: 29, radius: 17, hue: 230, eyes: 2, spikes: 10 },
  boss1:    { seed: 77, radius: 42, hue: 322, eyes: 3, spikes: 12 },
  boss2:    { seed: 83, radius: 40, hue: 95,  eyes: 4, spikes: 6 },
  boss3:    { seed: 47, radius: 44, hue: 250, eyes: 1, spikes: 16 },
  cinder:   { seed: 71, radius: 10, hue: 20,  eyes: 1, spikes: 5 },
  golem:    { seed: 33, radius: 22, hue: 10,  eyes: 2, spikes: 11 },
  frostmoth:{ seed: 19, radius: 11, hue: 195, eyes: 2, spikes: 4 },
  glider:   { seed: 88, radius: 12, hue: 180, eyes: 1, spikes: 3 },
  hive:     { seed: 52, radius: 24, hue: 80,  eyes: 5, spikes: 14 },
  rooter:   { seed: 61, radius: 16, hue: 45,  eyes: 2, spikes: 8 },
  boss4:    { seed: 95, radius: 46, hue: 15,  eyes: 3, spikes: 14 },
  boss5:    { seed: 26, radius: 46, hue: 200, eyes: 2, spikes: 18 },
  boss6:    { seed: 14, radius: 50, hue: 90,  eyes: 6, spikes: 20 },
};
const NONE = new Set();
const AFFIX_COLOR = { swift: 'rgba(120,255,200,1)', regen: 'rgba(120,255,120,1)', armor: 'rgba(255,200,90,1)' };

export function createRenderer(chapter = CHAPTER1) {
  const sprites = {};
  for (const k of Object.keys(ENEMIES)) { const a = CREATURE_ART[k]; sprites[k] = makeCreature({ ...a, hue: a.hue + (a.shared ? chapter.hue : 0) }); }
  const ground = makeGround(PALETTES[chapter.palette], 7 + chapter.id);
  const chestImg = makeChest();
  const G = {
    bolt: glow('rgba(255,210,120,1)', 14), gem: glow('rgba(120,230,255,1)', 12), spark: glow('rgba(255,160,220,1)', 10),
    star: glow('rgba(140,235,255,1)', 14), spore: glow('rgba(255,90,200,1)', 16), orb: glow('rgba(150,235,255,1)', 22),
    gold: glow('rgba(255,210,90,1)', 30), heal: glow('rgba(255,140,170,1)', 18), magnet: glow('rgba(120,200,255,1)', 18),
    aura: glow('rgba(255,170,80,0.5)', 64), boss: glow('rgba(255,80,190,0.8)', 90),
    crystal: glow('rgba(200,150,255,0.7)', 40), blast: glow('rgba(255,180,90,1)', 20), poison: glow('rgba(140,255,120,0.9)', 16),
    frost: glow('rgba(170,230,255,1)', 16), lava: glow('rgba(255,140,50,1)', 48),
    evo: glow('rgba(255,225,130,1)', 22), sentry: glow('rgba(150,255,180,1)', 22), lanceG: glow('rgba(150,210,255,1)', 16), rico: glow('rgba(150,255,235,1)', 12), void: glow('rgba(180,140,255,1)', 16),
    shade: glow('rgba(5,4,13,0.55)', 28), blade: glow('rgba(150,255,220,1)', 18), star2: glow('rgba(255,150,240,1)', 24), wisp: glow('rgba(230,255,120,1)', 12), lantern: glow('rgba(255,210,90,1)', 14), ember: glow('rgba(255,120,50,1)', 14),
  };
  for (const k of Object.keys(AFFIX_COLOR)) G['elite_' + k] = glow(AFFIX_COLOR[k], 48);
  const fx = { parts: [], texts: [], arcs: [], rings: [], banners: [], lances: [], snipes: [], shake: 0, levelFlash: 0, hurtFlash: 0, whiteFlash: 0 };
  const MAX_PARTS = 350; // 粒子上限：量測顯示重場面的尖峰幀主要來自大量加亮粒子
  // 發光預算（M8）：加亮疊加（'lighter'）的裝飾光——共鳴金光、粒子、光屑的光暈——同一幀畫得越多，就一起按比例調淡，
  // 讓「疊在一起的總亮度」有上限；數量在預算內時（一般場面）完全不變。
  // 理由：M7 第三批的共鳴金光在滿場時疊成一片白、蓋掉角色（擁有者手機回報）；只把每個光調暗會讓平常的場面也變暗，
  // 問題出在「數量沒有上限」，所以限制的是總量。tools/glow-check.mjs 量過亮面積、角色周圍亮度，並用「拿掉預算」當對照組。
  const GLOW = { on: true, evo: 16, parts: 120, gems: 60 };
  const share = (n, budget) => (n <= budget ? 1 : budget / n);
  function glowBudget(s, p, onScreen) {
    let evo = 0, parts = 0, gems = 0;
    for (const b of s.bullets) if (b.evo && !b.big && onScreen(b.x, b.y)) evo += b.boom ? 3 : 1;
    for (const w of p.weapons) if (w.evo) evo += w.wisps.length;
    for (const m of s.mines) if (m.evo) evo++;
    for (const q of s.sentries) if (q.src.evo) evo++;
    for (const q of fx.parts) if (q.img === G.evo) evo++; else parts++;
    for (const gm of s.gems) if (onScreen(gm.x, gm.y)) gems++;
    return { evo: share(evo, GLOW.evo), parts: share(parts, GLOW.parts), gems: share(gems, GLOW.gems) };
  }

  // ---- 螢幕尺寸相關的快取（效能：量測顯示每幀重建全螢幕漸層與紋理圖樣是繪製的最大成本）----
  // 地面：把 512 的地面磚預先放大到裝置像素，平鋪時 1:1 貼圖、不再每幀重新取樣。
  // 霧／暗角／受傷紅框：全螢幕漸層只在畫布尺寸改變時畫一次，之後每幀 drawImage。
  const cache = { key: '' };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  function screenCache(W, H, scale) {
    const key = `${W}x${H}@${scale}`;
    if (cache.key === key) return cache;
    cache.key = key;
    const T = Math.max(1, Math.round(512 * scale));
    cache.tile = mk(T, T); cache.tile.getContext('2d').drawImage(ground, 0, 0, T, T); cache.T = T;
    const radial = (w, h, cx, cy, r0, r1, stops) => {
      const c = mk(w, h), cg = c.getContext('2d'), gr = cg.createRadialGradient(cx, cy, r0, cx, cy, r1);
      for (const [o, col] of stops) gr.addColorStop(o, col);
      cg.fillStyle = gr; cg.fillRect(0, 0, w, h); return c;
    };
    cache.vig = radial(W, H, W / 2, H / 2, Math.min(W, H) * 0.35, Math.max(W, H) * 0.75, [[0, 'rgba(5,4,13,0)'], [1, 'rgba(5,4,13,0.75)']]);
    cache.red = radial(W, H, W / 2, H / 2, Math.min(W, H) * 0.3, Math.max(W, H) * 0.7, [[0, 'rgba(255,0,60,0)'], [1, 'rgba(255,20,70,1)']]);
    if (chapter.fog) {
      const R = chapter.fog * scale, M = 48; // 多留邊界，震動時也蓋得滿
      cache.fogM = M;
      cache.fog = radial(W + 2 * M, H + 2 * M, W / 2 + M, H / 2 + M, R * 0.55, R * 1.25, [[0, 'rgba(160,190,175,0)'], [0.6, 'rgba(90,120,105,0.45)'], [1, 'rgba(40,58,50,0.88)']]);
      const br = 90 * scale;
      cache.blob = radial(br * 2, br * 2, br, br, 0, br, [[0, 'rgba(200,230,210,0.9)'], [1, 'rgba(200,230,210,0)']]);
    }
    return cache;
  }

  function burst(x, y, n, img, spd, life = 0.5, size = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random());
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), img, size });
    }
  }
  function banner(text, big) { fx.banners.push({ text, big, life: big ? 3 : 2.2, max: big ? 3 : 2.2 }); }

  function consume(s, dt) {
    for (const e of s.events) {
      switch (e.type) {
        case 'hit': fx.texts.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, v: e.v, big: e.big, life: 0.6 }); burst(e.x, e.y + 4, 2, G.bolt, 70, 0.3, 8); break;
        case 'kill': burst(e.x, e.y, e.elite ? 30 : 9, e.elite ? G.gold : G.spark, e.elite ? 220 : 130); break;
        case 'fade': burst(e.x, e.y, 5, G.spark, 60); break;
        case 'hurt': fx.shake = 7; fx.hurtFlash = 0.35; burst(e.x, e.y, 10, G.spark, 160); break;
        case 'level': fx.levelFlash = 1; burst(e.x, e.y, 30, G.gem, 220); break;
        case 'arc': fx.arcs.push({ pts: e.pts, life: 0.18, evo: e.evo }); break;
        case 'aura': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.3, color: e.evo ? 'sun' : undefined }); break;
        case 'lance': fx.lances.push({ x: e.x, y: e.y, ang: e.ang, len: e.len, w: e.w, evo: e.evo, life: 0.22 }); break;
        case 'snipe': fx.snipes.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, r: e.r, evo: e.evo, life: 0.25 }); burst(e.tx, e.ty, e.evo ? 8 : 5, e.evo ? G.evo : G.lanceG, 160, 0.3, 9); break;
        case 'vortexBurst': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: e.evo ? 'gold' : 'void' }); burst(e.x, e.y, e.evo ? 18 : 12, e.evo ? G.evo : G.void, 220, 0.45, 11); fx.shake = Math.max(fx.shake, 3); break;
        case 'ashBurst': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: 'blast' }); burst(e.x, e.y, 14, G.ember, 200, 0.45, 11); fx.shake = Math.max(fx.shake, 3); break;
        case 'bondBurst': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: 'blast' }); burst(e.x, e.y, 12, G.ember, 200, 0.4, 11); break;
        case 'bounce': burst(e.x, e.y, 3, e.evo ? G.evo : G.rico, 90, 0.25, 8); break;
        case 'pulse': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: e.evo ? 'pulseEvo' : 'pulse' }); if (e.evo) { fx.rings.push({ x: e.x, y: e.y, r: e.r * 0.7, life: 0.35, color: 'pulseEvo' }); burst(e.x, e.y, 10, G.evo, 220, 0.4, 10); } break;
        case 'burst': fx.rings.push({ x: e.x, y: e.y, r: e.small ? 30 : 70, life: 0.35, color: 'spore' }); break;
        case 'chest': fx.whiteFlash = 0.5; burst(e.x, e.y, 40, G.gold, 260, 0.8, 14); break;
        case 'heal': burst(e.x, e.y, 16, G.heal, 120); break;
        case 'magnet': fx.rings.push({ x: e.x, y: e.y, r: 300, life: 0.5, color: 'magnet' }); break;
        case 'announce': banner(e.text, e.big); if (e.big) fx.shake = 10; break;
        case 'blast': fx.shake = Math.max(fx.shake, 6); fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: 'blast' }); burst(e.x, e.y, 26, G.blast, 240, 0.6, 14); break;
        case 'blink': burst(e.x, e.y, 14, G.crystal, 150, 0.4, 10); break;
        case 'spark': burst(e.x, e.y, 3, G.crystal, 90, 0.25, 8); break;
        case 'strike': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: e.evo ? 'gold' : 'strike' }); burst(e.x, e.y, e.evo ? 22 : 16, e.evo ? G.evo : G.star2, e.evo ? 260 : 200, 0.45, 12); fx.shake = Math.max(fx.shake, e.evo ? 5 : 3); break;
        case 'mineBoom': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.35, color: e.evo ? 'gold' : 'blast' }); burst(e.x, e.y, e.evo ? 26 : 18, e.evo ? G.evo : G.lantern, e.evo ? 280 : 220, 0.5, 12); break;
        case 'revive': fx.whiteFlash = 1; banner('燈芯復燃！', true); burst(e.x, e.y, 80, G.gold, 320, 1, 14); break;
        case 'bossdown': fx.whiteFlash = 1; fx.shake = 16; burst(e.x, e.y, 120, G.gold, 380, 1.4, 16); burst(e.x, e.y, 80, G.spore, 300, 1.2, 14); break;
      }
    }
    s.events.length = 0;
    fx.shake = Math.max(0, fx.shake - dt * 30);
    for (const k of ['levelFlash', 'hurtFlash', 'whiteFlash']) fx[k] = Math.max(0, fx[k] - dt * (k === 'whiteFlash' ? 1.5 : 1));
    for (const q of fx.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
    fx.parts = fx.parts.filter((q) => q.life > 0);
    if (fx.parts.length > MAX_PARTS) fx.parts.splice(0, fx.parts.length - MAX_PARTS);
    for (const q of fx.texts) { q.y -= 30 * dt; q.life -= dt; }
    fx.texts = fx.texts.filter((q) => q.life > 0);
    if (fx.texts.length > 80) fx.texts.splice(0, fx.texts.length - 80);
    for (const list of [fx.arcs, fx.rings, fx.banners, fx.lances, fx.snipes]) for (const q of list) q.life -= dt;
    fx.arcs = fx.arcs.filter((q) => q.life > 0); fx.rings = fx.rings.filter((q) => q.life > 0); fx.banners = fx.banners.filter((q) => q.life > 0); fx.lances = fx.lances.filter((q) => q.life > 0); fx.snipes = fx.snipes.filter((q) => q.life > 0);
  }

  // prof：效能量測模式（src/perf.js）才會傳入，每畫完一段呼叫 lap 記錄耗時；平常是 null，不花成本
  let lastGuides = [];
  // 回傳這一幀畫了哪些燈核指引（shop-test 拿去和自己算的座標比對；平常沒人用）
  function render(g, s, dt, W, H, scale, safeTop = 0, hud = true, prof = null) {
    prof?.start();
    lastGuides = [];
    const OFF = prof?.off ?? NONE; // 效能量測的 A/B：關掉指定的繪製項目，看總時間少多少（平常是空集合）
    consume(s, dt);
    prof?.lap('特效更新');
    const vh = H / scale, p = s.player, T = s.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * fx.shake, sy = (Math.random() - 0.5) * fx.shake;
    const camX = p.x - VW / 2 + sx, camY = p.y - vh / 2 + sy;
    g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    const onScreen = (x, y, m = 60) => x > camX - m && x < camX + VW + m && y > camY - m && y < camY + vh + m;
    const glowK = GLOW.on ? glowBudget(s, p, onScreen) : null, kE = glowK?.evo ?? 1, kP = glowK?.parts ?? 1, kG = glowK?.gems ?? 1;

    const C = screenCache(W, H, scale);
    if (OFF.has('ground')) { g.fillStyle = '#101020'; g.fillRect(camX, camY, VW, vh); }
    else if (OFF.has('cache')) { g.fillStyle = g.createPattern(ground, 'repeat'); g.fillRect(camX, camY, VW, vh); } // 優化前的舊做法（A/B 對照用）
    else { // 螢幕空間平鋪預先放大的地面磚（通常 4～6 次 drawImage）
      g.setTransform(1, 0, 0, 1, 0, 0);
      const T = C.T, ox = -((((camX * scale) % T) + T) % T), oy = -((((camY * scale) % T) + T) % T);
      for (let x = Math.round(ox); x < W; x += T) for (let y = Math.round(oy); y < H; y += T) g.drawImage(C.tile, x, y);
      g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    }
    prof?.lap('地面');

    // 泥沼：深色水窪＋一圈反光
    const ter = s.chapter.terrain;
    if (ter === 'pools') for (const f of terrainIn('pools', s.terrainSeed, camX - 80, camY - 80, camX + VW + 80, camY + vh + 80)) {
      // 顏色要和霧沼地面明顯不同（先前太接近底色，等於隱形）：偏青綠的濁水＋亮邊＋漂浮反光
      const pg = g.createRadialGradient(f.x, f.y - f.r * 0.2, f.r * 0.1, f.x, f.y, f.r);
      pg.addColorStop(0, 'rgba(70,140,120,0.85)'); pg.addColorStop(0.75, 'rgba(40,95,80,0.8)'); pg.addColorStop(1, 'rgba(30,70,60,0.2)');
      g.fillStyle = pg; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(160,240,200,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.8, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = `rgba(200,255,230,${0.25 + Math.sin(T * 1.5 + f.x) * 0.12})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(f.x - f.r * 0.2, f.y - f.r * 0.15, f.r * 0.35, f.r * 0.12, -0.2, 0, Math.PI * 2); g.stroke();
    }

    // 熔坑（第四章）：焦黑坑洞；預警時坑緣的橘光一圈圈收緊，噴發時整個坑冒出亮橘色火柱
    if (ter === 'vents') for (const f of terrainIn('vents', s.terrainSeed, camX - 80, camY - 80, camX + VW + 80, camY + vh + 80)) {
      const st = ventState(f, s.terrainSeed, T);
      g.fillStyle = 'rgba(20,8,6,0.85)'; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.78, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,110,50,0.45)'; g.lineWidth = 2; g.stroke();
      if (st?.warn !== undefined) {
        g.fillStyle = `rgba(255,120,40,${0.1 + st.warn * 0.3})`; g.fill();
        g.strokeStyle = `rgba(255,190,90,${0.5 + st.warn * 0.5})`; g.lineWidth = 2.5; g.setLineDash([6, 5]);
        g.beginPath(); g.ellipse(f.x, f.y, f.r * (1.5 - st.warn * 0.5), f.r * 0.78 * (1.5 - st.warn * 0.5), 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      } else if (st?.fire) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.8 + Math.random() * 0.2; g.drawImage(G.lava, f.x - f.r * 1.6, f.y - f.r * 1.9, f.r * 3.2, f.r * 3.2); g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,220,140,0.55)'; g.beginPath(); g.ellipse(f.x, f.y, f.r * 0.85, f.r * 0.66, 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    // 冰面（第五章）：半透明淡藍冰片＋幾道反光（踩上去會滑）
    if (ter === 'ice') for (const f of terrainIn('ice', s.terrainSeed, camX - 100, camY - 100, camX + VW + 100, camY + vh + 100)) {
      const ig = g.createRadialGradient(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.1, f.x, f.y, f.r);
      ig.addColorStop(0, 'rgba(220,245,255,0.55)'); ig.addColorStop(0.8, 'rgba(150,200,240,0.4)'); ig.addColorStop(1, 'rgba(120,170,230,0.1)');
      g.fillStyle = ig; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.72, 0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(230,250,255,0.5)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(f.x - f.r * 0.5, f.y - f.r * 0.1); g.lineTo(f.x - f.r * 0.1, f.y - f.r * 0.35); g.moveTo(f.x + f.r * 0.1, f.y + f.r * 0.2); g.lineTo(f.x + f.r * 0.45, f.y); g.stroke();
    }

    // 地面危險：預警時畫虛線輪廓，生效時填滿
    for (const h of s.hazards) {
      const active = h.t >= h.arm, k = active ? 1 : h.t / h.arm;
      if (h.type === 'zone') {
        const col = h.src === 'poison' ? '120,255,140' : h.src === 'rain' ? '180,150,255' : h.src === 'fire' ? '255,130,40' : h.src === 'slam' ? '255,190,110' : h.src === 'frostzone' ? '150,220,255' : '255,120,120';
        g.fillStyle = `rgba(${col},${active ? 0.35 : 0.08 + k * 0.12})`;
        g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = `rgba(${col},${active ? 0.8 : 0.5})`; g.lineWidth = 2; g.setLineDash(active ? [] : [6, 5]);
        g.beginPath(); g.arc(h.x, h.y, active ? h.r : h.r * (0.4 + k * 0.6), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      } else if (h.type === 'beam') {
        g.save(); g.translate(h.x, h.y); g.rotate(h.ang);
        if (active) {
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(200,120,255,0.35)'; g.fillRect(0, -h.w, h.len, h.w * 2);
          g.fillStyle = 'rgba(255,230,255,0.9)'; g.fillRect(0, -h.w * 0.25, h.len, h.w * 0.5);
          g.globalCompositeOperation = 'source-over';
        } else {
          g.strokeStyle = `rgba(230,160,255,${0.3 + k * 0.5})`; g.lineWidth = 2; g.setLineDash([10, 8]);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(h.len, 0); g.stroke(); g.setLineDash([]);
        }
        g.restore();
      }
    }

    // 競技場光圈：外面壓暗，邊緣發光
    if (s.arena) {
      const a = s.arena;
      g.save();
      g.beginPath(); g.rect(camX - 10, camY - 10, VW + 20, vh + 20); g.arc(a.x, a.y, a.r, 0, Math.PI * 2, true);
      g.fillStyle = 'rgba(5,3,14,0.72)'; g.fill('evenodd');
      g.restore();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,120,200,${0.45 + Math.sin(T * 4) * 0.15})`; g.lineWidth = 6;
      g.beginPath(); g.arc(a.x, a.y, a.r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,220,255,0.6)'; g.lineWidth = 1.5; g.stroke();
      g.globalCompositeOperation = 'source-over';
    }

    // 菌根牆（第六章）：粗大的根，表面有刺；朝移動方向那一側發暗紅光（代表會被推著走）
    for (const r of s.roots) {
      g.save(); g.translate(r.x, r.y); g.rotate(Math.atan2(r.ny, r.nx));
      const hw = r.w / 2, hl = r.len / 2;
      g.fillStyle = 'rgba(255,60,60,0.18)'; g.fillRect(hw - 2, -hl, 14, r.len);
      const rg = g.createLinearGradient(-hw, 0, hw, 0); rg.addColorStop(0, '#2a1a0c'); rg.addColorStop(0.5, '#5a3a1a'); rg.addColorStop(1, '#3a2410');
      g.fillStyle = rg; g.fillRect(-hw, -hl, r.w, r.len);
      g.fillStyle = '#8a6a3a';
      for (let y = -hl + 10; y < hl; y += 22) { g.beginPath(); g.moveTo(hw, y); g.lineTo(hw + 9, y + 5); g.lineTo(hw, y + 10); g.fill(); }
      g.strokeStyle = 'rgba(180,230,120,0.35)'; g.lineWidth = 1.5; g.strokeRect(-hw, -hl, r.w, r.len);
      g.restore();
    }
    prof?.lap('地形與危險');
    // 燈暈（在怪物底下）
    const aura = p.weapons.find((w) => w.id === 'aura');
    if (aura?.radius) {
      g.globalCompositeOperation = 'lighter';
      const r = aura.radius * (1 + Math.sin(T * 5) * 0.03);
      g.globalAlpha = 0.55; g.drawImage(G.aura, p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,190,110,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
      if (aura.evo) { // 共鳴「暖陽」：一圈緩慢旋轉的金色光芒
        g.strokeStyle = 'rgba(255,220,120,0.35)'; g.lineWidth = 3;
        for (let i = 0; i < 12; i++) { const a = T * 0.6 + (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(p.x + Math.cos(a) * r * 0.45, p.y + Math.sin(a) * r * 0.45); g.lineTo(p.x + Math.cos(a) * r * 0.95, p.y + Math.sin(a) * r * 0.95); g.stroke(); }
      }
      g.globalCompositeOperation = 'source-over';
    }

    // 經驗晶
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = kG;
    if (!OFF.has('glow')) for (const gm of s.gems) if (onScreen(gm.x, gm.y)) { const k = gm.big ? 2 : 1; g.drawImage(G.gem, gm.x - 12 * k, gm.y - 12 * k, 24 * k, 24 * k); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#bff6ff';
    for (const gm of s.gems) {
      if (!onScreen(gm.x, gm.y)) continue;
      const k = gm.big ? 1.8 : gm.v >= 5 ? 1.35 : 1;
      g.beginPath(); g.moveTo(gm.x, gm.y - 5 * k); g.lineTo(gm.x + 3.5 * k, gm.y); g.lineTo(gm.x, gm.y + 5 * k); g.lineTo(gm.x - 3.5 * k, gm.y); g.fill();
    }

    // 道具
    for (const it of s.pickups) {
      const bob = Math.sin(T * 4 + it.x) * 3;
      g.globalCompositeOperation = 'lighter';
      const gl = it.type === 'chest' ? G.gold : it.type === 'heal' ? G.heal : G.magnet;
      g.globalAlpha = 0.7 + Math.sin(T * 6) * 0.2; g.drawImage(gl, it.x - gl.width / 2, it.y - gl.height / 2 + bob); g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (it.type === 'chest') { // M8 第三輪：燈核上方加一道光柱，遠遠就看得到
        const beam = g.createLinearGradient(0, it.y - 150, 0, it.y);
        beam.addColorStop(0, 'rgba(255,220,120,0)'); beam.addColorStop(1, `rgba(255,220,120,${0.35 + Math.sin(T * 4) * 0.12})`);
        g.globalCompositeOperation = 'lighter'; g.fillStyle = beam; g.fillRect(it.x - 7, it.y - 150, 14, 150); g.globalCompositeOperation = 'source-over';
        g.drawImage(chestImg, it.x - 20, it.y - 22 + bob);
      }
      else { const ic = makeIcon(it.type === 'heal' ? 'heal' : 'stone', it.type === 'heal' ? '#ff9fb4' : '#7fd6ff', 24); g.drawImage(ic, it.x - 12, it.y - 12 + bob); }
    }

    prof?.lap('光屑與道具');
    // 玩家的落星預警（粉紅虛線圈，越接近落下越實）與地上的燈籠雷
    for (const k of s.strikes) {
      const q = Math.max(0, 1 - k.t / k.delay);
      g.fillStyle = k.evo ? `rgba(255,210,120,${0.1 + q * 0.2})` : `rgba(255,150,240,${0.08 + q * 0.18})`; g.beginPath(); g.arc(k.x, k.y, k.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = k.evo ? 'rgba(255,230,160,0.9)' : 'rgba(255,190,245,0.8)'; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.arc(k.x, k.y, k.r * (1.4 - q * 0.4), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    for (const m of s.mines) {
      const armed = m.arm <= 0, pulse = armed ? 0.7 + Math.sin(T * 6 + m.x) * 0.3 : 0.35;
      g.globalCompositeOperation = 'lighter'; if (m.evo) { g.globalAlpha = pulse * kE; g.drawImage(G.evo, m.x - 22, m.y - 22, 44, 44); } g.globalAlpha = pulse; g.drawImage(G.lantern, m.x - 14, m.y - 14); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = armed ? (m.evo ? '#fff0b0' : '#ffd84a') : '#8a7a3a'; g.beginPath(); g.ellipse(m.x, m.y, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill();
    }
    // 燈塔哨：小燈塔＋頂端的光（快熄滅時閃爍）；共鳴後多一圈金光
    for (const q of s.sentries) {
      const fade = q.life < 2 ? 0.4 + Math.sin(T * 20) * 0.3 : 1, evo = q.src.evo;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade * (evo ? kE : 1); g.drawImage(evo ? G.evo : G.sentry, q.x - 18, q.y - 30, 36, 36); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = evo ? '#8a6a2a' : '#2a5a3a'; g.beginPath(); g.moveTo(q.x - 6, q.y + 6); g.lineTo(q.x - 3, q.y - 10); g.lineTo(q.x + 3, q.y - 10); g.lineTo(q.x + 6, q.y + 6); g.closePath(); g.fill();
      g.fillStyle = evo ? '#fff0b0' : '#d8ffe0'; g.fillRect(q.x - 3.5, q.y - 15, 7, 5);
    }
    // M8 第四輪：地上的燼痕（暗紅底＋閃爍的火點）與蝕光井（深色的洞＋旋轉的光弧）。
    // 大面積一律用一般疊加（不加亮）：大片加亮會讓整個畫面發白、蓋掉角色（glow-check 量的就是這件事）
    for (const q of s.patches) {
      if (!onScreen(q.x, q.y, q.r)) continue;
      const k = Math.min(1, q.life / 0.6, (q.max - q.life) / 0.15 + 0.3);
      if (q.dust) { // 星塵（增幅）：淡粉紅的星點區，和燼痕的暗紅分得開
        g.fillStyle = `rgba(120,50,110,${0.3 * k})`; g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(255,190,245,${0.8 * k})`; for (let i = 0; i < 5; i++) { const a = q.x * 0.3 + i * 1.26 + T * 1.5, rr = q.r * (0.25 + 0.14 * i); g.fillRect(q.x + Math.cos(a) * rr - 1.5, q.y + Math.sin(a) * rr - 1.5, 3, 3); }
        continue;
      }
      g.fillStyle = q.evo ? `rgba(150,60,20,${0.4 * k})` : `rgba(110,35,15,${0.38 * k})`; g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = q.evo ? `rgba(255,200,110,${0.7 * k})` : `rgba(255,120,50,${0.6 * k})`;
      for (let i = 0; i < 3; i++) { const a = q.x * 0.7 + i * 2.1 + T * 3, rr = q.r * (0.3 + 0.2 * i); g.fillRect(q.x + Math.cos(a) * rr - 1.5, q.y + Math.sin(a) * rr - 1.5, 3, 3); }
    }
    for (const v of s.vortices) {
      if (!onScreen(v.x, v.y, v.st.r)) continue;
      if (v.fly > 0) { g.fillStyle = v.evo ? '#ffe6a0' : '#d8c0ff'; g.beginPath(); g.arc(v.x, v.y, 5, 0, Math.PI * 2); g.fill(); continue; }
      const R = v.st.r * Math.min(1, v.t / 0.2 + 0.2), spin = T * (v.evo ? 7 : 5);
      const hole = g.createRadialGradient(v.x, v.y, 2, v.x, v.y, R);
      hole.addColorStop(0, 'rgba(8,2,20,0.85)'); hole.addColorStop(0.55, v.evo ? 'rgba(70,40,20,0.45)' : 'rgba(50,20,90,0.45)'); hole.addColorStop(1, 'rgba(40,10,70,0)');
      g.fillStyle = hole; g.beginPath(); g.arc(v.x, v.y, R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = v.evo ? 'rgba(255,215,130,0.8)' : 'rgba(190,150,255,0.75)'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = spin + i * 2.094, rr = R * (0.45 + 0.18 * i); g.beginPath(); g.arc(v.x, v.y, rr, a, a + 1.4); g.stroke(); }
    }
    // 預警：衝刺／撲擊的路線、自爆範圍、瞬移落點
    for (const e of s.enemies) {
      if (e.tele) {
        const w = e.tele.w ?? e.r;
        g.save(); g.translate(e.x, e.y); g.rotate(Math.atan2(e.tele.dy, e.tele.dx));
        g.fillStyle = `rgba(255,60,120,${0.18 + Math.sin(T * 30) * 0.08})`; g.fillRect(0, -w, e.tele.len, w * 2);
        g.strokeStyle = 'rgba(255,120,170,0.7)'; g.lineWidth = 1.5; g.strokeRect(0, -w, e.tele.len, w * 2);
        g.restore();
      }
      if (e.fuse > 0) {
        const R = ENEMIES[e.kind].blastR;
        g.fillStyle = `rgba(255,140,60,${0.12 + Math.sin(T * 25) * 0.08})`; g.beginPath(); g.arc(e.x, e.y, R, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,170,90,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, R * (1 - e.fuse / ENEMIES[e.kind].fuse), 0, Math.PI * 2); g.stroke();
      }
      if (e.warn) {
        const q = 1 - e.warn.t / ENEMIES[e.kind].blinkWarn;
        g.strokeStyle = `rgba(255,150,255,${0.4 + q * 0.5})`; g.lineWidth = 2;
        g.beginPath(); g.arc(e.warn.x, e.warn.y, 16 - q * 8, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(e.warn.x - 10, e.warn.y); g.lineTo(e.warn.x + 10, e.warn.y); g.moveTo(e.warn.x, e.warn.y - 10); g.lineTo(e.warn.x, e.warn.y + 10); g.stroke();
      }
    }

    prof?.lap('預警');
    // 敵人、晶柱、玩家一起依 y 排序，前後遮擋才自然
    const vis = s.enemies.filter((e) => onScreen(e.x, e.y, e.r * 2));
    if (ter === 'pillars') for (const f of terrainIn('pillars', s.terrainSeed, camX - 60, camY - 40, camX + VW + 60, camY + vh + 90)) vis.push({ pillar: f, y: f.y });
    vis.sort((a, b) => a.y - b.y);
    for (const e of vis) {
      if (e.pillar) {
        const f = e.pillar, img = makePillar(f.r), k = f.r / (Math.round(f.r / 3) * 3);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + Math.sin(T * 2 + f.x) * 0.1;
        g.drawImage(G.crystal, f.x - f.r * 1.8, f.y - f.r * 2.4, f.r * 3.6, f.r * 3.6); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.drawImage(img, f.x - img.width / 2 * k, f.y - img.height / 2 * k, img.width * k, img.height * k);
        continue;
      }
      const sp = sprites[e.kind], img = sp.frames[Math.floor(e.frame) % sp.frames.length];
      const k = e.r / ENEMIES[e.kind].r, size = sp.size * k;
      const boss = ENEMIES[e.kind].ai === 'boss';
      if ((e.elite || boss) && !OFF.has('glow')) {
        g.globalCompositeOperation = 'lighter';
        const gl = boss ? G.boss : G['elite_' + e.affix];
        const pr = e.r * (2.2 + Math.sin(T * 5) * 0.15);
        g.globalAlpha = 0.6; g.drawImage(gl, e.x - pr, e.y - pr, pr * 2, pr * 2); g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      if (e.slowT > 0 && !OFF.has('filter')) g.filter = 'hue-rotate(40deg)';
      g.drawImage(img, e.x - size / 2, e.y - size / 2, size, size);
      g.filter = 'none';
      if (e.rushT > 0) { g.strokeStyle = 'rgba(255,190,120,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); g.stroke(); } // 脹孢囊被遠處射中：外殼硬化、衝過來
      if (e.stunT > 0) { g.strokeStyle = 'rgba(255,235,150,0.85)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(e.x, e.y - e.r - 6, e.r * 0.8, 3, 0, 0, Math.PI * 2); g.stroke(); } // 震心：頭上一圈暈眩
      if (e.burnT > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 + Math.sin(T * 20 + e.seed) * 0.3; g.drawImage(G.ember, e.x - 7, e.y - e.r - 12, 14, 14); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (e.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8; g.drawImage(img, e.x - size / 2, e.y - size / 2, size, size); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (e.elite) { // 精英血條
        const w = e.r * 2;
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
        g.fillStyle = AFFIX_COLOR[e.affix]; g.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    prof?.lap('怪物與角色');
    // 子彈、光球、電弧、粒子（加亮疊加）
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const b of s.bullets) {
      if (!onScreen(b.x, b.y)) continue;
      if (b.evo && !b.big && !OFF.has('glow')) { const r = (b.size ?? 8) * 2.2 + 8; g.globalAlpha = kE; g.drawImage(G.evo, b.x - r, b.y - r, r * 2, r * 2); g.globalAlpha = 1; } // 共鳴後的投射物：一律多一層金色光暈
      if (b.boom) { // 旋轉的新月光刃
        const k = b.size / 11;
        if (b.evo) for (const [back, al] of [[0.05, 0.45], [0.1, 0.22]]) { g.globalAlpha = al * kE; g.drawImage(G.evo, b.x - b.vx * back - 18 * k, b.y - b.vy * back - 18 * k, 36 * k, 36 * k); } // 共鳴：殘影
        g.globalAlpha = 1;
        g.drawImage(G.blade, b.x - 18 * k, b.y - 18 * k, 36 * k, 36 * k);
        g.save(); g.translate(b.x, b.y); g.rotate(T * 14); g.fillStyle = b.evo ? 'rgba(255,245,200,0.98)' : 'rgba(220,255,240,0.95)';
        g.beginPath(); g.arc(0, 0, b.size, 0, Math.PI); g.arc(0, -b.size * 0.3, b.size * 0.75, Math.PI, 0, true); g.closePath(); g.fill(); g.restore();
        continue;
      }
      if (b.burn) {
        g.drawImage(G.ember, b.x - 14, b.y - 14, 28, 28); g.strokeStyle = 'rgba(255,200,140,0.95)'; g.lineWidth = b.evo ? 5 : 3; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * (b.evo ? 0.05 : 0.03), b.y - b.vy * (b.evo ? 0.05 : 0.03)); g.stroke();
        if (b.evo && Math.random() < 0.3) burst(b.x, b.y, 1, G.ember, 40, 0.3, 8); // 共鳴「焚天羽」：一路掉火星（受粒子上限限制）
        continue;
      }
      if (b.sentry) { g.drawImage(b.evo ? G.evo : G.sentry, b.x - 10, b.y - 10, 20, 20); g.strokeStyle = b.evo ? 'rgba(255,240,190,0.95)' : 'rgba(200,255,210,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.stroke(); continue; }
      if (b.star) { g.drawImage(G.star, b.x - 14, b.y - 14); g.fillStyle = '#eaffff'; g.beginPath(); g.arc(b.x, b.y, 3, 0, 7); g.fill(); continue; }
      if (b.rico) { // 折光彈：菱形光片＋長拖尾（反彈時的折線看得出來）
        g.drawImage(G.rico, b.x - 12, b.y - 12, 24, 24);
        g.strokeStyle = b.evo ? 'rgba(255,240,190,0.85)' : 'rgba(170,255,240,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.06, b.y - b.vy * 0.06); g.stroke();
        g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx)); g.fillStyle = b.evo ? '#fff6d0' : '#e0fff8';
        g.beginPath(); g.moveTo(6, 0); g.lineTo(0, 3.5); g.lineTo(-6, 0); g.lineTo(0, -3.5); g.closePath(); g.fill(); g.restore();
        continue;
      }
      const k = b.big ? 1.8 : b.src === 'shard' ? 0.6 : 1;
      if (!OFF.has('glow')) g.drawImage(G.bolt, b.x - 14 * k, b.y - 14 * k, 28 * k, 28 * k);
      g.strokeStyle = b.big ? 'rgba(255,250,220,0.95)' : 'rgba(255,240,200,0.9)'; g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.025 * k, b.y - b.vy * 0.025 * k); g.stroke();
    }
    for (const w of p.weapons) {
      for (const q of w.wisps) {
        if (w.evo) { g.globalAlpha = kE; g.drawImage(G.evo, q.x - 16, q.y - 16, 32, 32); g.globalAlpha = 1; if (Math.random() < 0.15) burst(q.x, q.y, 1, G.evo, 30, 0.3, 7); } // 共鳴「螢群」：金色、拖著光點
        g.drawImage(G.wisp, q.x - 12, q.y - 12); g.fillStyle = w.evo ? '#fff6c8' : '#f6ffc0'; g.beginPath(); g.arc(q.x, q.y, 2.6, 0, 7); g.fill();
      }
      if (w.flame) { // 火焰錐：從玩家往火口方向，半透明漸層＋閃爍
        const f = w.flame, a = Math.atan2(f.ay, f.ax), flick = 0.85 + Math.random() * 0.25;
        const gr = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, f.range * flick);
        gr.addColorStop(0, 'rgba(255,240,180,0.55)'); gr.addColorStop(0.5, 'rgba(255,150,60,0.35)'); gr.addColorStop(1, 'rgba(255,80,30,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, f.range * flick, a - f.half, a + f.half); g.closePath(); g.fill();
        if (w.evo) { // 共鳴「龍焰」：中心一道白金色的焰心
          const core = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, f.range * 0.7 * flick);
          core.addColorStop(0, 'rgba(255,255,230,0.7)'); core.addColorStop(1, 'rgba(255,220,120,0)');
          g.fillStyle = core; g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, f.range * 0.7 * flick, a - f.half * 0.5, a + f.half * 0.5); g.closePath(); g.fill();
        }
      }
    }
    for (const w of p.weapons) if (w.orbs) for (const o of w.orbs) {
      const r = w.evo ? 26 : 20;
      if (!OFF.has('glow')) g.drawImage(G.orb, o.x - r, o.y - r, r * 2, r * 2);
      g.fillStyle = w.evo ? '#fff' : '#dffaff'; g.beginPath(); g.arc(o.x, o.y, w.evo ? 6 : 4.5, 0, 7); g.fill();
    }
    for (const l of fx.lances) { // 聚光槍：一道瞬間的光束（共鳴後金色、更寬）
      g.globalAlpha = l.life / 0.22; g.save(); g.translate(l.x, l.y); g.rotate(l.ang);
      g.fillStyle = l.evo ? 'rgba(255,220,130,0.45)' : 'rgba(120,190,255,0.4)'; g.fillRect(0, -l.w, l.len, l.w * 2);
      g.fillStyle = l.evo ? 'rgba(255,250,220,0.95)' : 'rgba(225,245,255,0.95)'; g.fillRect(0, -l.w * 0.22, l.len, l.w * 0.44);
      g.restore();
    }
    g.globalAlpha = 1;
    // M8 第四輪：劍氣（往前凸的新月光弧，越飛越寬）、光牆（一道厚光帶）、遠星的彈道（細線＋落點圈）——一般疊加，不加亮
    g.globalCompositeOperation = 'source-over';
    for (const q of s.slashes) {
      const half = q.st.w0 + (q.st.w1 - q.st.w0) * Math.min(1, q.d / q.st.range), cx = q.x0 + q.dx * q.d, cy = q.y0 + q.dy * q.d, fade = Math.min(1, q.d / 70, (q.st.range - q.d) / 60); // 從玩家身上長出來：剛出手時淡，不在角色周圍堆一片亮光（glow-check）
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(q.dy, q.dx)); g.globalAlpha = fade;
      g.fillStyle = q.evo ? 'rgba(255,215,130,0.5)' : 'rgba(150,225,255,0.45)';
      g.beginPath(); g.moveTo(-6, -half); g.quadraticCurveTo(16, 0, -6, half); g.quadraticCurveTo(4, 0, -6, -half); g.fill();
      g.strokeStyle = q.evo ? 'rgba(255,250,220,0.95)' : 'rgba(235,250,255,0.95)'; g.lineWidth = q.evo ? 3.5 : 2.5;
      g.beginPath(); g.moveTo(-6, -half); g.quadraticCurveTo(16, 0, -6, half); g.stroke();
      g.restore();
    }
    for (const q of s.walls) {
      const cx = q.x0 + q.dx * q.d, cy = q.y0 + q.dy * q.d, L = q.st.len, fade = Math.min(1, q.d / 70, (q.st.range - q.d) / 50);
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(q.dy, q.dx)); g.globalAlpha = fade;
      g.fillStyle = q.evo ? 'rgba(255,210,120,0.35)' : 'rgba(255,230,170,0.3)'; g.fillRect(-14, -L, 14, L * 2);
      g.fillStyle = q.evo ? 'rgba(255,245,200,0.95)' : 'rgba(255,245,215,0.9)'; g.fillRect(-2, -L, 4, L * 2);
      g.restore();
    }
    for (const l of fx.snipes) {
      g.globalAlpha = l.life / 0.25;
      g.strokeStyle = l.evo ? 'rgba(255,230,150,0.9)' : 'rgba(170,195,255,0.9)'; g.lineWidth = l.evo ? 2.5 : 1.5;
      g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(l.tx, l.ty); g.stroke();
      g.lineWidth = 2.5; g.beginPath(); g.arc(l.tx, l.ty, l.r * (1.2 - l.life / 0.25 * 0.5), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
    for (const a of fx.arcs) {
      g.globalAlpha = a.life / 0.18;
      for (const [lw, col] of a.evo ? [[8, 'rgba(255,210,120,0.5)'], [3, 'rgba(255,250,225,1)']] : [[5, 'rgba(160,120,255,0.5)'], [2, 'rgba(235,225,255,1)']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
        for (let i = 0; i < a.pts.length - 1; i++) {
          const [x0, y0] = a.pts[i], [x1, y1] = a.pts[i + 1];
          if (i === 0) g.moveTo(x0, y0);
          for (let j = 1; j <= 4; j++) { const t = j / 4; g.lineTo(x0 + (x1 - x0) * t + (j < 4 ? (Math.random() - 0.5) * 12 : 0), y0 + (y1 - y0) * t + (j < 4 ? (Math.random() - 0.5) * 12 : 0)); }
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (const b of s.ebullets) {
      if (!onScreen(b.x, b.y)) continue;
      const r = b.r * 2.6; if (!OFF.has('glow')) g.drawImage(b.frost ? G.frost : G.spore, b.x - r, b.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (const b of s.ebullets) { if (!onScreen(b.x, b.y)) continue; g.fillStyle = b.frost ? '#e8f8ff' : '#ffd6f4'; g.beginPath(); g.arc(b.x, b.y, b.r * 0.6, 0, 7); g.fill(); g.strokeStyle = b.frost ? '#3a7aaa' : '#8a1a6a'; g.lineWidth = 1.5; g.stroke(); }
    g.globalCompositeOperation = 'lighter';
    for (const r of fx.rings) {
      const t = 1 - r.life / (r.color === 'magnet' ? 0.5 : 0.35);
      g.strokeStyle = r.color === 'gold' || r.color === 'pulseEvo' || r.color === 'sun' ? `rgba(255,220,130,${r.life * 2.5})` : r.color === 'pulse' ? `rgba(255,235,160,${r.life * 2.2})` : r.color === 'strike' ? `rgba(255,170,245,${r.life * 2.5})` : r.color === 'blast' ? `rgba(255,170,80,${r.life * 2.5})` : r.color === 'spore' ? `rgba(255,90,200,${r.life * 2})` : r.color === 'magnet' ? `rgba(120,200,255,${r.life * 2})` : r.color === 'void' ? `rgba(190,150,255,${r.life * 2.5})` : `rgba(255,190,110,${r.life})`;
      g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, r.color ? r.r * t : r.r, 0, Math.PI * 2); g.stroke();
    }
    if (!OFF.has('particles')) for (const q of fx.parts) { g.globalAlpha = Math.min(1, q.life / 0.3) * (q.img === G.evo ? kE : kP); g.drawImage(q.img, q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 角色永遠畫在所有特效之上（M8）：先壓一圈柔和的暗底再畫角色，特效再多角色都看得見
    g.drawImage(G.shade, p.x - 28, p.y - 26, 56, 56);
    drawPlayer(g, p.x, p.y, T, p.facing, p.hurtT > 0.4); prof?.mark?.('player', p.x, p.y);
    if (p.slowT > 0) { g.strokeStyle = `rgba(180,230,255,${0.4 + Math.sin(T * 10) * 0.2})`; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(p.x, p.y, 17, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); } // 被冰針減速

    prof?.lap('子彈與特效');
    // 傷害數字
    g.textAlign = 'center';
    for (const q of fx.texts) {
      g.font = q.big ? '800 13px system-ui' : 'bold 10px system-ui';
      g.globalAlpha = Math.min(1, q.life * 3); g.fillStyle = q.big ? '#ffe27a' : '#fff'; g.strokeStyle = '#1a0a22'; g.lineWidth = 2.5;
      g.strokeText(q.v, q.x, q.y); g.fillText(q.v, q.x, q.y);
    }
    g.globalAlpha = 1;

    prof?.lap('飄字');
    // 螢幕空間：霧、暗角、受傷紅框、白閃
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (s.chapter.fog && !OFF.has('fog')) { // 霧：以玩家為中心，瞄準距離外逐漸看不清
      const px = (p.x - camX) * scale, py = (p.y - camY) * scale;
      if (OFF.has('cache')) { // 優化前的舊做法（A/B 對照用）
        const R = s.chapter.fog * scale, fg = g.createRadialGradient(px, py, R * 0.55, px, py, R * 1.25);
        fg.addColorStop(0, 'rgba(160,190,175,0)'); fg.addColorStop(0.6, 'rgba(90,120,105,0.45)'); fg.addColorStop(1, 'rgba(40,58,50,0.88)');
        g.fillStyle = fg; g.fillRect(0, 0, W, H);
      } else g.drawImage(C.fog, px - W / 2 - C.fogM, py - H / 2 - C.fogM);
      g.globalAlpha = 0.18;
      const br = C.blob.width / 2;
      for (let i = 0; i < 5; i++) { // 緩慢飄動的霧團
        const fx0 = ((i * 173 + T * (8 + i * 3)) % (W + 400)) - 200, fy0 = ((i * 311) % H);
        g.drawImage(C.blob, fx0 - br, fy0 - br);
      }
      g.globalAlpha = 1;
    }
    prof?.lap('霧');
    if (OFF.has('cache')) { // 優化前的舊做法（A/B 對照用）
      const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vig.addColorStop(0, 'rgba(5,4,13,0)'); vig.addColorStop(1, 'rgba(5,4,13,0.75)');
      g.fillStyle = vig; g.fillRect(0, 0, W, H);
    } else if (!OFF.has('vignette')) g.drawImage(C.vig, 0, 0);
    const lowHp = p.hp / p.maxHp < 0.3 ? 0.25 + Math.sin(T * 6) * 0.1 : 0;
    const red = Math.max(fx.hurtFlash, lowHp);
    if (red > 0) {
      g.globalAlpha = Math.min(1, red); g.drawImage(C.red, 0, 0); g.globalAlpha = 1;
    }
    if (fx.whiteFlash > 0) { g.fillStyle = `rgba(255,245,220,${fx.whiteFlash * 0.6})`; g.fillRect(0, 0, W, H); }

    prof?.lap('暗角與閃光');
    if (hud) renderHud(g, s, W, H, scale, camX, camY, vh, safeTop); // 主選單背景的展示局不畫 HUD，免得疊到標題
    prof?.lap('HUD');
    return { guides: lastGuides };
  }

  function renderHud(g, s, W, H, k, camX, camY, vh, safeTop) {
    const p = s.player, T = s.t;
    g.setTransform(k, 0, 0, k, 0, 0);
    const w = W / k, h = H / k;
    const top = 6 + safeTop; // safeTop：手機瀏海高度（邏輯單位）
    // 經驗條
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, safeTop, w, 7);
    const xg = g.createLinearGradient(0, 0, w, 0); xg.addColorStop(0, '#4fd8ff'); xg.addColorStop(1, '#b77bff');
    g.fillStyle = xg; g.fillRect(0, safeTop, w * (p.xp / p.xpNext), 7);
    g.font = '700 14px system-ui'; g.fillStyle = '#e9ecff'; g.textAlign = 'left';
    shadowText(g, `Lv ${p.level}`, 10, top + 20);
    // 時間：顯示距離燈塔守衛出現還有多久
    g.textAlign = 'center';
    const left = Math.max(0, s.chapter.bossAt - T);
    const clock = s.boss || s.arena ? '燈塔守衛' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    g.font = '700 16px system-ui'; shadowText(g, clock, w / 2, top + 21);
    g.font = '600 10px system-ui'; g.fillStyle = '#9aa3d6'; shadowText(g, s.boss || s.arena ? '' : '距離燈塔守衛', w / 2, top + 33);
    // 擊倒次數放在左上、等級旁邊：右上角留給倍速鍵與暫停鍵（M7 以前畫在右上，會被倍速鍵蓋住）
    g.textAlign = 'left'; g.font = '600 13px system-ui'; g.fillStyle = '#e9ecff'; shadowText(g, `擊倒 ${s.kills}`, 64, top + 20);

    // 裝備列
    let x = 8; const y = top + 30, S = 18;
    for (const wp of p.weapons) { drawSlot(g, makeIcon(wp.id, WEAPONS[wp.id].color, 36), x, y, S, wp.evo ? '★' : wp.lv); x += S + 3; }
    x += 4;
    for (const [id, lv] of Object.entries(p.passives)) { drawSlot(g, makeIcon(id, PASSIVES[id].color, 36), x, y, S, lv); x += S + 3; }
    const ly = y + S + 14 + (s.boss ? 20 : 0); // 守衛血條（top＋58）出現時，羈絆與屬性這一行往下移，不疊在血條上
    if (s.bonds?.length) { g.textAlign = 'left'; g.font = '700 11px system-ui'; g.fillStyle = '#ffd98a'; shadowText(g, '♦ ' + s.bonds.map((b) => BONDS[b].name).join('・'), 8, ly); } // 成立的羈絆
    // 屬性（M8 第五輪第三批）：這一關的屬性、目前的職業有沒有對上（右邊，和羈絆同一行；文字從 AFFINITY 算出來）
    const ea = AFFINITIES[AFFINITY.eco[s.chapter.id]];
    if (ea) { g.textAlign = 'right'; g.font = '700 11px system-ui'; g.fillStyle = s.affinity ? ea.color : '#9aa3d6'; shadowText(g, s.affinity ? `屬性 ${ea.name} ✓ 傷害 +${Math.round((AFFINITY.dmgMul - 1) * 100)}%` : `屬性 ${ea.name}（沒對上）`, w - 8, ly); }

    // 頭上血條
    const px = w / 2, py = h / 2 - 32;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(px - 20, py, 40, 5);
    g.fillStyle = p.hp / p.maxHp > 0.3 ? '#6dff9a' : '#ff5a6e'; g.fillRect(px - 20, py, 40 * p.hp / p.maxHp, 5);

    // Boss 血條
    if (s.boss) {
      const b = s.boss, bw = w - 40, by = top + 58;
      g.fillStyle = 'rgba(10,4,20,0.8)'; g.fillRect(20, by, bw, 10);
      const bg = g.createLinearGradient(20, 0, 20 + bw, 0); bg.addColorStop(0, '#ff4fa8'); bg.addColorStop(1, '#ffb05a');
      g.fillStyle = bg; g.fillRect(20, by, bw * Math.max(0, b.hp / b.maxHp), 10);
      g.strokeStyle = 'rgba(255,200,240,0.6)'; g.lineWidth = 1; g.strokeRect(20, by, bw, 10);
      g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffd6f0'; shadowText(g, ENEMIES[b.kind].name, w / 2, by - 3);
    }

    // 燈核指引（M8 第三輪，src/guide.js）：畫面內→上方跳動的「燈核」字樣；畫面外→邊緣的大箭頭＋距離。位置全部照 chestGuides 的結果畫
    const guides = chestGuides(s.pickups, p, camX, camY, w, h, GUIDE.hudTop + safeTop), pulse = 0.75 + Math.sin(T * 6) * 0.25;
    for (const gd of guides) {
      g.font = '800 12px system-ui'; g.textAlign = 'center';
      if (gd.onScreen) {
        const yy = gd.sy - 40 + Math.sin(T * 5) * 4;
        g.fillStyle = '#ffe27a'; shadowText(g, gd.reso ? '共鳴燈核' : '燈核', gd.sx, yy);
        g.beginPath(); g.moveTo(gd.sx - 6, yy + 5); g.lineTo(gd.sx + 6, yy + 5); g.lineTo(gd.sx, yy + 12); g.closePath(); g.fill();
        continue;
      }
      g.fillStyle = `rgba(20,12,40,${0.75 * pulse})`; g.beginPath(); g.arc(gd.ex, gd.ey, 19, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(255,220,120,${pulse})`; g.lineWidth = 2; g.stroke();
      g.save(); g.translate(gd.ex, gd.ey); g.rotate(gd.angle);
      g.fillStyle = `rgba(255,214,100,${pulse})`; g.beginPath(); g.moveTo(16, 0); g.lineTo(4, -9); g.lineTo(4, 9); g.closePath(); g.fill();
      g.restore();
      g.drawImage(chestImg, gd.ex - 10, gd.ey - 11, 20, 22);
      g.fillStyle = '#ffe9a8'; shadowText(g, `${gd.reso ? '共鳴 ' : ''}${Math.round(gd.dist / 10)}m`, gd.ex, gd.ey + (gd.ey > h / 2 ? -24 : 32));
    }
    lastGuides = guides;

    // 升級字樣
    if (fx.levelFlash > 0) {
      g.globalAlpha = Math.min(1, fx.levelFlash * 2); g.font = '800 22px system-ui'; g.textAlign = 'center';
      g.fillStyle = '#ffe9a8'; shadowText(g, '等級提升！', w / 2, h / 2 - 50 - (1 - fx.levelFlash) * 20); g.globalAlpha = 1;
    }
    // 橫幅
    let by = h * 0.28;
    for (const b of fx.banners) {
      const t = b.life / b.max, a = Math.min(1, (1 - t) * 6, t * 3);
      g.globalAlpha = a; g.textAlign = 'center';
      g.fillStyle = b.big ? 'rgba(60,0,40,0.75)' : 'rgba(10,8,30,0.7)'; g.fillRect(0, by - (b.big ? 26 : 18), w, b.big ? 40 : 28);
      g.font = b.big ? '800 20px system-ui' : '700 14px system-ui'; g.fillStyle = b.big ? '#ffc6ec' : '#ffe9a8';
      shadowText(g, b.text, w / 2, by);
      g.globalAlpha = 1; by += 44;
    }
  }

  return { render };
}

function shadowText(g, t, x, y) {
  const c = g.fillStyle; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(t, x + 1, y + 1); g.fillStyle = c; g.fillText(t, x, y);
}
function drawSlot(g, icon, x, y, S, lv) {
  g.drawImage(icon, x, y, S, S);
  g.font = '800 8px system-ui'; g.textAlign = 'right'; g.fillStyle = lv === '★' ? '#ffe27a' : '#fff';
  shadowText(g, String(lv), x + S + 1, y + S);
}
