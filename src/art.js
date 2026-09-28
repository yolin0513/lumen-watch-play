// 程序化美術：所有圖都在這裡用 Canvas 畫出來並快取成離屏圖，遊戲迴圈只做 drawImage。
// 不使用任何外部圖檔。

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

// 發光光暈（用 'lighter' 疊加畫）
const glowCache = new Map();
export function glow(color, r) {
  const key = color + r;
  let c = glowCache.get(key);
  if (c) return c;
  c = canvas(r * 2, r * 2);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.45)'));
  grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grd;
  g.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, c);
  return c;
}

// 地面：可平鋪的程序化紋理（蝕光苔原）
export function makeGround(palette, seed = 7) {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = palette.base; g.fillRect(0, 0, S, S);
  // 在 3x3 位置重複畫，確保邊界無縫
  const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
  for (let i = 0; i < 28; i++) {
    const x = r() * S, y = r() * S, rad = 40 + r() * 110, col = r() < 0.5 ? palette.blotchA : palette.blotchB;
    wrap(() => { const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); });
  }
  // 裂紋
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 18; y += Math.sin(a) * 18; pts.push([x, y]); }
    wrap(() => { g.strokeStyle = palette.crack; g.lineWidth = 1.5; g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); });
  }
  // 小晶體
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, h = 3 + r() * 7, w = h * 0.45;
    wrap(() => {
      g.fillStyle = palette.crystal; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y); g.lineTo(x, y + h * 0.4); g.lineTo(x - w, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 0.5, y - h * 0.7, 1, h * 0.5);
    });
  }
  // 草點
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S;
    g.fillStyle = r() < 0.5 ? palette.dotA : palette.dotB;
    g.fillRect(x, y, 1.5, 1.5);
  }
  return c;
}

// 蝕菌怪物：程序生成的身體（多邊形＋棘刺＋發光眼），預先畫出多個蠕動影格
export function makeCreature({ seed, radius, hue, spikes = 0, eyes = 1, frames = 4, scale = 2 }) {
  const out = [];
  const pad = radius * 0.8;
  const size = (radius + pad) * 2;
  for (let f = 0; f < frames; f++) {
    const r = rng(seed); // 每格同一 seed → 同一隻怪，只有相位不同
    const c = canvas(size * scale, size * scale), g = c.getContext('2d');
    g.scale(scale, scale); g.translate(size / 2, size / 2);
    const phase = (f / frames) * Math.PI * 2;
    const n = 12, pts = [];
    const lobes = 2 + Math.floor(r() * 3), lobeAmp = 0.06 + r() * 0.1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = radius * (1 + Math.sin(a * lobes + phase) * lobeAmp + (r() - 0.5) * 0.12);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    // 棘刺
    if (spikes) {
      g.fillStyle = `hsl(${hue},45%,22%)`;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + Math.sin(phase + i) * 0.08;
        const l = radius * (1.35 + r() * 0.25);
        g.beginPath();
        g.moveTo(Math.cos(a - 0.22) * radius * 0.85, Math.sin(a - 0.22) * radius * 0.85);
        g.lineTo(Math.cos(a) * l, Math.sin(a) * l);
        g.lineTo(Math.cos(a + 0.22) * radius * 0.85, Math.sin(a + 0.22) * radius * 0.85);
        g.fill();
      }
    }
    // 影子
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(0, radius * 0.75, radius * 0.95, radius * 0.35, 0, 0, Math.PI * 2); g.fill();
    // 身體（平滑曲線）
    const path = new Path2D();
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      i === 0 ? path.moveTo(mx, my) : path.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const body = g.createRadialGradient(-radius * 0.3, -radius * 0.4, radius * 0.1, 0, 0, radius * 1.1);
    body.addColorStop(0, `hsl(${hue},70%,62%)`);
    body.addColorStop(0.6, `hsl(${hue},60%,38%)`);
    body.addColorStop(1, `hsl(${hue + 20},55%,18%)`);
    g.fillStyle = body; g.fill(path);
    g.lineWidth = Math.max(1.5, radius * 0.1); g.strokeStyle = `hsl(${hue + 20},60%,10%)`; g.stroke(path);
    // 斑點
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, d = r() * radius * 0.6;
      g.fillStyle = `hsla(${hue - 30},80%,70%,0.25)`;
      g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, radius * (0.08 + r() * 0.1), 0, Math.PI * 2); g.fill();
    }
    // 發光眼
    const eyeY = -radius * 0.15;
    for (let i = 0; i < eyes; i++) {
      const ex = eyes === 1 ? 0 : (i / (eyes - 1) - 0.5) * radius * 0.9;
      const er = radius * (eyes === 1 ? 0.32 : 0.2);
      const blink = f === frames - 1 && r() < 0.5 ? 0.35 : 1;
      g.fillStyle = `hsl(${hue + 160},100%,65%)`;
      g.shadowColor = `hsl(${hue + 160},100%,60%)`; g.shadowBlur = radius * 0.6;
      g.beginPath(); g.ellipse(ex, eyeY, er, er * blink, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#10061a';
      g.beginPath(); g.ellipse(ex, eyeY, er * 0.4, er * 0.55 * blink, 0, 0, Math.PI * 2); g.fill();
    }
    // 高光
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.beginPath(); g.ellipse(-radius * 0.38, -radius * 0.5, radius * 0.22, radius * 0.12, -0.6, 0, Math.PI * 2); g.fill();
    out.push(c);
  }
  return { frames: out, size, scale };
}

// 主角「燈芯守望者」：每幀即時繪製（只有一個，成本低）
export function drawPlayer(g, x, y, t, facing, hurt) {
  g.save(); g.translate(x, y);
  // 影子
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(0, 16, 15, 5, 0, 0, Math.PI * 2); g.fill();
  const bob = Math.sin(t * 8) * 1.2;
  g.translate(0, bob);
  // 斗篷
  g.fillStyle = hurt ? '#ffffff' : '#2b3a7a';
  g.beginPath(); g.moveTo(-13, 14); g.quadraticCurveTo(-15, -4, 0, -16); g.quadraticCurveTo(15, -4, 13, 14); g.quadraticCurveTo(0, 18, -13, 14); g.fill();
  g.fillStyle = hurt ? '#ffffff' : '#3f55a8';
  g.beginPath(); g.moveTo(-8, 12); g.quadraticCurveTo(-9, -4, 0, -13); g.quadraticCurveTo(9, -4, 8, 12); g.closePath(); g.fill();
  // 臉（兜帽內）
  g.fillStyle = '#0d0a1c'; g.beginPath(); g.ellipse(facing * 2, -5, 6.5, 5.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffe9a8'; g.fillRect(facing * 2 - 3.5, -6, 2, 2.2); g.fillRect(facing * 2 + 1.5, -6, 2, 2.2);
  // 手持提燈
  const lx = facing * 14, ly = 2 + Math.sin(t * 8 + 1) * 1.5;
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(facing * 8, 0); g.lineTo(lx, ly - 5); g.stroke();
  g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(lx, ly, 4, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'lighter';
  const gl = glow('rgba(255,200,110,0.9)', 26);
  g.globalAlpha = 0.75 + Math.sin(t * 12) * 0.15;
  g.drawImage(gl, lx - 26, ly - 26);
  g.restore();
}

export const PALETTES = {
  moss: { base: '#15182b', blotchA: 'rgba(60,40,120,0.18)', blotchB: 'rgba(20,110,120,0.15)', crack: 'rgba(120,220,255,0.12)', crystal: 'rgba(140,200,255,0.55)', dotA: 'rgba(160,140,255,0.25)', dotB: 'rgba(80,220,200,0.2)' },
};

// ---- 圖示：武器／被動／道具（64px 圓形徽章），HUD 與升級卡片共用 ----
const iconCache = new Map();
export function makeIcon(id, color, size = 64) {
  const k = id + size;
  if (iconCache.has(k)) return iconCache.get(k);
  const c = canvas(size, size), g = c.getContext('2d');
  g.scale(size / 64, size / 64);
  const bg = g.createRadialGradient(32, 28, 4, 32, 32, 32);
  bg.addColorStop(0, '#2a2550'); bg.addColorStop(1, '#0d0b1e');
  g.fillStyle = bg; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.strokeStyle = color; g.globalAlpha = 0.7; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
  g.translate(32, 32);
  g.shadowColor = color; g.shadowBlur = 10;
  g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
  switch (id) {
    case 'bolt': // 斜向光矢
      g.lineWidth = 4; P([[-14, 14], [12, -12]]); g.stroke();
      P([[16, -16], [4, -13], [13, -4]]); g.fill();
      g.lineWidth = 3; P([[-14, 14], [-18, 8]]); g.stroke(); P([[-14, 14], [-8, 18]]); g.stroke();
      break;
    case 'orbit':
      g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.5; g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      for (let i = 0; i < 3; i++) { const a = i * 2.1 - 0.5; g.beginPath(); g.arc(Math.cos(a) * 15, Math.sin(a) * 15, 4.5, 0, Math.PI * 2); g.fill(); }
      break;
    case 'aura':
      for (const [r, a] of [[20, 0.25], [14, 0.45], [8, 1]]) { g.globalAlpha = a; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      break;
    case 'chain':
      g.lineWidth = 4; P([[-6, -20], [6, -4], [-4, 0], [8, 20]]); g.stroke();
      g.beginPath(); g.arc(-6, -20, 3, 0, 7); g.arc(8, 20, 3, 0, 7); g.fill();
      break;
    case 'lens':
      g.lineWidth = 4; g.beginPath(); g.arc(-3, -3, 12, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 5; P([[6, 6], [17, 17]]); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-7, -7, 3, 0, 7); g.fill();
      break;
    case 'wick': // 火焰
      g.beginPath(); g.moveTo(0, -20); g.bezierCurveTo(14, -4, 14, 16, 0, 18); g.bezierCurveTo(-14, 16, -14, -4, 0, -20); g.fill();
      g.fillStyle = '#fff6d0'; g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(6, 4, 6, 14, 0, 14); g.bezierCurveTo(-6, 14, -6, 4, 0, -4); g.fill();
      break;
    case 'stone':
      P([[0, -18], [12, -4], [0, 18], [-12, -4]]); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; P([[0, -18], [4, -4], [0, 18], [-4, -4]]); g.closePath(); g.fill();
      break;
    case 'ember': // 心形燈芯
      g.beginPath(); g.moveTo(0, 16); g.bezierCurveTo(-22, 0, -12, -20, 0, -8); g.bezierCurveTo(12, -20, 22, 0, 0, 16); g.fill();
      break;
    case 'heal':
      g.fillRect(-4, -18, 8, 8);
      g.beginPath(); g.moveTo(-5, -10); g.lineTo(5, -10); g.lineTo(14, 8); g.quadraticCurveTo(14, 16, 6, 16); g.lineTo(-6, 16); g.quadraticCurveTo(-14, 16, -14, 8); g.closePath(); g.fill();
      break;
  }
  iconCache.set(k, c);
  return c;
}

// 燈核寶箱（金色、會發光）
export function makeChest() {
  const c = canvas(40, 40), g = c.getContext('2d');
  g.translate(20, 22);
  g.shadowColor = '#ffcf5a'; g.shadowBlur = 12;
  const body = g.createLinearGradient(0, -10, 0, 12);
  body.addColorStop(0, '#ffe08a'); body.addColorStop(1, '#b8741e');
  g.fillStyle = body; g.beginPath(); g.roundRect(-13, -6, 26, 18, 3); g.fill();
  g.fillStyle = '#ffeaa8'; g.beginPath(); g.roundRect(-14, -12, 28, 8, 4); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#5a2e0a'; g.fillRect(-13, -4, 26, 2);
  g.fillStyle = '#9ff4ff'; g.beginPath(); g.moveTo(0, -3); g.lineTo(4, 3); g.lineTo(0, 9); g.lineTo(-4, 3); g.closePath(); g.fill();
  return c;
}
