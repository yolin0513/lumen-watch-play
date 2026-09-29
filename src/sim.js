// 純邏輯層（不碰 DOM／Canvas）：一整章的規則。Node 可直接 import 測試（tools/sim-test.mjs）。
// 畫面層只讀 state，並消化 state.events 產生特效；介面層呼叫 choose()/closeChest()/pause 相關。
// phase：play 進行中 / choice 升級三選一 / chest 燈核結果 / win / lose（choice、chest、win、lose 時 update 不推進）
// 局外加成（天賦、裝備）以 modifier 陣列 meta 傳入，和局內被動一起走 stats.js 的同一套疊加規則。
import { WEAPONS, PASSIVES, RESONANCES, ENEMIES, ELITE, ELITE_AFFIXES, CHAPTER1, XP_CURVE, SLOTS, MAX_LV, START_WEAPON, SURGE, RESO_CHEST } from './content.js';
import { aggregate, scaled, reduction, CAPS } from './stats.js';

export const VW = 400; // 邏輯視野寬度（世界單位），高度依螢幕比例

export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

const TAU = Math.PI * 2;
const BASE = { hp: 100, speed: 120, magnet: 95 };
const GEM_DRIFT = { range: 220, speed: 28 }; // 附近的光屑會緩慢飄向玩家，站著不動也撿得到一些
const AIM_RANGE = 420;

// ---------- 地形（依座標與種子決定，sim 與 render 共用；不存狀態，無限大地圖也不佔記憶體） ----------
// pools 泥沼：玩家在裡面移速 ×slow。pillars 晶柱：擋住玩家、怪物、雙方子彈。出生點附近 clear 範圍內不放。
// vents 熔坑（第四章）：每個熔坑依自己的相位週期性「預警 warn 秒 → 噴發 active 秒」，噴發時站在上面的玩家與怪都會受傷。
// ice 冰面（第五章）：玩家在冰上有慣性（速度每秒只往操作方向靠近 grip 倍），轉向與煞車都會滑。
export const TERRAIN = {
  pools:   { cell: 190, chance: 0.32, rMin: 38, rMax: 68, slow: 0.55, clear: 150 },
  pillars: { cell: 150, chance: 0.38, rMin: 16, rMax: 30, clear: 130 },
  vents:   { cell: 170, chance: 0.42, rMin: 30, rMax: 46, clear: 150, period: 5.5, warn: 1.4, active: 0.7, dmg: 16, enemyDps: 70 },
  ice:     { cell: 210, chance: 0.5,  rMin: 55, rMax: 92, clear: 110, grip: 2.2 },
};
// 熔坑現在的狀態：{ warn: 0～1 的預警進度 } 或 { fire: true } 或 null（休眠）。sim 與 render 共用，不存狀態。
export function ventState(f, seed, t) {
  const T = TERRAIN.vents, ph = hash2(f.ix, f.iy, seed, 5) * T.period, c = (t + ph) % T.period;
  return c < T.warn ? { warn: c / T.warn } : c < T.warn + T.active ? { fire: true } : null;
}
function hash2(ix, iy, seed, salt) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function terrainCell(kind, seed, ix, iy) {
  const T = TERRAIN[kind];
  if (hash2(ix, iy, seed, 1) >= T.chance) return null;
  const r = T.rMin + hash2(ix, iy, seed, 2) * (T.rMax - T.rMin);
  const x = ix * T.cell + r + hash2(ix, iy, seed, 3) * (T.cell - 2 * r);
  const y = iy * T.cell + r + hash2(ix, iy, seed, 4) * (T.cell - 2 * r);
  if (Math.hypot(x, y) < T.clear + r) return null;
  return { x, y, r, ix, iy };
}
export function terrainIn(kind, seed, x0, y0, x1, y1) {
  const T = TERRAIN[kind], out = [];
  for (let ix = Math.floor(x0 / T.cell); ix <= Math.floor(x1 / T.cell); ix++)
    for (let iy = Math.floor(y0 / T.cell); iy <= Math.floor(y1 / T.cell); iy++) { const f = terrainCell(kind, seed, ix, iy); if (f) out.push(f); }
  return out;
}

// startWeapon：開局武器（預設螢火連弩；裝備了專屬武器就換成它——由 main.js 依存檔的「已裝備」決定，不是「已擁有」）
// startBonus：專屬武器進階給的開局加成 { lv：開局武器等級, passive：開局帶的被動 }（由 meta.js 的 startBonusOf 依「已裝備」算出）
export function createSim({ seed = 1, vh = 700, chapter = CHAPTER1, meta = [], startWeapon = START_WEAPON, startBonus = null } = {}) {
  const rand = makeRng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const s = {
    t: 0, phase: 'play', kills: 0, vh, chapter, terrainSeed: seed % 100000,
    player: {
      x: 0, y: 0, hp: BASE.hp, maxHp: BASE.hp, speed: BASE.speed, magnet: BASE.magnet, regen: 0, dmgMul: 1, cdMul: 1, armorMul: 1,
      revives: 0, facing: 1, aimX: 1, aimY: 0, hurtT: 0, level: 1, xp: 0, xpNext: XP_CURVE(1), weapons: [], passives: {}, inPool: false,
      vx: 0, vy: 0, onIce: false, slowT: 0, slowK: 0, // 冰面慣性、霜冰減速
    },
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [], hazards: [], strikes: [], mines: [], sentries: [],
    events: [],        // 給畫面層的一次性事件
    ledger: { kills: {}, elites: 0, boss: null }, // 燈油結算的來源帳（只由 onKill 寫入）
    pendingLevels: 0, choice: null, chest: null,
    spawnAcc: 0, eventIdx: 0, boss: null, arena: null, winT: 0,
    surge: { idx: 0, queue: [] }, // 菌潮：idx＝已開始幾波；queue＝還沒湧入的批次 [時間, 隻數]
    surgeAlive: 0, // 場上的菌潮怪數（上限 SURGE.cap，和一般怪的上限分開算）
    surgeOn: true, // 量測用：false＝關掉菌潮（tools/level-report.mjs --no-surge 做前後對照）
    resoChestT: 0,         // 共鳴燈核的計時（RESO_CHEST）
    roots: [], rootT: 0,   // 第六章：移動的菌根牆
    counters: {},          // 各章招牌機制的實際發生次數（量測用：熔坑燒到怪、滑行時間、根牆推擠…）
    autoSpawn: true, god: false, // 測試用
  };
  const p = s.player;
  const aimRange = chapter.fog ?? AIM_RANGE;

  // ---------- 成長（局內被動＋局外 meta，一律走 stats.js） ----------
  function recalc() {
    const mods = [...meta];
    for (const [id, lv] of Object.entries(p.passives)) for (const m of PASSIVES[id].mods) for (let i = 0; i < lv; i++) mods.push(m);
    const a = aggregate(mods);
    p.dmgMul = scaled(1, a.dmg);
    p.cdMul = reduction(a.cdr, CAPS.cdr);
    p.armorMul = reduction(a.armor, CAPS.armor);
    p.magnet = scaled(BASE.magnet, a.magnet);
    p.speed = scaled(BASE.speed, a.speed);
    const maxHp = scaled(BASE.hp, a.maxHp);
    p.hp += maxHp - p.maxHp; p.maxHp = maxHp;
    p.regen = scaled(0, a.regen);
    return a;
  }
  function weaponStats(w) { return w.evo ? RESONANCES[w.id].stats : WEAPONS[w.id].lv[w.lv - 1]; }
  function addWeapon(id) { const w = { id, lv: 1, evo: false, cd: 0.2, ang: 0, fling: 0, wisps: [] }; p.weapons.push(w); return w; }
  // 提示用的共鳴配對：直接讀 RESONANCES（不准另寫對照表）。燈核真正判斷共鳴的是 canEvolve；
  // shop-test 用「實際開燈核」得到的結果比對提示，兩條路徑分開，提示寫錯或過期才抓得到。
  function resoNeeds(id) { return RESONANCES[id]?.needs; }
  function canEvolve(w) { const r = RESONANCES[w.id]; return r && !w.evo && w.lv >= MAX_LV && (p.passives[r.needs] || 0) > 0; }
  // 身上每把武器的共鳴進度（提示用）：done 已共鳴／ready 下一個燈核就共鳴（canEvolve）／其他＝還差幾級。
  // M8：擁有者看到被動卡寫「可與 4 把共鳴」、實際只亮 2 顆★——規則是「一個被動可以讓好幾把共鳴，但要滿級、而且一個燈核只共鳴一把」，
  // 卡片沒寫條件，看起來像壞掉。
  // 共鳴燈核的規則說明：秒數從 RESO_CHEST 讀（不准手寫；shop-test 用實際計時比對）
  const RESO_RULE = `武器滿級後約 ${RESO_CHEST.delay} 秒，身邊會出現燈核（精英也會掉），每個燈核共鳴一把`;
  function resoState(w) { return w.evo ? 'done' : canEvolve(w) ? 'ready' : 'lv'; }

  function options() {
    const out = [];
    const ownW = new Set(p.weapons.map((w) => w.id));
    for (const w of p.weapons) if (!w.evo && w.lv < MAX_LV) out.push({ kind: 'wup', id: w.id, from: w.lv });
    // 專屬武器只能當起始武器，不會出現在「新武器」選項
    if (p.weapons.length < SLOTS.weapon) for (const id of Object.keys(WEAPONS)) if (!ownW.has(id) && !WEAPONS[id].exclusive) out.push({ kind: 'wnew', id, from: 0 });
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
    // 共鳴提示：一律從 RESONANCES 算，不另外寫對照表（shop-test 會拿「實際開燈核會不會共鳴」逐一比對）
    // reso.partners＝能跟這張卡共鳴的對象（武器卡 → 需要的被動；被動卡 → 所有需要它的武器）；reso.held＝其中玩家身上已經有的
    let hint = '', reso = null;
    if (isW && RESONANCES[o.id]) {
      const need = resoNeeds(o.id), have = (p.passives[need] || 0) > 0;
      reso = { partners: [need], held: have ? [need] : [] };
      hint = have ? `★ 你已有${PASSIVES[need].name}：滿級後約 ${RESO_CHEST.delay} 秒出現燈核，撿起來共鳴「${RESONANCES[o.id].name}」` : `滿級＋${PASSIVES[need].name} → 共鳴「${RESONANCES[o.id].name}」（${RESO_RULE}）`;
    }
    if (!isW) { // 一個被動可以對應好幾把武器：全部列出，玩家身上有的標在前面
      const ws = Object.keys(RESONANCES).filter((wid) => resoNeeds(wid) === o.id), held = ws.filter((wid) => p.weapons.some((w) => w.id === wid));
      if (ws.length) {
        const name = (wid) => (RESONANCES[wid] && WEAPONS[wid].name), own = (wid) => p.weapons.find((w) => w.id === wid);
        const state = Object.fromEntries(held.map((wid) => [wid, resoState(own(wid))]));
        reso = { partners: ws, held, done: held.filter((w) => state[w] === 'done'), ready: held.filter((w) => state[w] === 'ready') };
        const tag = (wid) => state[wid] === 'done' ? `${name(wid)}（已共鳴）` : state[wid] === 'ready' ? `${name(wid)}（滿級・燈核即將出現）` : `${name(wid)}（Lv ${own(wid).lv}/${MAX_LV}）`;
        hint = held.length ? `★ 可與你的 ${held.map(tag).join('、')} 共鳴${ws.length > held.length ? `（也對應 ${ws.filter((w) => !held.includes(w)).map(name).join('、')}）` : ''}。${RESO_RULE}`
          : `可與 ${ws.map(name).join('、')} 共鳴（${RESO_RULE}）`;
      }
    }
    return { ...o, name: def.name, color: def.color, icon: o.id, label: o.from === 0 ? '新！' : `Lv ${o.from} → ${o.from + 1}`, desc, hint, reso };
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
  const isBoss = (kind) => ENEMIES[kind].ai === 'boss';
  function spawnDist() { return Math.hypot(VW, s.vh) / 2 + 30; }
  function spawnEnemy(kind, { angle, dist, x, y, elite = false, affix = null } = {}) {
    const t = ENEMIES[kind];
    const a = angle ?? rand() * TAU;
    const d = dist ?? spawnDist();
    // 菌潮之後菌群變強：每過一波，一般怪（不含菌潮怪本身、不含守衛）血量 × (1 + SURGE.hpPerWave × 已過波數)。
    // 理由：菌潮給的經驗讓玩家提早變強，若怪不跟著變強，各章的招牌威脅會在靠近前就被打死（量過：第二章脹孢囊引信從 136 次掉到 1 次）。
    const waveMul = kind === SURGE.kind || isBoss(kind) ? 1 : 1 + SURGE.hpPerWave * s.surge.idx;
    const hpMul = (isBoss(kind) ? (s.chapter.bossHpMul ?? 1) : s.chapter.hpScale(s.t)) * (elite ? ELITE.hpMul : 1) * waveMul;
    const e = {
      kind, elite, affix, x: x ?? p.x + Math.cos(a) * d, y: y ?? p.y + Math.sin(a) * d,
      r: t.r * (elite ? ELITE.rMul : 1), hp: t.hp * hpMul, maxHp: t.hp * hpMul, mass: (t.mass || 1) * (elite ? 6 : 1),
      flash: 0, frame: rand() * 4, seed: rand() * 100, slowT: 0, slow: 0, orbT: 0, fireT: (t.fireCd || 0) * (0.5 + rand()),
      mode: 'move', modeT: 0, cdT: rand() * 1.5, dirX: 0, dirY: 0, tele: null, fuse: 0, warn: null,
    };
    if (t.ai === 'blink') e.cdT = t.blinkCd * (0.4 + rand() * 0.6);
    if (isBoss(kind)) Object.assign(e, { bphase: 1, burstT: 2, dashT: 4, summonT: 0, beamT: 2, rainT: 3, combo: 0 });
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
      spawnEnemy(ev.kind, { elite: true, affix, dist: ENEMIES[ev.kind].ai === 'turret' ? 200 : undefined });
      s.events.push({ type: 'announce', text: `精英出現：${ELITE_AFFIXES[affix].name}${ENEMIES[ev.kind].name}` });
    } else if (ev.type === 'boss') startBoss(ev.kind);
    s.events.push({ type: 'wave', kind: ev.type });
  }
  // 菌潮：時間到就排好這一波的幾個批次，批次到了從四周一圈湧入；場上怪物到 SURGE.cap 就不再生（這批剩下的不補）
  function updateSurge() {
    const sg = s.surge, next = SURGE.first + sg.idx * SURGE.every;
    if (!s.boss && s.t >= next && next <= s.chapter.bossAt - SURGE.beforeBoss) {
      const n = SURGE.base + SURGE.grow * sg.idx, per = Math.ceil(n / SURGE.bursts);
      for (let b = 0; b < SURGE.bursts; b++) sg.queue.push([s.t + b * SURGE.burstGap, Math.min(per, n - b * per)]);
      sg.idx++;
      s.events.push({ type: 'announce', text: `菌潮來襲！（第 ${sg.idx} 波）` }, { type: 'surge', n });
    }
    while (sg.queue.length && s.t >= sg.queue[0][0]) {
      const [, cnt] = sg.queue.shift(), off = rand() * TAU;
      for (let i = 0; i < cnt && s.surgeAlive < SURGE.cap && s.enemies.length < SURGE.total - SURGE.reserve && !s.boss; i++) { spawnEnemy(SURGE.kind, { angle: off + (i / cnt) * TAU, dist: spawnDist() + (i % 3) * 22 }).surge = true; s.surgeAlive++; }
    }
  }
  function startBoss(kind) {
    s.arena = { x: p.x, y: p.y, r: s.chapter.arenaR };
    // 光圈外的怪直接消散（不給經驗、不算擊倒）
    s.enemies = s.enemies.filter((e) => {
      const inside = Math.hypot(e.x - s.arena.x, e.y - s.arena.y) < s.arena.r - 10;
      if (!inside) s.events.push({ type: 'fade', x: e.x, y: e.y });
      return inside;
    });
    s.ebullets.length = 0; s.hazards.length = 0; s.roots.length = 0; s.rootT = 3; s.mines = s.mines.filter((m) => Math.hypot(m.x - s.arena.x, m.y - s.arena.y) < s.arena.r);
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

  // ---------- 地形互動 ----------
  const terrain = s.chapter.terrain;
  function pillarAt(x, y) { // 子彈只需查自己所在格（晶柱完整落在格內）
    if (terrain !== 'pillars') return null;
    const T = TERRAIN.pillars, f = terrainCell('pillars', s.terrainSeed, Math.floor(x / T.cell), Math.floor(y / T.cell));
    return f && (x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r ? f : null;
  }
  function pushOutOfPillars(o, rad) {
    if (terrain !== 'pillars') return;
    for (const f of terrainIn('pillars', s.terrainSeed, o.x - rad, o.y - rad, o.x + rad, o.y + rad)) {
      const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 0.01, min = f.r + rad;
      if (d < min) { o.x = f.x + dx / d * min; o.y = f.y + dy / d * min; }
    }
  }
  const count = (k, n = 1) => { s.counters[k] = (s.counters[k] || 0) + n; };
  function cellFeature(kind, x, y) { // 查自己所在格的地形（地形完整落在格內）
    if (terrain !== kind) return null;
    const T = TERRAIN[kind], f = terrainCell(kind, s.terrainSeed, Math.floor(x / T.cell), Math.floor(y / T.cell));
    return f && (x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r ? f : null;
  }
  // 熔坑噴發：玩家受固定傷害；怪每秒受 enemyDps（可以把怪引進熔坑）
  function updateVents(dt) {
    if (terrain !== 'vents') return;
    const T = TERRAIN.vents, fp = cellFeature('vents', p.x, p.y);
    if (fp && ventState(fp, s.terrainSeed, s.t)?.fire) { const before = p.hp; hurtPlayer(T.dmg, 'vent'); if (p.hp < before) count('ventHitsPlayer'); }
    for (const e of s.enemies) {
      if (e.hp <= 0 || isBoss(e.kind)) continue;
      const f = cellFeature('vents', e.x, e.y);
      if (!f || !ventState(f, s.terrainSeed, s.t)?.fire) continue;
      const burn = `${f.ix},${f.iy},${Math.floor(s.t / T.period)}`; // 同一次噴發只算一次「燒到一隻怪」
      if (e.ventBurn !== burn) { e.ventBurn = burn; count('ventBurnsEnemy'); }
      e.hp -= T.enemyDps * dt; e.flash = 0.06;
    }
  }
  // 菌根牆（第六章）：兩道根牆從玩家兩側往中間推進、互相穿過後消失；碰到會被推著走並被刺傷。怪不受影響（菌群本來就從根裡長出來）。
  function spawnRootPair(cx, cy, dist, R) {
    const a = rand() * TAU;
    for (const sgn of [1, -1]) {
      const nx = -Math.cos(a) * sgn, ny = -Math.sin(a) * sgn; // 往中心移動的方向
      s.roots.push({ x: cx - nx * dist, y: cy - ny * dist, nx, ny, len: R.len, w: R.w, speed: R.speed, left: dist * 2 + 60, dmg: R.dmg });
    }
    s.events.push({ type: 'roots', x: cx, y: cy });
  }
  function updateRoots(dt) {
    const R = s.chapter.roots;
    if (!R) return;
    if (!s.boss) { s.rootT -= dt; if (s.rootT <= 0 && s.t > R.first) { s.rootT = R.every; spawnRootPair(p.x, p.y, R.dist, R); } }
    for (const r of s.roots) {
      const step = r.speed * dt; r.x += r.nx * step; r.y += r.ny * step; r.left -= step;
      const tx = -r.ny, ty = r.nx, rx = p.x - r.x, ry = p.y - r.y, along = rx * tx + ry * ty, perp = rx * r.nx + ry * r.ny;
      if (Math.abs(along) < r.len / 2 && Math.abs(perp) < r.w / 2 + 12) { // 被根牆推著走（推到牆的前方）
        const push = r.w / 2 + 12 - perp; p.x += r.nx * push; p.y += r.ny * push; count('rootPushFrames');
        const before = p.hp; hurtPlayer(r.dmg, 'root'); if (p.hp < before) count('rootHits');
      }
    }
    s.roots = s.roots.filter((r) => r.left > 0);
  }
  function inPool(x, y) {
    if (terrain !== 'pools') return false;
    const R = TERRAIN.pools.rMax; // 泥沼完整落在自己的格內，查 ±rMax 的範圍就夠
    return terrainIn('pools', s.terrainSeed, x - R, y - R, x + R, y + R).some((f) => (x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r);
  }

  // ---------- 傷害 ----------
  function damage(e, amount, kx = 0, ky = 0) {
    if (e.hp <= 0) return;
    const aff = e.affix && ELITE_AFFIXES[e.affix];
    const dmg = Math.max(1, Math.round(amount * p.dmgMul * (aff?.dmgTaken ?? 1) * (ENEMIES[e.kind].armor ?? 1)));
    e.hp -= dmg; e.flash = 0.08;
    if (!isBoss(e.kind)) { e.x += kx * 6 / e.mass; e.y += ky * 6 / e.mass; }
    s.events.push({ type: 'hit', x: e.x, y: e.y - e.r, v: dmg, big: dmg >= 30 });
  }
  function ignite(e, dps, dur) { if (dps > (e.burnDps || 0) || (e.burnT || 0) < dur) { e.burnDps = Math.max(dps, e.burnT > 0 ? e.burnDps : 0); e.burnT = dur; } }
  function hurtPlayer(raw, src) {
    if (p.hurtT > 0 || s.god || s.phase !== 'play') return;
    const dmg = Math.max(1, Math.round(raw * p.armorMul));
    p.hp -= dmg; p.hurtT = 0.5;
    s.events.push({ type: 'hurt', x: p.x, y: p.y, v: dmg, src });
    if (p.hp > 0) return;
    if (p.revives > 0) { // 復燃：半血復活，短暫無敵並震開周圍
      p.revives--; p.hp = p.maxHp * 0.5; p.hurtT = 2;
      s.ebullets.length = 0;
      for (const e of s.enemies) { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 160 && !isBoss(e.kind)) { e.x += dx / d * 120; e.y += dy / d * 120; } }
      s.events.push({ type: 'revive', x: p.x, y: p.y });
      return;
    }
    p.hp = 0; s.phase = 'lose'; s.events.push({ type: 'lose' });
  }

  // ---------- 武器 ----------
  function fireBolt(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const target = nearest(p.x, p.y, aimRange);
    if (!target) return;
    w.cd = st.cd * p.cdMul;
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    for (let i = 0; i < st.shots; i++) {
      const a = base + (i - (st.shots - 1) / 2) * 0.14;
      s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: 1.1, dmg: st.dmg, pierce: st.pierce, hit: new Set(), shard: st.shard || 0, big: w.id === 'bolt' && !!w.evo, evo: !!w.evo, src: w.id, burn: st.burn, burnT: st.burnT });
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
    s.events.push({ type: 'aura', x: p.x, y: p.y, r: st.radius, evo: !!w.evo });
  }
  function chainWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const reach = Math.min(260, aimRange);
    const first = nearest(p.x, p.y, reach);
    if (!first) return;
    w.cd = st.cd * p.cdMul;
    const hit = new Set();
    for (let k = 0; k < st.arcs; k++) {
      let cur = k === 0 ? first : nearest(p.x, p.y, reach, hit);
      if (!cur) break;
      const pts = [[p.x, p.y]];
      for (let j = 0; j <= st.jumps && cur; j++) {
        hit.add(cur); pts.push([cur.x, cur.y]);
        damage(cur, st.dmg);
        cur = nearest(cur.x, cur.y, st.range, hit);
      }
      s.events.push({ type: 'arc', pts, evo: !!w.evo });
    }
  }
  // 迴光刃：朝最近的敵人擲出，飛到 range 後折返回到玩家；折返時清空已命中名單，所以來回都能打到
  function boomerangWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const target = nearest(p.x, p.y, aimRange);
    if (!target) return;
    w.cd = st.cd * p.cdMul;
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    for (let i = 0; i < st.count; i++) {
      const a = base + (i - (st.count - 1) / 2) * 0.45;
      s.bullets.push({ boom: true, out: true, x: p.x, y: p.y, dx: Math.cos(a), dy: Math.sin(a), vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, speed: st.speed, range: st.range, traveled: 0, life: 6, dmg: st.dmg, pierce: 1e9, hit: new Set(), size: st.size, src: w.id, evo: !!w.evo });
    }
  }
  // 落星：挑怪最密集的點（在附近隨機取樣幾隻，數各自周圍的怪），延遲 delay 秒後範圍爆炸
  function mortarWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const cands = s.enemies.filter((e) => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 320 * 320);
    if (!cands.length) return;
    w.cd = st.cd * p.cdMul;
    const scored = [];
    for (let k = 0; k < Math.min(12, cands.length); k++) {
      const e = cands[Math.floor(rand() * cands.length)];
      let n = 0; near(e.x, e.y, (o) => { if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < st.radius * st.radius) n++; });
      scored.push({ e, n });
    }
    scored.sort((a, b) => b.n - a.n);
    for (let i = 0; i < st.count; i++) {
      const t = scored[i % scored.length].e, j = i >= scored.length ? 30 : 0;
      s.strikes.push({ x: t.x + (rand() - 0.5) * j, y: t.y + (rand() - 0.5) * j, r: st.radius, t: st.delay + i * 0.08, delay: st.delay, dmg: st.dmg, src: w.id, evo: !!w.evo });
    }
  }
  function updateStrikes(dt) {
    for (const k of s.strikes) {
      k.t -= dt;
      if (k.t > 0) continue;
      near(k.x, k.y, (e) => { if (e.hp > 0 && (e.x - k.x) ** 2 + (e.y - k.y) ** 2 < (k.r + e.r) ** 2) damage(e, k.dmg, 0, 0); }, Math.ceil(k.r / CELL) + 1);
      s.events.push({ type: 'strike', x: k.x, y: k.y, r: k.r, src: k.src, evo: k.evo });
    }
    s.strikes = s.strikes.filter((k) => k.t > 0);
  }
  // 燈焰吐息：火口朝最近的敵人「轉過去」（每秒最多轉 turn 弧度，所以是掃過去的），錐形範圍內每 tick 灼燒一次
  // （最初版本朝移動方向噴——但被追時玩家是在逃，火焰一直朝空氣噴，單武器測試每分鐘只擊倒 14 隻，所以改掉）
  function flameWeapon(w, st, dt) {
    w.ang ??= Math.atan2(p.aimY, p.aimX);
    const t = nearest(p.x, p.y, st.range * 1.6);
    if (t) {
      let diff = Math.atan2(t.y - p.y, t.x - p.x) - w.ang;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      w.ang += Math.max(-st.turn * dt, Math.min(st.turn * dt, diff));
    }
    const ax = Math.cos(w.ang), ay = Math.sin(w.ang);
    w.flame = { range: st.range, half: st.half, ax, ay };
    w.cd -= dt;
    if (w.cd > 0) return;
    w.cd = st.tick * p.cdMul;
    const cosH = Math.cos(st.half);
    near(p.x, p.y, (e) => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d - e.r < st.range && (dx * ax + dy * ay) / d >= cosH) damage(e, st.dmg, 0, 0);
    }, Math.ceil(st.range / CELL) + 1);
  }
  // 螢蜂：各自追最近的敵人，碰到就傷害並短暫冷卻；沒目標時繞著玩家飛
  function wispsWeapon(w, st, dt) {
    while (w.wisps.length < st.count) w.wisps.push({ x: p.x, y: p.y, cd: 0, target: null, ang: rand() * TAU });
    for (const q of w.wisps) {
      q.cd -= dt;
      if (!q.target || q.target.hp <= 0 || (q.target.x - p.x) ** 2 + (q.target.y - p.y) ** 2 > st.seek * st.seek * 1.5) q.target = nearest(q.x, q.y, st.seek);
      let tx, ty;
      if (q.target && q.cd <= 0) { tx = q.target.x; ty = q.target.y; }
      else { q.ang += dt * 3; tx = p.x + Math.cos(q.ang) * 34; ty = p.y + Math.sin(q.ang) * 34; }
      const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, st.speed * dt);
      q.x += dx / d * v; q.y += dy / d * v;
      if (q.target && q.cd <= 0 && (q.target.x - q.x) ** 2 + (q.target.y - q.y) ** 2 < (q.target.r + 6) ** 2) {
        damage(q.target, st.dmg, dx / d, dy / d); q.cd = st.hitCd; q.target = null;
      }
    }
  }
  // 燈籠雷：定時在腳下放一顆（最多 max 顆），佈好（arm）後有敵人踩進 trigger 範圍就爆
  function minesWeapon(w, st, dt) {
    w.cd -= dt;
    const mine = s.mines.filter((m) => m.src === w);
    if (w.cd <= 0 && mine.length < st.max) { w.cd = st.cd * p.cdMul; s.mines.push({ x: p.x, y: p.y, arm: st.arm, trigger: st.trigger, r: st.radius, dmg: st.dmg, src: w, evo: !!w.evo }); }
  }
  function updateMines(dt) {
    for (const m of s.mines) {
      m.arm -= dt;
      if (m.arm > 0) continue;
      let hit = false;
      near(m.x, m.y, (e) => { if (!hit && e.hp > 0 && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (m.trigger + e.r) ** 2) hit = true; });
      if (!hit) continue;
      near(m.x, m.y, (e) => { if (e.hp > 0 && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (m.r + e.r) ** 2) damage(e, m.dmg, 0, 0); }, Math.ceil(m.r / CELL) + 1);
      s.events.push({ type: 'mineBoom', x: m.x, y: m.y, r: m.r, evo: m.evo });
      m.done = true;
    }
    s.mines = s.mines.filter((m) => !m.done);
  }
  // ---- M7 第三批新武器 ----
  // 聚光槍：朝最近的敵人瞬間射出一道光束（beams 道時等角度分散），整條線上的怪都受傷——打「一排」，不是打「一隻」
  function lanceWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    const target = nearest(p.x, p.y, aimRange);
    if (!target) return;
    w.cd = st.cd * p.cdMul;
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    for (let i = 0; i < st.beams; i++) {
      const a = base + (i / st.beams) * TAU, cx = Math.cos(a), cy = Math.sin(a);
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const rx = e.x - p.x, ry = e.y - p.y, along = rx * cx + ry * cy;
        if (along > 0 && along < st.len && Math.abs(rx * cy - ry * cx) < st.w / 2 + e.r) damage(e, st.dmg, cx, cy);
      }
      s.events.push({ type: 'lance', x: p.x, y: p.y, ang: a, len: st.len, w: st.w, evo: !!w.evo });
    }
  }
  // 燈鐘：每隔一段時間敲響，一圈震波傷害並把周圍的怪推開——唯一會擊退的武器，被包圍時用來開路
  function pulseWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd > 0) return;
    w.cd = st.cd * p.cdMul;
    near(p.x, p.y, (e) => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (e.hp <= 0 || d > st.radius + e.r) return;
      damage(e, st.dmg, 0, 0);
      if (!isBoss(e.kind)) { const k = st.push / e.mass; e.x += dx / d * k; e.y += dy / d * k; }
    }, Math.ceil(st.radius / CELL) + 1);
    s.events.push({ type: 'pulse', x: p.x, y: p.y, r: st.radius, evo: !!w.evo });
  }
  // 燈塔哨：在腳下立一座小燈塔（最多 max 座、存在 life 秒），自己朝射程內最近的怪射擊——邊跑邊留下火力點
  function sentryWeapon(w, st, dt) {
    w.cd -= dt;
    if (w.cd <= 0 && s.sentries.filter((q) => q.src === w).length < st.max) { w.cd = st.cd * p.cdMul; s.sentries.push({ x: p.x, y: p.y, life: st.life, fire: 0.2, src: w }); }
  }
  function updateSentries(dt) {
    for (const q of s.sentries) {
      q.life -= dt; q.fire -= dt;
      if (q.fire > 0) continue;
      const st = weaponStats(q.src), t = nearest(q.x, q.y, st.range);
      if (!t) continue;
      q.fire = st.fireCd * p.cdMul;
      const base = Math.atan2(t.y - q.y, t.x - q.x);
      for (let i = 0; i < st.shots; i++) { const a = base + (i - (st.shots - 1) / 2) * 0.18; s.bullets.push({ x: q.x, y: q.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.9, dmg: st.dmg, pierce: st.pierce ?? 1, hit: new Set(), shard: 0, src: 'sentry', sentry: true, evo: !!q.src.evo }); }
    }
    s.sentries = s.sentries.filter((q) => q.life > 0 && p.weapons.includes(q.src));
  }
  const WEAPON_FN = { bolt: fireBolt, orbit: orbitWeapon, aura: auraWeapon, chain: chainWeapon, boomerang: boomerangWeapon, mortar: mortarWeapon, flame: flameWeapon, wisps: wispsWeapon, mines: minesWeapon, lance: lanceWeapon, pulse: pulseWeapon, sentry: sentryWeapon };

  // ---------- 敵人行為 ----------
  function shoot(e, ux, uy, speed, dmg, r, spread = [0], extra = null) {
    for (const off of spread) { const c = Math.cos(off), sn = Math.sin(off); s.ebullets.push({ x: e.x, y: e.y, vx: (ux * c - uy * sn) * speed, vy: (uy * c + ux * sn) * speed, life: 4, dmg, r, ...extra }); }
  }
  const eliteDmg = (e) => (e.elite ? ELITE.dmgMul : 1);
  function enemyMove(e, dt) {
    const t = ENEMIES[e.kind];
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const spd = t.speed * (e.affix === 'swift' ? ELITE_AFFIXES.swift.speedMul : 1) * (e.slowT > 0 ? 1 - e.slow : 1);
    let vx = ux, vy = uy;
    e.cdT -= dt; e.modeT -= dt;
    switch (t.ai) {
      case 'weave': { const w = Math.sin(s.t * 4 + e.seed) * 0.7; vx = ux - uy * w; vy = uy + ux * w; break; }
      case 'spit': {
        const dir = d > t.keep + 20 ? 1 : d < t.keep - 20 ? -0.8 : 0;
        const side = Math.sin(e.seed) > 0 ? 1 : -1;
        vx = ux * dir - uy * side * 0.5; vy = uy * dir + ux * side * 0.5;
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 320) { e.fireT = t.fireCd; shoot(e, ux, uy, t.shotSpeed ?? 110, t.shotDmg * eliteDmg(e), e.elite ? 8 : 5, e.elite ? [-0.35, 0, 0.35] : [0], t.slowShot ? { slow: t.slowShot, src: 'frost', frost: true } : null); }
        break;
      }
      case 'turret': {
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 360) { e.fireT = t.fireCd; shoot(e, ux, uy, 120, t.shotDmg * eliteDmg(e), 6, e.elite ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3]); s.events.push({ type: 'burst', x: e.x, y: e.y, small: true }); }
        return [0, 0];
      }
      case 'lunge': { // 靠近 → 蓄力（原地、顯示預警線）→ 高速撲擊 → 冷卻
        if (e.mode === 'windup') { if (e.modeT <= 0) { e.mode = 'lunge'; e.modeT = t.lungeT; e.tele = null; } return [0, 0]; }
        if (e.mode === 'lunge') { if (e.modeT <= 0) { e.mode = 'move'; e.cdT = t.lungeCd; } return [e.dirX * t.lungeSpeed, e.dirY * t.lungeSpeed]; }
        if (d < t.range && e.cdT <= 0) { e.mode = 'windup'; e.modeT = t.windup; e.dirX = ux; e.dirY = uy; e.tele = { dx: ux, dy: uy, len: t.lungeSpeed * t.lungeT, w: e.r }; return [0, 0]; }
        break;
      }
      case 'bomber': { // 靠近就點燃引信，燃燒中仍慢慢貼近（逼玩家走開），時間到爆炸（也會炸到其他怪）
        if (e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { explode(e, t); return [0, 0]; } return [ux * spd * 0.5, uy * spd * 0.5]; }
        if (d < t.blastR * 1.25) e.fuse = t.fuse;
        break;
      }
      case 'blink': { // 預警標記出現在玩家身邊，時間到瞬移過去
        if (e.warn) { e.warn.t -= dt; if (e.warn.t <= 0) { e.x = e.warn.x; e.y = e.warn.y; e.warn = null; e.cdT = t.blinkCd; s.events.push({ type: 'blink', x: e.x, y: e.y }); } return [0, 0]; }
        if (e.cdT <= 0 && d < 420 && d > 90) { const a = rand() * TAU; e.warn = { x: p.x + Math.cos(a) * 70, y: p.y + Math.sin(a) * 70, t: t.blinkWarn }; return [0, 0]; }
        break;
      }
      case 'slam': { // 焦岩獸：靠近後原地蓄力（地面預警圈），砸下震波
        if (e.mode === 'windup') { if (e.modeT <= 0) { e.mode = 'move'; e.cdT = t.slamCd; } return [0, 0]; }
        if (d < t.slamR * 0.85 && e.cdT <= 0) {
          e.mode = 'windup'; e.modeT = t.windup;
          s.hazards.push({ type: 'zone', x: e.x, y: e.y, r: t.slamR, arm: t.windup, dur: 0.15, t: 0, dmg: Math.round(t.slamDmg * eliteDmg(e)), src: 'slam' }); count('slams');
          return [0, 0];
        }
        break;
      }
      case 'hive': { // 菌巢：不動，每隔一段時間生出小怪（同時存活有上限）；不先拆掉它，怪會一直冒
        if (e.cdT <= 0) {
          e.cdT = t.spawnCd;
          const alive = s.enemies.filter((o) => o.hive === e && o.hp > 0).length;
          // 菌巢生的怪也算進本章一般怪的上限（量過：不算的話第六章同屏衝到 425 隻、邏輯耗時超過門檻）
          const room = Math.min(s.chapter.maxEnemies - (s.enemies.length - s.surgeAlive), SURGE.total - s.enemies.length);
          for (let i = 0; i < t.spawn.n && alive + i < t.spawn.max && i < room; i++) { const a = rand() * TAU; spawnEnemy(t.spawn.kind, { x: e.x + Math.cos(a) * (e.r + 14), y: e.y + Math.sin(a) * (e.r + 14) }).hive = e; count('hiveSpawns'); }
        }
        return [0, 0];
      }
      case 'boss': return BOSS_AI[e.kind](e, dt, ux, uy, d);
    }
    const len = Math.hypot(vx, vy) || 1;
    return [vx / len * spd, vy / len * spd];
  }
  function explode(e, t) {
    s.events.push({ type: 'blast', x: e.x, y: e.y, r: t.blastR });
    if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (t.blastR + 8) ** 2) hurtPlayer(Math.round(t.blastDmg * eliteDmg(e) * s.chapter.dmgScale(s.t)), 'blast');
    for (const o of s.enemies) if (o !== e && o.hp > 0 && !isBoss(o.kind) && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < t.blastR * t.blastR) { o.hp -= t.blastHurtsEnemies; o.flash = 0.1; }
    e.hp = 0; e.noReward = true; // 自爆不算玩家擊倒
  }
  function radial(e, n, speed, offset, dmg) {
    for (let i = 0; i < n; i++) { const a = offset + (i / n) * TAU; s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 5, dmg, r: 7 }); }
  }
  function bossPhase(e, lines) {
    const frac = e.hp / e.maxHp, phase = frac > 0.6 ? 1 : frac > 0.25 ? 2 : 3;
    if (phase !== e.bphase) { e.bphase = phase; s.events.push({ type: 'announce', text: lines[phase - 2] }); if (phase === 2) e.summonT = 0; }
    return phase;
  }
  function summonEvery(e, dt, gap, kind, n, dist = 50) {
    e.summonT -= dt;
    if (e.summonT > 0) return;
    e.summonT = gap;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; spawnEnemy(kind, { x: e.x + Math.cos(a) * dist, y: e.y + Math.sin(a) * dist }); }
  }
  // 衝刺共用：move → windup（預警）→ dash；回傳這一幀的速度，trail 為衝刺時每幀呼叫
  function dashStep(e, ux, uy, speed, windup, dashT, dashSpeed, teleLen, trail) {
    if (e.mode === 'windup') { e.tele = { dx: e.dirX, dy: e.dirY, len: teleLen, w: e.r }; if (e.modeT <= 0) { e.mode = 'dash'; e.modeT = dashT; e.tele = null; } return [0, 0]; }
    if (e.mode === 'dash') { if (e.modeT <= 0) e.mode = 'move'; trail?.(); return [e.dirX * dashSpeed, e.dirY * dashSpeed]; }
    if (e.dashT <= 0) { e.mode = 'windup'; e.modeT = windup; e.dirX = ux; e.dirY = uy; return [0, 0]; }
    return [ux * speed, uy * speed];
  }
  const BOSS_AI = {
    // 噬燈菌母：孢子彈幕 → 召喚＋衝撞 → 旋轉孢雨
    boss1(e, dt, ux, uy) {
      const phase = bossPhase(e, ['菌母暴躁起來了！', '菌母孢雨狂亂！']);
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstT = phase === 3 ? 1.6 : 3;
        radial(e, phase === 1 ? 12 : 16, phase === 3 ? 115 : 100, phase === 3 ? s.t * 1.7 : rand() * TAU, 10);
        s.events.push({ type: 'burst', x: e.x, y: e.y });
      }
      if (phase >= 2) summonEvery(e, dt, 11, 'mite', 6);
      if (phase >= 2 && e.mode === 'move') e.dashT -= dt;
      const v = dashStep(e, ux, uy, ENEMIES.boss1.speed, 0.9, 0.55, 600, 330);
      if (e.mode !== 'move' && e.dashT <= 0) e.dashT = phase === 3 ? 3.5 : 5; // 開始蓄力就排下一次
      return v;
    },
    // 沼母巨蛭：連續三段撲擊，沿路留下毒沼 → 召喚沼蛭＋孢環 → 更快的撲擊
    boss2(e, dt, ux, uy) {
      const phase = bossPhase(e, ['巨蛭召來了子嗣！', '巨蛭陷入狂亂！']);
      if (e.mode === 'move') e.dashT -= dt;
      if (e.mode === 'move' && e.dashT <= 0 && e.combo === 0) e.combo = 3;
      const windup = phase === 3 ? 0.5 : 0.7, before = e.mode;
      const v = dashStep(e, ux, uy, ENEMIES.boss2.speed, windup, 0.42, 520, 220, () => {
        e.trailAcc = (e.trailAcc || 0) + dt;
        if (e.trailAcc > 0.1) { e.trailAcc = 0; s.hazards.push({ type: 'zone', x: e.x, y: e.y, r: 30, arm: 0.4, dur: 4, t: 0, dmg: 9, src: 'poison' }); }
      });
      if (before === 'dash' && e.mode === 'move') { e.combo = Math.max(0, e.combo - 1); e.dashT = e.combo > 0 ? 0.25 : (phase === 3 ? 3 : 4.2); }
      if (phase >= 2) {
        summonEvery(e, dt, 12, 'leech', 5, 60);
        e.burstT -= dt;
        if (e.burstT <= 0) { e.burstT = phase === 3 ? 2.6 : 3.5; radial(e, phase === 3 ? 18 : 14, 105, rand() * TAU, 10); s.events.push({ type: 'burst', x: e.x, y: e.y }); }
      }
      return v;
    },
    // 熔心巨獸：砸地震波＋在你腳下點火 → 加上衝撞（沿路留下火痕）→ 更快
    boss4(e, dt, ux, uy) {
      const phase = bossPhase(e, ['巨獸身上的裂縫噴出火焰！', '熔心沸騰！']);
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstT = phase === 3 ? 2.2 : 3.2;
        radial(e, phase === 1 ? 14 : 20, 110, rand() * TAU, 12);
        for (let i = 0; i < (phase === 3 ? 4 : 3); i++) { const a = rand() * TAU, r = i === 0 ? 0 : 50 + rand() * 90; s.hazards.push({ type: 'zone', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 40, arm: 1.1, dur: 0.6, t: 0, dmg: 20, src: 'fire' }); }
        s.events.push({ type: 'burst', x: e.x, y: e.y });
      }
      if (phase >= 2 && e.mode === 'move') e.dashT -= dt;
      const v = dashStep(e, ux, uy, ENEMIES.boss4.speed, phase === 3 ? 0.6 : 0.8, 0.5, 560, 280, () => {
        e.trailAcc = (e.trailAcc || 0) + dt;
        if (e.trailAcc > 0.1) { e.trailAcc = 0; s.hazards.push({ type: 'zone', x: e.x, y: e.y, r: 30, arm: 0.3, dur: 3, t: 0, dmg: 12, src: 'fire' }); }
      });
      if (e.mode !== 'move' && e.dashT <= 0) e.dashT = phase === 3 ? 3.2 : 4.5;
      if (phase >= 2) summonEvery(e, dt, 13, 'cinder', 6, 60);
      return v;
    },
    // 霜冠巨像：減速冰針彈幕 → 加上霜地（腳下預警圈）→ 加上旋轉冰光束
    boss5(e, dt, ux, uy) {
      const phase = bossPhase(e, ['霜冠降下寒霜！', '巨像全力凍結！']);
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burstT = phase === 3 ? 1.8 : 2.6;
        const n = phase === 1 ? 14 : 18, off = rand() * TAU;
        for (let i = 0; i < n; i++) { const a = off + (i / n) * TAU; s.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 5, dmg: 11, r: 7, slow: { t: 1.4, k: 0.4 }, src: 'frost', frost: true }); }
        s.events.push({ type: 'burst', x: e.x, y: e.y });
      }
      if (phase >= 2) {
        e.rainT -= dt;
        if (e.rainT <= 0) { e.rainT = phase === 3 ? 2.6 : 3.6; for (let i = 0; i < 5; i++) { const a = rand() * TAU, r = i === 0 ? 0 : 40 + rand() * 100; s.hazards.push({ type: 'zone', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 44, arm: 1.0, dur: 0.3, t: 0, dmg: 22, src: 'frostzone' }); } }
      }
      if (phase === 3) {
        e.beamT -= dt;
        if (e.beamT <= 0) { const a0 = rand() * TAU; for (let i = 0; i < 2; i++) s.hazards.push({ type: 'beam', owner: e, ang: a0 + i * Math.PI, spin: 0.6, len: 600, w: 20, arm: 1.0, dur: 3, t: 0, dmg: 16, src: 'beam' }); e.beamT = 6; }
      }
      if (phase >= 2) summonEvery(e, dt, 12, 'glider', 4, 70);
      return [ux * ENEMIES.boss5.speed, uy * ENEMIES.boss5.speed];
    },
    // 深根之心：不太移動；孢子彈幕＋召喚菌巢 → 場內菌根牆包夾 → 全部加快、加上孢雨
    boss6(e, dt, ux, uy) {
      const phase = bossPhase(e, ['菌根從地底竄出！', '深根之心狂暴了！']);
      e.burstT -= dt;
      if (e.burstT <= 0) { e.burstT = phase === 3 ? 1.6 : 2.6; radial(e, phase === 1 ? 16 : 22, 105, s.t * 1.3, 12); s.events.push({ type: 'burst', x: e.x, y: e.y }); }
      summonEvery(e, dt, phase === 3 ? 10 : 15, 'hive', 1, 140);
      if (phase >= 2) { s.rootT -= dt; if (s.rootT <= 0) { s.rootT = phase === 3 ? 6 : 8; spawnRootPair(s.arena.x, s.arena.y, s.arena.r * 0.95, { ...s.chapter.roots, speed: s.chapter.roots.speed * 1.4 }); } }
      if (phase === 3) {
        e.rainT -= dt;
        if (e.rainT <= 0) { e.rainT = 3; for (let i = 0; i < 6; i++) { const a = rand() * TAU, r = i === 0 ? 0 : 40 + rand() * 110; s.hazards.push({ type: 'zone', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 40, arm: 1.0, dur: 0.25, t: 0, dmg: 24, src: 'rain' }); } }
      }
      return [ux * ENEMIES.boss6.speed, uy * ENEMIES.boss6.speed];
    },
    // 晶心守衛：旋轉光束（先預警）→ 加上晶雨（地面預警圈）→ 更多、更快的光束＋召喚晶刺
    boss3(e, dt, ux, uy) {
      const phase = bossPhase(e, ['晶心裂開，晶雨落下！', '晶心全力運轉！']);
      e.beamT -= dt;
      if (e.beamT <= 0) {
        const n = phase + 1, spin = (rand() < 0.5 ? -1 : 1) * (phase === 3 ? 0.8 : 0.55), a0 = rand() * TAU;
        for (let i = 0; i < n; i++) s.hazards.push({ type: 'beam', owner: e, ang: a0 + (i / n) * TAU, spin, len: 620, w: 22, arm: 1.0, dur: 3.2, t: 0, dmg: 16, src: 'beam' });
        e.beamT = phase === 3 ? 5 : 6.5;
      }
      if (phase >= 2) {
        e.rainT -= dt;
        if (e.rainT <= 0) {
          e.rainT = phase === 3 ? 3 : 4;
          const n = phase === 3 ? 7 : 5;
          for (let i = 0; i < n; i++) { const a = rand() * TAU, r = i === 0 ? 0 : 40 + rand() * 110; s.hazards.push({ type: 'zone', x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, r: 42, arm: 1.0, dur: 0.25, t: 0, dmg: 22, src: 'rain' }); }
        }
      }
      if (phase === 3) summonEvery(e, dt, 14, 'turret', 2, 120);
      return [ux * ENEMIES.boss3.speed, uy * ENEMIES.boss3.speed];
    },
  };

  // ---------- 地面危險（預警 arm 秒後生效 dur 秒） ----------
  function updateHazards(dt) {
    for (const h of s.hazards) {
      h.t += dt;
      if (h.type === 'beam') {
        if (h.owner.hp <= 0) { h.t = 1e9; continue; }
        h.x = h.owner.x; h.y = h.owner.y;
        if (h.t >= h.arm) h.ang += h.spin * dt;
      }
      if (h.t < h.arm || h.t > h.arm + h.dur) continue;
      if (h.type === 'zone' && (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < (h.r + 8) ** 2) hurtPlayer(h.dmg, h.src); // 地面危險是固定傷害，不吃時間倍率
      if (h.type === 'beam') {
        const cx = Math.cos(h.ang), cy = Math.sin(h.ang), rx = p.x - h.x, ry = p.y - h.y, along = rx * cx + ry * cy;
        if (along > 0 && along < h.len && Math.abs(rx * cy - ry * cx) < h.w / 2 + 8) hurtPlayer(h.dmg, h.src);
      }
    }
    s.hazards = s.hazards.filter((h) => h.t <= h.arm + h.dur);
  }

  // ---------- 主更新 ----------
  function update(dt, move) {
    if (s.phase !== 'play') return;
    s.t += dt;
    const ch = s.chapter;

    // 玩家
    p.inPool = inPool(p.x, p.y);
    p.slowT = Math.max(0, p.slowT - dt);
    const spd = p.speed * (p.inPool ? TERRAIN.pools.slow : 1) * (p.slowT > 0 ? 1 - p.slowK : 1);
    p.onIce = !!cellFeature('ice', p.x, p.y);
    if (p.onIce) { // 冰面：速度只慢慢靠近操作方向（慣性），轉向與煞車都會滑
      const k = 1 - Math.exp(-TERRAIN.ice.grip * dt);
      p.vx += (move.x * spd - p.vx) * k; p.vy += (move.y * spd - p.vy) * k; count('iceTime', dt);
    } else { p.vx = move.x * spd; p.vy = move.y * spd; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (move.x) p.facing = move.x > 0 ? 1 : -1;
    { const ml = Math.hypot(move.x, move.y); if (ml > 0.1) { p.aimX = move.x / ml; p.aimY = move.y / ml; } } // 燈焰吐息的方向
    pushOutOfPillars(p, 12);
    if (s.arena) clampArena(p, 14);
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // 生怪與時間軸事件
    while (s.eventIdx < ch.events.length && s.t >= ch.events[s.eventIdx].at) runEvent(ch.events[s.eventIdx++]);
    s.surgeAlive = 0; for (const e of s.enemies) if (e.surge) s.surgeAlive++; // 每次都重數，不靠加減（怪有很多種離場方式）
    if (s.autoSpawn && s.surgeOn) updateSurge();
    if (s.autoSpawn && !s.boss) {
      s.spawnAcc += dt * ch.spawnRate(s.t);
      // 一般生怪只看「非菌潮」的怪數：菌潮滿場時照樣出本章的怪，否則每章的招牌怪（脹孢囊、沼蛭…）會被菌潮擠掉（M7 量過：第二章脹孢囊引信從 136 次掉到 1 次）
      while (s.spawnAcc >= 1) { s.spawnAcc -= 1; if (s.enemies.length - s.surgeAlive < ch.maxEnemies && s.enemies.length < SURGE.total) spawnEnemy(rosterPick()); }
    }

    buildGrid();

    // 敵人移動＋互推＋接觸傷害
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const [vx, vy] = enemyMove(e, dt);
      let sx = 0, sy = 0;
      near(e.x, e.y, (o) => {
        if (o === e) return;
        const ox = e.x - o.x, oy = e.y - o.y, od = ox * ox + oy * oy, min = e.r + o.r;
        if (od < min * min && od > 0.01) { const k = (min - Math.sqrt(od)) / min * (o.mass / (e.mass + o.mass)) * 2; sx += ox * k; sy += oy * k; }
      });
      e.x += (vx + sx * 4) * dt; e.y += (vy + sy * 4) * dt;
      if (!isBoss(e.kind)) pushOutOfPillars(e, e.r);
      if (s.arena) clampArena(e, e.r);
      e.frame += dt * 6; e.flash = Math.max(0, e.flash - dt); e.orbT -= dt; e.slowT -= dt;
      if (e.affix === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITE_AFFIXES.regen.regen * dt);
      if (e.burnT > 0) { // 燃燒：每 0.5 秒結算一次（吃玩家的傷害加成）
        e.burnT -= dt; e.burnAcc = (e.burnAcc || 0) + dt;
        if (e.burnAcc >= 0.5) { e.burnAcc -= 0.5; damage(e, e.burnDps * 0.5, 0, 0); }
      }
      const d2 = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
      if (e.hp > 0 && d2 < (e.r + 10) ** 2) hurtPlayer(Math.round(ENEMIES[e.kind].dmg * eliteDmg(e) * ch.dmgScale(s.t)), (e.elite ? 'elite-' : '') + e.kind);
    }
    updateHazards(dt); updateVents(dt); updateRoots(dt);

    // 武器
    for (const w of p.weapons) WEAPON_FN[WEAPONS[w.id].kind ?? w.id](w, weaponStats(w), dt);
    updateStrikes(dt); updateMines(dt); updateSentries(dt);

    // 玩家子彈
    for (const b of s.bullets) {
      if (b.boom) { // 迴光刃：去程直線，到頂後轉向追回玩家
        if (b.out) { b.traveled += b.speed * dt; if (b.traveled >= b.range) { b.out = false; b.hit = new Set(); } }
        else { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * b.speed * 1.1; b.vy = dy / d * b.speed * 1.1; if (d < 16) b.life = 0; }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      if (!b.boom && pillarAt(b.x, b.y)) { b.life = 0; s.events.push({ type: 'spark', x: b.x, y: b.y }); continue; }
      near(b.x, b.y, (e) => {
        if (b.life <= 0 || e.hp <= 0 || b.hit.has(e)) return;
        const rr = e.r + (b.size ?? (b.big ? 9 : 4));
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          b.hit.add(e);
          const sp = Math.hypot(b.vx, b.vy);
          damage(e, b.dmg, b.vx / sp, b.vy / sp);
          if (b.burn) ignite(e, b.burn, b.burnT);
          if (e.hp <= 0 && b.shard) for (let i = 0; i < b.shard; i++) { const a = rand() * TAU; s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 0.45, dmg: b.dmg * 0.5, pierce: 1, hit: new Set([e]), shard: 0, src: 'shard' }); }
          if (--b.pierce <= 0) b.life = 0;
        }
      });
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);

    // 敵方子彈
    for (const b of s.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (pillarAt(b.x, b.y)) { b.life = 0; continue; }
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + 8) ** 2) {
        hurtPlayer(b.dmg, b.src ?? 'spore'); b.life = 0;
        if (b.slow) { p.slowT = b.slow.t; p.slowK = b.slow.k; count('frostSlows'); } // 霜冰針：命中會減速
      }
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
      for (const e of s.enemies) if (!e.elite && Math.hypot(e.x - p.x, e.y - p.y) > far) { const a = rand() * TAU; e.x = p.x + Math.cos(a) * spawnDist(); e.y = p.y + Math.sin(a) * spawnDist(); e.warn = null; e.fuse = 0; }
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
    // 共鳴燈核：等著共鳴的武器比場上的燈核多時，計時到了就在玩家附近放一顆（競技場裡放在圈內）
    const waiting = p.weapons.filter(canEvolve).length, chests = s.pickups.filter((it) => it.type === 'chest').length;
    if (waiting > chests) {
      s.resoChestT += dt;
      if (s.resoChestT >= RESO_CHEST.delay) {
        s.resoChestT = 0;
        const a = rand() * TAU;
        let x = p.x + Math.cos(a) * RESO_CHEST.dist, y = p.y + Math.sin(a) * RESO_CHEST.dist;
        if (s.arena) { const dx = x - s.arena.x, dy = y - s.arena.y, d = Math.hypot(dx, dy), lim = s.arena.r * 0.7; if (d > lim) { x = s.arena.x + dx / d * lim; y = s.arena.y + dy / d * lim; } }
        s.pickups.push({ type: 'chest', x, y, reso: true });
        count('resoChests');
        s.events.push({ type: 'announce', text: '燈芯共鳴：燈核出現了！' });
      }
    } else {
      s.resoChestT = 0;
      // 多出來的共鳴燈核收回（例如等著的那把已經被精英的燈核共鳴了）：它只補共鳴，不可以變成額外的一般強化
      let extra = chests - waiting;
      if (extra > 0) s.pickups = s.pickups.filter((it) => !(it.reso && extra-- > 0));
    }

    // 勝利：Boss 倒下後稍等一下讓玩家看到爆炸
    if (s.winT > 0) { s.winT -= dt; if (s.winT <= 0) { s.phase = 'win'; s.events.push({ type: 'win' }); } }

    if (s.phase === 'play') nextChoice();
  }

  function clampArena(o, pad) {
    const dx = o.x - s.arena.x, dy = o.y - s.arena.y, d = Math.hypot(dx, dy), max = s.arena.r - pad;
    if (d > max) { o.x = s.arena.x + dx / d * max; o.y = s.arena.y + dy / d * max; }
  }

  // 擊倒的唯一入口：燈油帳（ledger）與 kill 事件都只在這裡寫，兩者必須一致（tools/meta-test.mjs 檢查）
  function onKill(e) {
    if (e.noReward) { s.events.push({ type: 'fade', x: e.x, y: e.y }); return; }
    const t = ENEMIES[e.kind];
    s.kills++;
    if (isBoss(e.kind)) {
      s.ledger.boss = e.kind;
      s.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, elite: false, boss: true });
      s.boss = null; s.winT = 1.8; s.god = true;
      for (const o of s.enemies) { o.hp = 0; s.events.push({ type: 'fade', x: o.x, y: o.y }); }
      s.enemies = []; s.ebullets = []; s.hazards = [];
      s.events.push({ type: 'bossdown', x: e.x, y: e.y });
      return;
    }
    if (e.elite) s.ledger.elites++;
    else s.ledger.kills[e.kind] = (s.ledger.kills[e.kind] || 0) + 1;
    s.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind, elite: e.elite });
    s.gems.push({ x: e.x, y: e.y, v: t.xp * (e.elite ? ELITE.xpMul : 1), pull: false });
    if (e.elite) s.pickups.push({ type: 'chest', x: e.x, y: e.y });
    else {
      const r = rand();
      if (r < 0.006) s.pickups.push({ type: 'heal', x: e.x, y: e.y });
      else if (r < 0.009) s.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    }
    if (t.deathZone) { s.hazards.push({ type: 'zone', x: e.x, y: e.y, r: t.deathZone.r, arm: 0.5, dur: t.deathZone.dur, t: 0, dmg: t.deathZone.dmg, src: 'fire' }); count('cinderZones'); }
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

  const agg0 = recalc();
  p.hp = p.maxHp;
  p.revives = Math.floor(scaled(0, agg0.revive));
  const w0 = addWeapon(WEAPONS[startWeapon] ? startWeapon : START_WEAPON);
  if (startBonus?.lv > 1) w0.lv = Math.min(MAX_LV, startBonus.lv);
  if (startBonus?.passive && PASSIVES[startBonus.passive]) { p.passives[startBonus.passive] = 1; recalc(); p.hp = p.maxHp; }
  return { state: s, update, choose, closeChest, spawnEnemy, addWeapon, openChest, gainXp, recalc, options, describe };
}
