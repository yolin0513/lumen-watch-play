// 純邏輯層（不碰 DOM／Canvas）：一整章的規則。Node 可直接 import 測試（tools/sim-test.mjs）。
// 畫面層只讀 state，並消化 state.events 產生特效；介面層呼叫 choose()/closeChest()/pause 相關。
// phase：play 進行中 / choice 升級三選一 / chest 燈核結果 / win / lose（choice、chest、win、lose 時 update 不推進）
import { WEAPONS, PASSIVES, RESONANCES, ENEMIES, ELITE, ELITE_AFFIXES, CHAPTER1, XP_CURVE, SLOTS, MAX_LV } from './content.js';

export const VW = 400; // 邏輯視野寬度（世界單位），高度依螢幕比例

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

const TAU = Math.PI * 2;
const BASE = { hp: 100, speed: 120, magnet: 95 };
const GEM_DRIFT = { range: 220, speed: 28 }; // 附近的光屑會緩慢飄向玩家，站著不動也撿得到一些

export function createSim({ seed = 1, vh = 700, chapter = CHAPTER1 } = {}) {
  const rand = makeRng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const s = {
    t: 0, phase: 'play', kills: 0, vh, chapter,
    player: {
      x: 0, y: 0, hp: BASE.hp, maxHp: BASE.hp, speed: BASE.speed, magnet: BASE.magnet, regen: 0, dmgMul: 1, cdMul: 1,
      facing: 1, hurtT: 0, level: 1, xp: 0, xpNext: XP_CURVE(1), weapons: [], passives: {},
    },
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [],
    events: [],        // 給畫面層的一次性事件
    pendingLevels: 0, choice: null, chest: null,
    spawnAcc: 0, eventIdx: 0, boss: null, arena: null, winT: 0,
    autoSpawn: true, god: false, // 測試用
  };
  const p = s.player;

  // ---------- 成長 ----------
  function recalc() {
    const sum = (key) => Object.entries(p.passives).reduce((a, [id, l]) => a + (PASSIVES[id].per[key] || 0) * l, 0);
    p.dmgMul = 1 + sum('dmgMul');
    p.cdMul = Math.max(0.4, 1 - sum('cdMul'));
    p.magnet = BASE.magnet * (1 + sum('magnetMul'));
    p.speed = BASE.speed * (1 + sum('speedMul'));
    const maxHp = BASE.hp + sum('maxHp');
    p.hp += maxHp - p.maxHp; p.maxHp = maxHp;
    p.regen = sum('regen');
  }
  function weaponStats(w) { return w.evo ? RESONANCES[w.id].stats : WEAPONS[w.id].lv[w.lv - 1]; }
  function addWeapon(id) { const w = { id, lv: 1, evo: false, cd: 0.2, ang: 0, fling: 0 }; p.weapons.push(w); return w; }
  function canEvolve(w) { const r = RESONANCES[w.id]; return r && !w.evo && w.lv >= MAX_LV && (p.passives[r.needs] || 0) > 0; }

  function options() {
    const out = [];
    const ownW = new Set(p.weapons.map((w) => w.id));
    for (const w of p.weapons) if (!w.evo && w.lv < MAX_LV) out.push({ kind: 'wup', id: w.id, from: w.lv });
    if (p.weapons.length < SLOTS.weapon) for (const id of Object.keys(WEAPONS)) if (!ownW.has(id)) out.push({ kind: 'wnew', id, from: 0 });
    const ownP = Object.keys(p.passives);
    for (const id of ownP) if (p.passives[id] < MAX_LV) out.push({ kind: 'pup', id, from: p.passives[id] });
    if (ownP.length < SLOTS.passive) for (const id of Object.keys(PASSIVES)) if (!p.passives[id]) out.push({ kind: 'pnew', id, from: 0 });
    return out;
  }
  function describe(o) {
    if (o.kind === 'heal') return { ...o, name: '溫熱燈油', color: '#ff9fb4', icon: 'heal', label: '恢復', desc: '立即回復 40 生命' };
    const isW = o.kind === 'wup' || o.kind === 'wnew';
    const def = isW ? WEAPONS[o.id] : PASSIVES[o.id];
    const desc = isW ? def.desc[o.from] : def.desc;
    let hint = '';
    if (isW && RESONANCES[o.id]) hint = `滿級＋${PASSIVES[RESONANCES[o.id].needs].name} → 共鳴「${RESONANCES[o.id].name}」`;
    if (!isW) for (const [wid, r] of Object.entries(RESONANCES)) if (r.needs === o.id) hint = `與 ${WEAPONS[wid].name} 共鳴`;
    return { ...o, name: def.name, color: def.color, icon: o.id, label: o.from === 0 ? '新！' : `Lv ${o.from} → ${o.from + 1}`, desc, hint };
  }
  function rollChoices() {
    const pool = options();
    const picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    if (picked.length < 3) picked.push({ kind: 'heal', id: 'heal', from: 0 });
    return picked.map(describe);
  }
  function apply(o) {
    if (o.kind === 'wnew') addWeapon(o.id);
    else if (o.kind === 'wup') p.weapons.find((w) => w.id === o.id).lv++;
    else if (o.kind === 'pnew' || o.kind === 'pup') { p.passives[o.id] = (p.passives[o.id] || 0) + 1; recalc(); }
    else if (o.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 40);
  }
  function choose(i) {
    if (s.phase !== 'choice') return;
    apply(s.choice[i]);
    s.pendingLevels--; s.choice = null; s.phase = 'play';
    nextChoice();
  }
  function nextChoice() {
    if (s.phase === 'play' && s.pendingLevels > 0) { s.choice = rollChoices(); s.phase = 'choice'; }
  }
  function gainXp(v) {
    p.xp += v;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++; p.xpNext = XP_CURVE(p.level); s.pendingLevels++;
      s.events.push({ type: 'level', x: p.x, y: p.y });
    }
  }

  // 燈核：有可共鳴武器就進化，否則隨機強化最多 3 項已持有的東西
  function openChest() {
    const evo = p.weapons.find(canEvolve);
    let result;
    if (evo) {
      evo.evo = true;
      const r = RESONANCES[evo.id];
      result = { type: 'evo', items: [{ name: r.name, color: WEAPONS[evo.id].color, icon: evo.id, label: '共鳴！', desc: r.desc }] };
    } else {
      const ups = options().filter((o) => o.kind === 'wup' || o.kind === 'pup');
      const items = [];
      for (let i = 0; i < 3 && ups.length; i++) { const o = ups.splice(Math.floor(rand() * ups.length), 1)[0]; items.push(describe(o)); apply(o); }
      if (!items.length) { const h = describe({ kind: 'heal', id: 'heal', from: 0 }); apply(h); items.push(h); }
      result = { type: 'upgrade', items };
    }
    s.chest = result; s.phase = 'chest';
    s.events.push({ type: 'chest', x: p.x, y: p.y });
  }
  function closeChest() { if (s.phase !== 'chest') return; s.chest = null; s.phase = 'play'; nextChoice(); }

  // ---------- 生怪 ----------
  function spawnDist() { return Math.hypot(VW, s.vh) / 2 + 30; }
  function spawnEnemy(kind, { angle, dist, x, y, elite = false, affix = null } = {}) {
    const t = ENEMIES[kind];
    const a = angle ?? rand() * TAU;
    const d = dist ?? spawnDist();
    const hpMul = (kind === 'boss1' ? 1 : s.chapter.hpScale(s.t)) * (elite ? ELITE.hpMul : 1);
    const e = {
      kind, elite, affix, x: x ?? p.x + Math.cos(a) * d, y: y ?? p.y + Math.sin(a) * d,
      r: t.r * (elite ? ELITE.rMul : 1), hp: t.hp * hpMul, maxHp: t.hp * hpMul, mass: (t.mass || 1) * (elite ? 6 : 1),
      flash: 0, frame: rand() * 4, seed: rand() * 100, slowT: 0, slow: 0, orbT: 0, fireT: (t.fireCd || 0) * (0.5 + rand()),
    };
    if (kind === 'boss1') Object.assign(e, { bphase: 1, burstT: 2, dashT: 4, summonT: 0, mode: 'move', modeT: 0, dirX: 0, dirY: 0 });
    s.enemies.push(e);
    return e;
  }
  function rosterPick() {
    const list = s.chapter.roster.filter(([at]) => s.t >= at);
    let total = 0; for (const r of list) total += r[2];
    let x = rand() * total;
    for (const r of list) { x -= r[2]; if (x <= 0) return r[1]; }
    return list[0][1];
  }
  function runEvent(ev) {
    if (ev.type === 'ring') for (let i = 0; i < ev.n; i++) spawnEnemy(ev.kind, { angle: (i / ev.n) * TAU });
    else if (ev.type === 'rush') {
      const a = rand() * TAU, d = spawnDist(), cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
      for (let i = 0; i < ev.n; i++) { const off = (i / (ev.n - 1) - 0.5) * 360; spawnEnemy(ev.kind, { x: cx - Math.sin(a) * off, y: cy + Math.cos(a) * off }); }
    } else if (ev.type === 'elite') {
      const affix = pick(Object.keys(ELITE_AFFIXES));
      spawnEnemy(ev.kind, { elite: true, affix });
      s.events.push({ type: 'announce', text: `精英出現：${ELITE_AFFIXES[affix].name}${ENEMIES[ev.kind].name}` });
    } else if (ev.type === 'boss') startBoss(ev.kind);
    s.events.push({ type: 'wave', kind: ev.type });
  }
  function startBoss(kind) {
    s.arena = { x: p.x, y: p.y, r: s.chapter.arenaR };
    // 光圈外的怪直接消散（不給經驗）
    s.enemies = s.enemies.filter((e) => {
      const inside = Math.hypot(e.x - s.arena.x, e.y - s.arena.y) < s.arena.r - 10;
      if (!inside) s.events.push({ type: 'fade', x: e.x, y: e.y });
      return inside;
    });
    s.ebullets.length = 0;
    s.boss = spawnEnemy(kind, { x: p.x, y: p.y - s.arena.r * 0.7 });
    s.events.push({ type: 'announce', text: `燈塔守衛：${ENEMIES[kind].name}`, big: true });
  }

  // ---------- 空間雜湊 ----------
  const CELL = 48;
  let grid = new Map();
  const key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
  function buildGrid() {
    grid = new Map();
    for (const e of s.enemies) {
      const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(e);
    }
  }
  function near(x, y, fn, rad = 1) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) { const b = grid.get(key(cx + i, cy + j)); if (b) for (const e of b) fn(e); }
  }
  function nearest(x, y, maxD, skip) {
    let best = null, bd = maxD * maxD;
    for (const e of s.enemies) {
      if (e.hp <= 0 || (skip && skip.has(e))) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }

  // ---------- 傷害 ----------
  function damage(e, amount, kx = 0, ky = 0) {
    if (e.hp <= 0) return;
    const aff = e.affix && ELITE_AFFIXES[e.affix];
    const dmg = Math.max(1, Math.round(amount * p.dmgMul * (aff?.dmgTaken ?? 1)));
    e.hp -= dmg; e.flash = 0.08;
    if (e.kind !== 'boss1') { e.x += kx * 6 / e.mass; e.y += ky * 6 / e.mass; }
    s.events.push({ type: 'hit', x: e.x, y: e.y - e.r, v: dmg, big: dmg >= 30 });
  }
  function hurtPlayer(dmg, src) {
    if (p.hurtT > 0 || s.god || s.phase !== 'play') return;
    p.hp -= dmg; p.hurtT = 0.5;
    s.events.push({ type: 'hurt', x: p.x, y: p.y, v: dmg, src });
    if (p.hp <= 0) { p.hp = 0; s.phase = 'lose'; s.events.push({ type: 'lose' }); }
  }

  // ---------- 武器 ----------
  function fireBolt(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const target = nearest(p.x, p.y, 420);
    if (!target) return;
    w.cd = st.cd * p.cdMul;
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    for (let i = 0; i < st.shots; i++) {
      const a = base + (i - (st.shots - 1) / 2) * 0.14;
      s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: 1.1, dmg: st.dmg, pierce: st.pierce, hit: new Set(), shard: st.shard || 0, big: !!w.evo, src: 'bolt' });
    }
  }
  function orbitWeapon(w, st, dt) {
    w.ang += st.spin * dt;
    w.orbs = [];
    for (let i = 0; i < st.count; i++) {
      const a = w.ang + (i / st.count) * TAU;
      const ox = p.x + Math.cos(a) * st.radius, oy = p.y + Math.sin(a) * st.radius;
      w.orbs.push({ x: ox, y: oy, a });
      near(ox, oy, (e) => {
        if (e.orbT > 0 || e.hp <= 0) return;
        if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + st.size) ** 2) { e.orbT = 0.4; damage(e, st.dmg, Math.cos(a), Math.sin(a)); }
      });
    }
    if (st.flingCd) {
      w.fling -= dt;
      if (w.fling <= 0) {
        w.fling = st.flingCd * p.cdMul;
        const o = w.orbs[Math.floor(rand() * w.orbs.length)];
        s.bullets.push({ x: o.x, y: o.y, vx: Math.cos(o.a) * 300, vy: Math.sin(o.a) * 300, life: 1.2, dmg: st.dmg * 0.6, pierce: 3, hit: new Set(), shard: 0, star: true, src: 'orbit' });
      }
    }
  }
  function auraWeapon(w, st, dt) {
    w.cd -= dt;
    w.radius = st.radius;
    if (w.cd > 0) return;
    w.cd = st.tick * p.cdMul;
    near(p.x, p.y, (e) => {
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (st.radius + e.r) ** 2) {
        damage(e, st.dmg);
        if (st.slow) { e.slowT = 0.6; e.slow = st.slow; }
      }
    }, Math.ceil(st.radius / CELL) + 1);
    s.events.push({ type: 'aura', x: p.x, y: p.y, r: st.radius });
  }
  function chainWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const first = nearest(p.x, p.y, 260);
    if (!first) return;
    w.cd = st.cd * p.cdMul;
    const hit = new Set();
    for (let k = 0; k < st.arcs; k++) {
      let cur = k === 0 ? first : nearest(p.x, p.y, 260, hit);
      if (!cur) break;
      const pts = [[p.x, p.y]];
      for (let j = 0; j <= st.jumps && cur; j++) {
        hit.add(cur); pts.push([cur.x, cur.y]);
        damage(cur, st.dmg);
        cur = nearest(cur.x, cur.y, st.range, hit);
      }
      s.events.push({ type: 'arc', pts });
    }
  }
  const WEAPON_FN = { bolt: fireBolt, orbit: orbitWeapon, aura: auraWeapon, chain: chainWeapon };

  // ---------- 敵人行為 ----------
  function enemyMove(e, dt) {
    const t = ENEMIES[e.kind];
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    let spd = t.speed * (e.affix === 'swift' ? ELITE_AFFIXES.swift.speedMul : 1) * (e.slowT > 0 ? 1 - e.slow : 1);
    let vx = ux, vy = uy;
    if (t.ai === 'weave') { const w = Math.sin(s.t * 4 + e.seed) * 0.7; vx = ux - uy * w; vy = uy + ux * w; }
    else if (t.ai === 'spit') {
      const dir = d > t.keep + 20 ? 1 : d < t.keep - 20 ? -0.8 : 0;
      const side = Math.sin(e.seed) > 0 ? 1 : -1;
      vx = ux * dir - uy * side * 0.5; vy = uy * dir + ux * side * 0.5;
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 320) {
        e.fireT = t.fireCd;
        s.ebullets.push({ x: e.x, y: e.y, vx: ux * 110, vy: uy * 110, life: 4, dmg: t.shotDmg * (e.elite ? ELITE.dmgMul : 1), r: e.elite ? 8 : 5 });
        if (e.elite) for (const off of [-0.35, 0.35]) { const c = Math.cos(off), sn = Math.sin(off); s.ebullets.push({ x: e.x, y: e.y, vx: (ux * c - uy * sn) * 110, vy: (uy * c + ux * sn) * 110, life: 4, dmg: t.shotDmg, r: 6 }); }
      }
    } else if (t.ai === 'boss') return bossAct(e, dt, ux, uy, d);
    const len = Math.hypot(vx, vy) || 1;
    return [vx / len * spd, vy / len * spd];
  }
  function radial(e, n, speed, offset, dmg) {
    for (let i = 0; i < n; i++) { const a = offset + (i / n) * TAU; s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 5, dmg, r: 7 }); }
  }
  function bossAct(e, dt, ux, uy) {
    const t = ENEMIES[e.kind];
    const frac = e.hp / e.maxHp;
    const phase = frac > 0.6 ? 1 : frac > 0.25 ? 2 : 3;
    if (phase !== e.bphase) {
      e.bphase = phase;
      s.events.push({ type: 'announce', text: phase === 2 ? '菌母暴躁起來了！' : '菌母孢雨狂亂！' });
      if (phase === 2) e.summonT = 0;
    }
    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.burstT = phase === 3 ? 1.6 : 3;
      radial(e, phase === 1 ? 12 : 16, phase === 3 ? 115 : 100, phase === 3 ? s.t * 1.7 : rand() * TAU, 10);
      s.events.push({ type: 'burst', x: e.x, y: e.y });
    }
    if (phase >= 2) {
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 11;
        for (let i = 0; i < 6; i++) spawnEnemy('mite', { x: e.x + Math.cos(i) * 50, y: e.y + Math.sin(i) * 50 });
      }
    }
    e.modeT -= dt;
    if (e.mode === 'move') {
      if (phase >= 2) e.dashT -= dt;
      if (e.dashT <= 0) { e.mode = 'windup'; e.modeT = 0.9; e.dirX = ux; e.dirY = uy; e.dashT = phase === 3 ? 3.5 : 5; }
      return [ux * t.speed, uy * t.speed];
    }
    if (e.mode === 'windup') { e.tele = { dx: e.dirX, dy: e.dirY, len: 330 }; if (e.modeT <= 0) { e.mode = 'dash'; e.modeT = 0.55; e.tele = null; } return [0, 0]; }
    if (e.modeT <= 0) e.mode = 'move';
    return [e.dirX * 600, e.dirY * 600];
  }

  // ---------- 主更新 ----------
  function update(dt, move) {
    if (s.phase !== 'play') return;
    s.t += dt;
    const ch = s.chapter;

    // 玩家
    p.x += move.x * p.speed * dt; p.y += move.y * p.speed * dt;
    if (move.x) p.facing = move.x > 0 ? 1 : -1;
    if (s.arena) clampArena(p, 14);
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // 生怪與時間軸事件
    while (s.eventIdx < ch.events.length && s.t >= ch.events[s.eventIdx].at) runEvent(ch.events[s.eventIdx++]);
    if (s.autoSpawn && !s.boss) {
      s.spawnAcc += dt * ch.spawnRate(s.t);
      while (s.spawnAcc >= 1) { s.spawnAcc -= 1; if (s.enemies.length < ch.maxEnemies) spawnEnemy(rosterPick()); }
    }

    buildGrid();

    // 敵人移動＋互推＋接觸傷害
    for (const e of s.enemies) {
      const [vx, vy] = enemyMove(e, dt);
      let sx = 0, sy = 0;
      near(e.x, e.y, (o) => {
        if (o === e) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy, min = e.r + o.r;
        if (od < min * min && od > 0.01) { const k = (min - Math.sqrt(od)) / min * (o.mass / (e.mass + o.mass)) * 2; sx += ox * k; sy += oy * k; }
      });
      e.x += (vx + sx * 4) * dt; e.y += (vy + sy * 4) * dt;
      if (s.arena) clampArena(e, e.r);
      e.frame += dt * 6; e.flash = Math.max(0, e.flash - dt); e.orbT -= dt; e.slowT -= dt;
      if (e.affix === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITE_AFFIXES.regen.regen * dt);
      const d2 = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
      if (d2 < (e.r + 10) ** 2) hurtPlayer(Math.round(ENEMIES[e.kind].dmg * (e.elite ? ELITE.dmgMul : 1) * ch.dmgScale(s.t)), (e.elite ? 'elite-' : '') + e.kind);
    }

    // 武器
    for (const w of p.weapons) WEAPON_FN[w.id](w, weaponStats(w), dt);

    // 玩家子彈
    for (const b of s.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      near(b.x, b.y, (e) => {
        if (b.life <= 0 || e.hp <= 0 || b.hit.has(e)) return;
        const rr = e.r + (b.big ? 9 : 4);
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          b.hit.add(e);
          const sp = Math.hypot(b.vx, b.vy);
          damage(e, b.dmg, b.vx / sp, b.vy / sp);
          if (e.hp <= 0 && b.shard) for (let i = 0; i < b.shard; i++) { const a = rand() * TAU; s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 0.45, dmg: b.dmg * 0.5, pierce: 1, hit: new Set([e]), shard: 0, src: 'shard' }); }
          if (--b.pierce <= 0) b.life = 0;
        }
      });
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);

    // 敵方子彈
    for (const b of s.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + 8) ** 2) { hurtPlayer(b.dmg, 'spore'); b.life = 0; }
    }
    s.ebullets = s.ebullets.filter((b) => b.life > 0);

    // 死亡：經驗、掉落、分裂
    const dead = s.enemies.filter((e) => e.hp <= 0);
    if (dead.length) {
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      for (const e of dead) onKill(e);
    }

    // 離太遠的怪移回附近（不在競技場時）
    if (!s.arena) {
      const far = Math.hypot(VW, s.vh) * 0.9;
      for (const e of s.enemies) if (!e.elite && Math.hypot(e.x - p.x, e.y - p.y) > far) { const a = rand() * TAU; e.x = p.x + Math.cos(a) * spawnDist(); e.y = p.y + Math.sin(a) * spawnDist(); }
    }

    // 經驗晶
    for (const g of s.gems) {
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
      if (d < p.magnet) g.pull = true;
      else if (d < GEM_DRIFT.range) { g.x += dx / d * GEM_DRIFT.speed * dt; g.y += dy / d * GEM_DRIFT.speed * dt; }
      if (g.pull && d > 0) { g.sp = Math.min(700, (g.sp || 200) + 900 * dt); const v = Math.min(d, g.sp * dt); g.x += dx / d * v; g.y += dy / d * v; }
      if (d < 16) { gainXp(g.v); g.v = 0; }
    }
    s.gems = s.gems.filter((g) => g.v > 0);
    if (s.gems.length > 350) mergeGems();

    // 道具
    for (const it of s.pickups) {
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < 22) {
        it.taken = true;
        if (it.type === 'heal') { p.hp = Math.min(p.maxHp, p.hp + 30); s.events.push({ type: 'heal', x: p.x, y: p.y }); }
        else if (it.type === 'magnet') { for (const g of s.gems) g.pull = true; s.events.push({ type: 'magnet', x: p.x, y: p.y }); }
        else if (it.type === 'chest') openChest();
      }
    }
    s.pickups = s.pickups.filter((it) => !it.taken);

    // 勝利：Boss 倒下後稍等一下讓玩家看到爆炸
    if (s.winT > 0) { s.winT -= dt; if (s.winT <= 0) { s.phase = 'win'; s.events.push({ type: 'win' }); } }

    if (s.phase === 'play') nextChoice();
  }

  function clampArena(o, pad) {
    const dx = o.x - s.arena.x, dy = o.y - s.arena.y, d = Math.hypot(dx, dy), max = s.arena.r - pad;
    if (d > max) { o.x = s.arena.x + dx / d * max; o.y = s.arena.y + dy / d * max; }
  }

  function onKill(e) {
    const t = ENEMIES[e.kind];
    s.kills++;
    s.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, elite: e.elite });
    if (e.kind === 'boss1') {
      s.boss = null; s.winT = 1.8; s.god = true;
      for (const o of s.enemies) { o.hp = 0; s.events.push({ type: 'fade', x: o.x, y: o.y }); }
      s.enemies = []; s.ebullets = [];
      s.events.push({ type: 'bossdown', x: e.x, y: e.y });
      return;
    }
    s.gems.push({ x: e.x, y: e.y, v: t.xp * (e.elite ? ELITE.xpMul : 1), pull: false });
    if (e.elite) s.pickups.push({ type: 'chest', x: e.x, y: e.y });
    else {
      const r = rand();
      if (r < 0.006) s.pickups.push({ type: 'heal', x: e.x, y: e.y });
      else if (r < 0.009) s.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    }
    if (t.split) for (let i = 0; i < t.split.n; i++) {
      const a = (i / t.split.n) * TAU;
      const m = spawnEnemy(t.split.kind, { x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12 });
      m.r *= 0.8; m.hp = m.maxHp = m.hp * 0.6;
    }
  }

  // 經驗晶太多時，把最遠的併到最近的一顆（保持總經驗不變）
  function mergeGems() {
    s.gems.sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
    const keep = s.gems.slice(0, 250), extra = s.gems.slice(250);
    const sink = keep[keep.length - 1];
    for (const g of extra) sink.v += g.v;
    sink.big = true;
    s.gems = keep;
  }

  addWeapon('bolt');
  return { state: s, update, choose, closeChest, spawnEnemy, addWeapon, openChest, gainXp, recalc, options };
}
