// 遊戲內容資料：武器、被動、共鳴、怪物、章節時間軸。數值都集中在這裡調。
// 規則在 sim.js；這裡只放資料。所有名稱為本作原創。

// ---- 武器（每把 5 級；lv[i] 是第 i+1 級的完整數值） ----
export const WEAPONS = {
  bolt: {
    name: '螢火連弩', color: '#ffd27a',
    desc: ['朝最近的敵人射出光矢', '光矢 +1', '傷害 +40%、穿透 +1', '光矢 +1、射速加快', '光矢 +1、穿透 +1'],
    lv: [
      { dmg: 10, cd: 0.55, shots: 1, pierce: 1, speed: 430 },
      { dmg: 10, cd: 0.55, shots: 2, pierce: 1, speed: 430 },
      { dmg: 14, cd: 0.55, shots: 2, pierce: 2, speed: 430 },
      { dmg: 14, cd: 0.45, shots: 3, pierce: 2, speed: 450 },
      { dmg: 16, cd: 0.45, shots: 4, pierce: 3, speed: 470 },
    ],
  },
  orbit: {
    name: '環燈', color: '#8fe8ff',
    desc: ['光球環繞身邊，撞到敵人造成傷害', '光球 +1', '傷害 +50%、半徑變大', '光球 +1、轉速加快', '光球 +1、傷害 +30%'],
    lv: [
      { dmg: 12, count: 2, radius: 46, spin: 3.0, size: 8 },
      { dmg: 12, count: 3, radius: 46, spin: 3.0, size: 8 },
      { dmg: 18, count: 3, radius: 56, spin: 3.0, size: 9 },
      { dmg: 18, count: 4, radius: 56, spin: 3.8, size: 9 },
      { dmg: 24, count: 5, radius: 60, spin: 3.8, size: 10 },
    ],
  },
  aura: {
    name: '燈暈', color: '#ffb35a',
    desc: ['身邊的暖光持續灼燒敵人', '範圍變大', '傷害 +50%', '範圍變大、灼燒更頻繁', '傷害 +50%、敵人減速'],
    lv: [
      { dmg: 6, radius: 58, tick: 0.5, slow: 0 },
      { dmg: 6, radius: 70, tick: 0.5, slow: 0 },
      { dmg: 9, radius: 70, tick: 0.5, slow: 0 },
      { dmg: 9, radius: 82, tick: 0.4, slow: 0 },
      { dmg: 14, radius: 86, tick: 0.4, slow: 0.35 },
    ],
  },
  chain: {
    name: '雷蕊', color: '#c6a8ff',
    desc: ['電弧擊中敵人後跳向附近目標', '跳躍 +2', '傷害 +50%', '跳躍 +2、充能加快', '同時放出兩道電弧'],
    lv: [
      { dmg: 16, cd: 1.4, jumps: 2, range: 110, arcs: 1 },
      { dmg: 16, cd: 1.4, jumps: 4, range: 110, arcs: 1 },
      { dmg: 24, cd: 1.4, jumps: 4, range: 120, arcs: 1 },
      { dmg: 24, cd: 1.1, jumps: 6, range: 130, arcs: 1 },
      { dmg: 28, cd: 1.1, jumps: 6, range: 130, arcs: 2 },
    ],
  },
};

// ---- 被動（每項 5 級；mods 是「每一級」給的加成，疊加規則見 stats.js） ----
export const PASSIVES = {
  lens:  { name: '聚光鏡', color: '#fff0a0', desc: '所有傷害 +10%',          mods: [{ stat: 'dmg', pct: 0.10 }] },
  wick:  { name: '快燃芯', color: '#ff8a5c', desc: '攻擊冷卻 -8%',            mods: [{ stat: 'cdr', pct: 0.08 }] },
  stone: { name: '引光石', color: '#7fd6ff', desc: '拾取範圍 +30%、移速 +4%', mods: [{ stat: 'magnet', pct: 0.30 }, { stat: 'speed', pct: 0.04 }] },
  ember: { name: '暖芯',   color: '#ff9fb4', desc: '最大生命 +20、每秒回復 +0.4', mods: [{ stat: 'maxHp', flat: 20 }, { stat: 'regen', flat: 0.4 }] },
};

// ---- 共鳴：武器滿級＋持有指定被動，開燈核時進化 ----
export const RESONANCES = {
  bolt:  { needs: 'wick', name: '流星弩', desc: '巨大的流星光矢貫穿一切，擊殺時迸出碎光',
           stats: { dmg: 24, cd: 0.32, shots: 5, pierce: 99, speed: 520, shard: 3 } },
  orbit: { needs: 'lens', name: '星環',   desc: '光環擴張，並不斷向外拋射星光',
           stats: { dmg: 32, count: 6, radius: 68, spin: 4.4, size: 12, flingCd: 0.6 } },
};

// ---- 怪物 ----
// ai：chase 追擊 / weave 蛇行 / spit 保持距離吐孢 / lunge 蓄力撲擊 / bomber 貼近自爆 / turret 定點三連射 / blink 預警後瞬移
// 其他旗標：split 死後分裂、armor 受傷倍率（越小越硬）、oil 擊倒給的燈油
export const ENEMIES = {
  mite:     { name: '菌蟎',   r: 11, hp: 10,  speed: 60,  dmg: 6,  xp: 1, oil: 1, ai: 'chase' },
  moth:     { name: '孢蛾',   r: 9,  hp: 7,   speed: 105, dmg: 5,  xp: 1, oil: 1, ai: 'weave' },
  brute:    { name: '刺囊',   r: 20, hp: 70,  speed: 36,  dmg: 14, xp: 5, oil: 4, ai: 'chase', mass: 4 },
  spitter:  { name: '吐孢菇', r: 13, hp: 24,  speed: 50,  dmg: 6,  xp: 3, oil: 2, ai: 'spit', keep: 150, fireCd: 3.2, shotDmg: 7 },
  splitter: { name: '裂囊',   r: 15, hp: 34,  speed: 48,  dmg: 8,  xp: 3, oil: 2, ai: 'chase', split: { kind: 'mite', n: 3 } },
  // 第二章：霧沼
  leech:    { name: '沼蛭',   r: 12, hp: 26,  speed: 55,  dmg: 9,  xp: 2, oil: 2, ai: 'lunge', lungeSpeed: 360, windup: 0.6, lungeT: 0.35, lungeCd: 2.6, range: 150 },
  bloater:  { name: '脹孢囊', r: 16, hp: 45,  speed: 50,  dmg: 6,  xp: 3, oil: 2, ai: 'bomber', fuse: 1.0, blastR: 72, blastDmg: 22, blastHurtsEnemies: 60 },
  // 第三章：晶窟
  turret:   { name: '晶刺',   r: 14, hp: 60,  speed: 0,   dmg: 8,  xp: 4, oil: 3, ai: 'turret', fireCd: 2.8, shotDmg: 8, mass: 99 },
  blinker:  { name: '閃晶蛾', r: 10, hp: 16,  speed: 80,  dmg: 7,  xp: 2, oil: 2, ai: 'blink', blinkCd: 3.6, blinkWarn: 0.8 },
  shell:    { name: '晶甲蟲', r: 17, hp: 42,  speed: 38,  dmg: 11, xp: 4, oil: 3, ai: 'chase', armor: 0.6, mass: 3 },
  // 燈塔守衛
  boss1:    { name: '噬燈菌母', r: 42, hp: 40000, speed: 44, dmg: 14, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss2:    { name: '沼母巨蛭', r: 40, hp: 52000, speed: 50, dmg: 13, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss3:    { name: '晶心守衛', r: 44, hp: 70000, speed: 30, dmg: 18, xp: 0, oil: 0, ai: 'boss', mass: 50 },
};

// 精英：放大、加血、帶一個詞綴；死亡必掉燈核
export const ELITE = { rMul: 1.6, hpMul: 8, xpMul: 8, dmgMul: 1.2 };
export const ELITE_AFFIXES = {
  swift:  { name: '疾速', speedMul: 1.5 },
  regen:  { name: '再生', regen: 0.03 },   // 每秒回復最大生命 3%
  armor:  { name: '硬殼', dmgTaken: 0.6 },
};

// ---- 章節 ----
// roster：[起始秒, 種類, 權重]；spawnRate(t)：每秒生幾隻；events：固定時間事件
// terrain：pools 泥沼（玩家踩到減速）/ pillars 晶柱（擋路、擋子彈）；fog：霧中自動瞄準距離（null＝無霧）
// palette：地面與色調（render 用）；hue：共用怪物的色相偏移
export const CHAPTERS = [
  {
    id: 1, name: '螢苔原', tagline: '開闊的苔原，菌潮從四面八方湧來', palette: 'moss', hue: 0,
    length: 480, bossAt: 420, arenaR: 250, boss: 'boss1', terrain: null, fog: null,
    hpScale: (t) => 1 + Math.max(0, t - 60) / 135,  // 怪物血量：第 1 分鐘不成長，之後線性成長
    dmgScale: (t) => 1 + t / 360,                    // 怪物接觸傷害成長
    spawnRate: (t) => 1.2 + t * 0.018 + (t > 240 ? (t - 240) * 0.015 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 10], [45, 'moth', 5], [150, 'spitter', 2], [210, 'splitter', 3], [270, 'brute', 2], [330, 'moth', 4]],
    events: [
      { at: 90,  type: 'ring',  kind: 'mite', n: 26 },
      { at: 150, type: 'elite', kind: 'brute' },
      { at: 200, type: 'rush',  kind: 'moth', n: 22 },
      { at: 260, type: 'ring',  kind: 'splitter', n: 14 },
      { at: 300, type: 'elite', kind: 'spitter' },
      { at: 345, type: 'rush',  kind: 'moth', n: 30 },
      { at: 370, type: 'elite', kind: 'splitter' },
      { at: 390, type: 'ring',  kind: 'mite', n: 40 },
      { at: 420, type: 'boss',  kind: 'boss1' },
    ],
    reward: { clear: 300, firstClear: 300, gear: [60, 30, 10, 0, 0] },
  },
  {
    id: 2, name: '霧沼', tagline: '濃霧縮短了瞄準距離，泥沼拖慢腳步，沼蛭會蓄力撲來', palette: 'marsh', hue: 60,
    length: 480, bossAt: 420, arenaR: 240, boss: 'boss2', terrain: 'pools', fog: 210,
    hpScale: (t) => 1.15 + Math.max(0, t - 45) / 105,
    dmgScale: (t) => 1.05 + t / 330,
    spawnRate: (t) => 1.5 + t * 0.02 + (t > 240 ? (t - 240) * 0.016 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 8], [20, 'leech', 4], [90, 'moth', 4], [140, 'bloater', 3], [220, 'spitter', 2], [300, 'leech', 3]],
    events: [
      { at: 75,  type: 'rush',  kind: 'leech', n: 12 },
      { at: 130, type: 'elite', kind: 'leech' },
      { at: 180, type: 'ring',  kind: 'bloater', n: 12 },
      { at: 240, type: 'rush',  kind: 'moth', n: 30 },
      { at: 280, type: 'elite', kind: 'bloater' },
      { at: 330, type: 'ring',  kind: 'leech', n: 24 },
      { at: 365, type: 'elite', kind: 'spitter' },
      { at: 395, type: 'ring',  kind: 'mite', n: 44 },
      { at: 420, type: 'boss',  kind: 'boss2' },
    ],
    reward: { clear: 500, firstClear: 500, gear: [35, 40, 20, 5, 0] },
  },
  {
    id: 3, name: '晶窟', tagline: '晶柱擋路也擋子彈，晶刺在遠處架起火線，閃晶蛾會突然出現在身邊', palette: 'crystal', hue: 170,
    length: 480, bossAt: 420, arenaR: 260, boss: 'boss3', terrain: 'pillars', fog: null,
    hpScale: (t) => 1.3 + Math.max(0, t - 30) / 90,
    dmgScale: (t) => 1.15 + t / 300,
    spawnRate: (t) => 1.6 + t * 0.021 + (t > 240 ? (t - 240) * 0.017 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 7], [45, 'blinker', 4], [110, 'shell', 2], [120, 'turret', 1], [200, 'splitter', 3], [280, 'blinker', 3]],
    events: [
      { at: 70,  type: 'ring',  kind: 'mite', n: 30 },
      { at: 120, type: 'elite', kind: 'shell' },
      { at: 170, type: 'rush',  kind: 'blinker', n: 18 },
      { at: 230, type: 'elite', kind: 'turret' },
      { at: 270, type: 'ring',  kind: 'shell', n: 10 },
      { at: 320, type: 'elite', kind: 'blinker' },
      { at: 360, type: 'rush',  kind: 'splitter', n: 18 },
      { at: 395, type: 'ring',  kind: 'blinker', n: 30 },
      { at: 420, type: 'boss',  kind: 'boss3' },
    ],
    reward: { clear: 800, firstClear: 800, gear: [15, 35, 35, 13, 2] },
  },
];
export const CHAPTER1 = CHAPTERS[0];

// ---- 燈油（局外貨幣）結算 ----
// 一局的燈油 ＝ floor( (floor(Σ擊倒×該怪 oil × perKill) ＋ 精英數×elite ＋ 擊敗守衛×boss ＋ 通關獎勵 ＋ 首通獎勵) × (1 + 燈油加成) )
// 陣亡或放棄：只有擊倒與精英兩項。由 tools/meta-test.mjs 用「從事件逐筆重算」的母體檢查釘住。
export const OIL = { perKill: 0.15, elite: 40, boss: 250 };

// ---- 天賦（永久加成，用燈油升級） ----
// mods：每一級給的加成（疊加規則見 stats.js）；cost[i]：從 i 級升到 i+1 級的價格
export const TALENTS = {
  might:  { name: '燈焰', desc: '所有傷害 +5%',     mods: [{ stat: 'dmg', pct: 0.05 }],    cost: [90, 180, 300, 480, 720, 1020, 1380, 1800, 2280, 2820] },
  vigor:  { name: '燈身', desc: '最大生命 +12',     mods: [{ stat: 'maxHp', flat: 12 }],   cost: [70, 150, 250, 390, 570, 780, 1050, 1350, 1710, 2100] },
  swift:  { name: '輕步', desc: '移動速度 +3%',     mods: [{ stat: 'speed', pct: 0.03 }],  cost: [120, 270, 480, 750, 1080] },
  reach:  { name: '引光', desc: '拾取範圍 +10%',    mods: [{ stat: 'magnet', pct: 0.10 }], cost: [60, 130, 230, 360, 540] },
  haste:  { name: '燃速', desc: '攻擊冷卻 -3%',     mods: [{ stat: 'cdr', pct: 0.03 }],    cost: [150, 330, 570, 870, 1260] },
  greed:  { name: '聚油', desc: '燈油獲得 +8%',     mods: [{ stat: 'oil', pct: 0.08 }],    cost: [110, 240, 420, 660, 960] },
  ward:   { name: '燈罩', desc: '受到傷害 -3%',     mods: [{ stat: 'armor', pct: 0.03 }],  cost: [130, 290, 490, 750, 1080] },
  rekindle: { name: '復燃', desc: '倒下時以一半生命復活一次', mods: [{ stat: 'revive', flat: 1 }], cost: [1500] },
};

// ---- 裝備 ----
// 4 個部位各有固定主屬性；稀有度決定主屬性數值與副詞條數量；強化每級主屬性 +10%（相加，見 gearMods）
export const RARITIES = [
  { name: '常見', color: '#c9cfe6', affixes: 0, salvage: 30 },
  { name: '精良', color: '#7fe08a', affixes: 1, salvage: 80 },
  { name: '稀有', color: '#6fb6ff', affixes: 2, salvage: 200 },
  { name: '史詩', color: '#c68cff', affixes: 3, salvage: 500 },
  { name: '傳說', color: '#ffc85a', affixes: 4, salvage: 1200 },
];
export const GEAR_SLOTS = {
  lamp:  { name: '提燈', main: { stat: 'dmg',   pct:  [0.05, 0.08, 0.12, 0.17, 0.24] } },
  cloak: { name: '披風', main: { stat: 'maxHp', flat: [10, 18, 28, 42, 60] } },
  charm: { name: '護符', main: { stat: 'cdr',   pct:  [0.02, 0.035, 0.05, 0.07, 0.09] } },
  boots: { name: '靴子', main: { stat: 'speed', pct:  [0.03, 0.05, 0.07, 0.09, 0.12] } },
};
// 副詞條：[stat, 類型, 每個稀有度的數值]
export const GEAR_AFFIXES = [
  ['dmg', 'pct', [0.02, 0.03, 0.04, 0.05, 0.07]],
  ['maxHp', 'flat', [5, 8, 12, 16, 22]],
  ['speed', 'pct', [0.01, 0.02, 0.03, 0.04, 0.05]],
  ['magnet', 'pct', [0.05, 0.08, 0.12, 0.16, 0.2]],
  ['regen', 'flat', [0.1, 0.15, 0.2, 0.3, 0.4]],
  ['oil', 'pct', [0.02, 0.03, 0.05, 0.07, 0.1]],
  ['armor', 'pct', [0.01, 0.015, 0.02, 0.03, 0.04]],
];
export const GEAR_MAX_LV = 10;
export const gearUpgradeCost = (rarity, lv) => Math.round((36 + rarity * 36) * lv * (1 + lv * 0.15));
export const STAT_NAMES = { dmg: '傷害', maxHp: '最大生命', speed: '移速', magnet: '拾取範圍', cdr: '冷卻', regen: '每秒回復', oil: '燈油獲得', armor: '受到傷害', revive: '復活' };

export const XP_CURVE = (lv) => Math.round(5 + lv * 4 + lv * lv * 0.3);
export const SLOTS = { weapon: 4, passive: 4 };
export const MAX_LV = 5;
