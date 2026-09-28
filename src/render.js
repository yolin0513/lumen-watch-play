// 畫面層：讀 sim.state 畫圖；粒子、飄字、震動、橫幅這些純視覺效果由 state.events 觸發，只存在這裡。
import { VW } from './sim.js';
import { ENEMIES, WEAPONS, PASSIVES } from './content.js';
import { glow, makeGround, makeCreature, drawPlayer, makeIcon, makeChest, PALETTES } from './art.js';

const CREATURE_ART = {
  mite:     { seed: 11, radius: 11, hue: 290, eyes: 1 },
  moth:     { seed: 5,  radius: 9,  hue: 20,  eyes: 1, spikes: 3 },
  brute:    { seed: 23, radius: 20, hue: 150, eyes: 2, spikes: 7 },
  spitter:  { seed: 41, radius: 13, hue: 95,  eyes: 3 },
  splitter: { seed: 64, radius: 15, hue: 200, eyes: 2, spikes: 4 },
  boss1:    { seed: 77, radius: 42, hue: 322, eyes: 3, spikes: 12 },
};
const AFFIX_COLOR = { swift: 'rgba(120,255,200,1)', regen: 'rgba(120,255,120,1)', armor: 'rgba(255,200,90,1)' };

export function createRenderer() {
  const sprites = {};
  for (const k of Object.keys(ENEMIES)) sprites[k] = makeCreature(CREATURE_ART[k]);
  const ground = makeGround(PALETTES.moss);
  const chestImg = makeChest();
  const G = {
    bolt: glow('rgba(255,210,120,1)', 14), gem: glow('rgba(120,230,255,1)', 12), spark: glow('rgba(255,160,220,1)', 10),
    star: glow('rgba(140,235,255,1)', 14), spore: glow('rgba(255,90,200,1)', 16), orb: glow('rgba(150,235,255,1)', 22),
    gold: glow('rgba(255,210,90,1)', 30), heal: glow('rgba(255,140,170,1)', 18), magnet: glow('rgba(120,200,255,1)', 18),
    aura: glow('rgba(255,170,80,0.5)', 64), boss: glow('rgba(255,80,190,0.8)', 90),
  };
  for (const k of Object.keys(AFFIX_COLOR)) G['elite_' + k] = glow(AFFIX_COLOR[k], 48);
  const fx = { parts: [], texts: [], arcs: [], rings: [], banners: [], shake: 0, levelFlash: 0, hurtFlash: 0, whiteFlash: 0 };

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
        case 'arc': fx.arcs.push({ pts: e.pts, life: 0.18 }); break;
        case 'aura': fx.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.3 }); break;
        case 'burst': fx.rings.push({ x: e.x, y: e.y, r: 70, life: 0.35, color: 'spore' }); break;
        case 'chest': fx.whiteFlash = 0.5; burst(e.x, e.y, 40, G.gold, 260, 0.8, 14); break;
        case 'heal': burst(e.x, e.y, 16, G.heal, 120); break;
        case 'magnet': fx.rings.push({ x: e.x, y: e.y, r: 300, life: 0.5, color: 'magnet' }); break;
        case 'announce': banner(e.text, e.big); if (e.big) fx.shake = 10; break;
        case 'bossdown': fx.whiteFlash = 1; fx.shake = 16; burst(e.x, e.y, 120, G.gold, 380, 1.4, 16); burst(e.x, e.y, 80, G.spore, 300, 1.2, 14); break;
      }
    }
    s.events.length = 0;
    fx.shake = Math.max(0, fx.shake - dt * 30);
    for (const k of ['levelFlash', 'hurtFlash', 'whiteFlash']) fx[k] = Math.max(0, fx[k] - dt * (k === 'whiteFlash' ? 1.5 : 1));
    for (const q of fx.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
    fx.parts = fx.parts.filter((q) => q.life > 0);
    if (fx.parts.length > 900) fx.parts.splice(0, fx.parts.length - 900);
    for (const q of fx.texts) { q.y -= 30 * dt; q.life -= dt; }
    fx.texts = fx.texts.filter((q) => q.life > 0);
    if (fx.texts.length > 80) fx.texts.splice(0, fx.texts.length - 80);
    for (const list of [fx.arcs, fx.rings, fx.banners]) for (const q of list) q.life -= dt;
    fx.arcs = fx.arcs.filter((q) => q.life > 0); fx.rings = fx.rings.filter((q) => q.life > 0); fx.banners = fx.banners.filter((q) => q.life > 0);
  }

  function render(g, s, dt, W, H, scale, safeTop = 0) {
    consume(s, dt);
    const vh = H / scale, p = s.player, T = s.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const sx = (Math.random() - 0.5) * fx.shake, sy = (Math.random() - 0.5) * fx.shake;
    const camX = p.x - VW / 2 + sx, camY = p.y - vh / 2 + sy;
    g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    const onScreen = (x, y, m = 60) => x > camX - m && x < camX + VW + m && y > camY - m && y < camY + vh + m;

    g.fillStyle = g.createPattern(ground, 'repeat'); g.fillRect(camX, camY, VW, vh);

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

    // 燈暈（在怪物底下）
    const aura = p.weapons.find((w) => w.id === 'aura');
    if (aura?.radius) {
      g.globalCompositeOperation = 'lighter';
      const r = aura.radius * (1 + Math.sin(T * 5) * 0.03);
      g.globalAlpha = 0.55; g.drawImage(G.aura, p.x - r, p.y - r, r * 2, r * 2); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,190,110,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }

    // 經驗晶
    g.globalCompositeOperation = 'lighter';
    for (const gm of s.gems) if (onScreen(gm.x, gm.y)) { const k = gm.big ? 2 : 1; g.drawImage(G.gem, gm.x - 12 * k, gm.y - 12 * k, 24 * k, 24 * k); }
    g.globalCompositeOperation = 'source-over';
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
      if (it.type === 'chest') g.drawImage(chestImg, it.x - 20, it.y - 22 + bob);
      else { const ic = makeIcon(it.type === 'heal' ? 'heal' : 'stone', it.type === 'heal' ? '#ff9fb4' : '#7fd6ff', 24); g.drawImage(ic, it.x - 12, it.y - 12 + bob); }
    }

    // Boss 衝刺預警
    for (const e of s.enemies) if (e.tele) {
      g.save(); g.translate(e.x, e.y); g.rotate(Math.atan2(e.tele.dy, e.tele.dx));
      g.fillStyle = `rgba(255,60,120,${0.18 + Math.sin(T * 30) * 0.08})`; g.fillRect(0, -e.r, e.tele.len, e.r * 2);
      g.strokeStyle = 'rgba(255,120,170,0.7)'; g.lineWidth = 1.5; g.strokeRect(0, -e.r, e.tele.len, e.r * 2);
      g.restore();
    }

    // 敵人（依 y 排序）
    const vis = s.enemies.filter((e) => onScreen(e.x, e.y, e.r * 2)).sort((a, b) => a.y - b.y);
    for (const e of vis) {
      const sp = sprites[e.kind], img = sp.frames[Math.floor(e.frame) % sp.frames.length];
      const k = e.r / ENEMIES[e.kind].r, size = sp.size * k;
      if (e.elite || e.kind === 'boss1') {
        g.globalCompositeOperation = 'lighter';
        const gl = e.kind === 'boss1' ? G.boss : G['elite_' + e.affix];
        const pr = e.r * (2.2 + Math.sin(T * 5) * 0.15);
        g.globalAlpha = 0.6; g.drawImage(gl, e.x - pr, e.y - pr, pr * 2, pr * 2); g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      if (e.slowT > 0) g.filter = 'hue-rotate(40deg)';
      g.drawImage(img, e.x - size / 2, e.y - size / 2, size, size);
      g.filter = 'none';
      if (e.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8; g.drawImage(img, e.x - size / 2, e.y - size / 2, size, size); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (e.elite) { // 精英血條
        const w = e.r * 2;
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
        g.fillStyle = AFFIX_COLOR[e.affix]; g.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    drawPlayer(g, p.x, p.y, T, p.facing, p.hurtT > 0.4);

    // 子彈、光球、電弧、粒子（加亮疊加）
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const b of s.bullets) {
      if (!onScreen(b.x, b.y)) continue;
      if (b.star) { g.drawImage(G.star, b.x - 14, b.y - 14); g.fillStyle = '#eaffff'; g.beginPath(); g.arc(b.x, b.y, 3, 0, 7); g.fill(); continue; }
      const k = b.big ? 1.8 : b.src === 'shard' ? 0.6 : 1;
      g.drawImage(G.bolt, b.x - 14 * k, b.y - 14 * k, 28 * k, 28 * k);
      g.strokeStyle = b.big ? 'rgba(255,250,220,0.95)' : 'rgba(255,240,200,0.9)'; g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.025 * k, b.y - b.vy * 0.025 * k); g.stroke();
    }
    for (const w of p.weapons) if (w.orbs) for (const o of w.orbs) {
      const r = w.evo ? 26 : 20;
      g.drawImage(G.orb, o.x - r, o.y - r, r * 2, r * 2);
      g.fillStyle = w.evo ? '#fff' : '#dffaff'; g.beginPath(); g.arc(o.x, o.y, w.evo ? 6 : 4.5, 0, 7); g.fill();
    }
    for (const a of fx.arcs) {
      g.globalAlpha = a.life / 0.18;
      for (const [lw, col] of [[5, 'rgba(160,120,255,0.5)'], [2, 'rgba(235,225,255,1)']]) {
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
      const r = b.r * 2.6; g.drawImage(G.spore, b.x - r, b.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    for (const b of s.ebullets) { if (!onScreen(b.x, b.y)) continue; g.fillStyle = '#ffd6f4'; g.beginPath(); g.arc(b.x, b.y, b.r * 0.6, 0, 7); g.fill(); g.strokeStyle = '#8a1a6a'; g.lineWidth = 1.5; g.stroke(); }
    g.globalCompositeOperation = 'lighter';
    for (const r of fx.rings) {
      const t = 1 - r.life / (r.color === 'magnet' ? 0.5 : 0.35);
      g.strokeStyle = r.color === 'spore' ? `rgba(255,90,200,${r.life * 2})` : r.color === 'magnet' ? `rgba(120,200,255,${r.life * 2})` : `rgba(255,190,110,${r.life})`;
      g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, r.color ? r.r * t : r.r, 0, Math.PI * 2); g.stroke();
    }
    for (const q of fx.parts) { g.globalAlpha = Math.min(1, q.life / 0.3); g.drawImage(q.img, q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

    // 傷害數字
    g.textAlign = 'center';
    for (const q of fx.texts) {
      g.font = q.big ? '800 13px system-ui' : 'bold 10px system-ui';
      g.globalAlpha = Math.min(1, q.life * 3); g.fillStyle = q.big ? '#ffe27a' : '#fff'; g.strokeStyle = '#1a0a22'; g.lineWidth = 2.5;
      g.strokeText(q.v, q.x, q.y); g.fillText(q.v, q.x, q.y);
    }
    g.globalAlpha = 1;

    // 螢幕空間：暗角、受傷紅框、白閃
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(5,4,13,0)'); vig.addColorStop(1, 'rgba(5,4,13,0.75)');
    g.fillStyle = vig; g.fillRect(0, 0, W, H);
    const lowHp = p.hp / p.maxHp < 0.3 ? 0.25 + Math.sin(T * 6) * 0.1 : 0;
    const red = Math.max(fx.hurtFlash, lowHp);
    if (red > 0) {
      const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(255,0,60,0)'); rg.addColorStop(1, `rgba(255,20,70,${red})`);
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    if (fx.whiteFlash > 0) { g.fillStyle = `rgba(255,245,220,${fx.whiteFlash * 0.6})`; g.fillRect(0, 0, W, H); }

    renderHud(g, s, W, H, scale, camX, camY, vh, safeTop);
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
    // 時間：Boss 前倒數到燈塔守衛
    g.textAlign = 'center';
    const left = Math.max(0, s.chapter.bossAt - T);
    const clock = s.boss || s.arena ? '燈塔守衛' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    g.font = '700 16px system-ui'; shadowText(g, clock, w / 2, top + 21);
    g.font = '600 10px system-ui'; g.fillStyle = '#9aa3d6'; shadowText(g, s.boss || s.arena ? '' : '距離燈塔守衛', w / 2, top + 33);
    g.textAlign = 'right'; g.font = '600 13px system-ui'; g.fillStyle = '#e9ecff'; shadowText(g, `擊倒 ${s.kills}`, w - 48, top + 20);

    // 裝備列
    let x = 8; const y = top + 30, S = 18;
    for (const wp of p.weapons) { drawSlot(g, makeIcon(wp.id, WEAPONS[wp.id].color, 36), x, y, S, wp.evo ? '★' : wp.lv); x += S + 3; }
    x += 4;
    for (const [id, lv] of Object.entries(p.passives)) { drawSlot(g, makeIcon(id, PASSIVES[id].color, 36), x, y, S, lv); x += S + 3; }

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

    // 畫面外燈核指示
    for (const it of s.pickups) {
      if (it.type !== 'chest') continue;
      const sx = it.x - camX, sy = it.y - camY;
      if (sx > 0 && sx < w && sy > 0 && sy < vh) continue;
      const cx = w / 2, cy = h / 2, a = Math.atan2(sy - cy, sx - cx);
      const ex = Math.min(w - 20, Math.max(20, cx + Math.cos(a) * w)), ey = Math.min(h - 20, Math.max(90 + safeTop, cy + Math.sin(a) * h));
      g.save(); g.translate(ex, ey); g.rotate(a);
      g.fillStyle = `rgba(255,210,90,${0.7 + Math.sin(T * 8) * 0.3})`; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.closePath(); g.fill();
      g.restore();
    }

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
