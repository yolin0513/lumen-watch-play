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

// ---- 被動（每項 5 級，效果按等級線性疊加） ----
export const PASSIVES = {
  lens:  { name: '聚光鏡', color: '#fff0a0', desc: '所有傷害 +10%',       per: { dmgMul: 0.10 } },
  wick:  { name: '快燃芯', color: '#ff8a5c', desc: '攻擊冷卻 -8%',         per: { cdMul: 0.08 } },
  stone: { name: '引光石', color: '#7fd6ff', desc: '拾取範圍 +30%、移速 +4%', per: { magnetMul: 0.30, speedMul: 0.04 } },
  ember: { name: '暖芯',   color: '#ff9fb4', desc: '最大生命 +20、每秒回復 +0.4', per: { maxHp: 20, regen: 0.4 } },
};

// ---- 共鳴：武器滿級＋持有指定被動，開燈核時進化 ----
export const RESONANCES = {
  bolt:  { needs: 'wick', name: '流星弩', desc: '巨大的流星光矢貫穿一切，擊殺時迸出碎光',
           stats: { dmg: 24, cd: 0.32, shots: 5, pierce: 99, speed: 520, shard: 3 } },
  orbit: { needs: 'lens', name: '星環',   desc: '光環擴張，並不斷向外拋射星光',
           stats: { dmg: 32, count: 6, radius: 68, spin: 4.4, size: 12, flingCd: 0.6 } },
};

// ---- 怪物 ----
// ai: chase 追擊 / weave 蛇行追擊 / spit 保持距離吐孢 / 其他行為旗標：split 死後分裂
export const ENEMIES = {
  mite:     { name: '菌蟎', r: 11, hp: 10, speed: 60,  dmg: 6,  xp: 1, ai: 'chase' },
  moth:     { name: '孢蛾', r: 9,  hp: 7,  speed: 105, dmg: 5,  xp: 1, ai: 'weave' },
  brute:    { name: '刺囊', r: 20, hp: 70, speed: 36,  dmg: 14, xp: 5, ai: 'chase', mass: 4 },
  spitter:  { name: '吐孢菇', r: 13, hp: 24, speed: 50, dmg: 6, xp: 3, ai: 'spit', keep: 150, fireCd: 3.2, shotDmg: 7 },
  splitter: { name: '裂囊', r: 15, hp: 34, speed: 48,  dmg: 8,  xp: 3, ai: 'chase', split: { kind: 'mite', n: 3 } },
  boss1:    { name: '噬燈菌母', r: 42, hp: 40000, speed: 44, dmg: 14, xp: 0, ai: 'boss', mass: 50 },
};

// 精英：放大、加血、帶一個詞綴；死亡必掉燈核
export const ELITE = { rMul: 1.6, hpMul: 8, xpMul: 8, dmgMul: 1.2 };
export const ELITE_AFFIXES = {
  swift:  { name: '疾速', speedMul: 1.5 },
  regen:  { name: '再生', regen: 0.03 },   // 每秒回復最大生命 3%
  armor:  { name: '硬殼', dmgTaken: 0.6 },
};

// ---- 第一章：螢苔原 ----
// roster：[起始秒, 種類, 權重]；spawnRate(t)：每秒生幾隻；events：固定時間事件
export const CHAPTER1 = {
  name: '螢苔原', length: 480, bossAt: 420, arenaR: 250,
  hpScale: (t) => 1 + Math.max(0, t - 60) / 135,  // 怪物血量：第 1 分鐘不成長，之後線性成長
  dmgScale: (t) => 1 + t / 360,                    // 怪物接觸傷害成長
  spawnRate: (t) => 1.2 + t * 0.018 + (t > 240 ? (t - 240) * 0.015 : 0),
  maxEnemies: 300,
  roster: [
    [0, 'mite', 10], [45, 'moth', 5], [150, 'spitter', 2], [210, 'splitter', 3], [270, 'brute', 2], [330, 'moth', 4],
  ],
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
};

export const XP_CURVE = (lv) => Math.round(5 + lv * 4 + lv * lv * 0.3);
export const SLOTS = { weapon: 4, passive: 4 };
export const MAX_LV = 5;
