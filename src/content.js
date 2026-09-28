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
      { dmg: 17, count: 2, radius: 46, spin: 3.2, size: 8 },
      { dmg: 17, count: 3, radius: 48, spin: 3.2, size: 8 },
      { dmg: 25, count: 3, radius: 58, spin: 3.2, size: 9 },
      { dmg: 25, count: 4, radius: 58, spin: 4.0, size: 9 },
      { dmg: 34, count: 5, radius: 62, spin: 4.0, size: 10 },
    ],
  },
  aura: {
    name: '燈暈', color: '#ffb35a',
    desc: ['身邊的暖光持續灼燒敵人', '範圍變大', '傷害 +50%', '範圍變大、灼燒更頻繁', '傷害 +50%、敵人減速'],
    lv: [
      { dmg: 8, radius: 58, tick: 0.5, slow: 0 },
      { dmg: 8, radius: 70, tick: 0.5, slow: 0 },
      { dmg: 12, radius: 70, tick: 0.5, slow: 0 },
      { dmg: 12, radius: 82, tick: 0.4, slow: 0 },
      { dmg: 18, radius: 86, tick: 0.4, slow: 0.35 },
    ],
  },
  chain: {
    name: '雷蕊', color: '#c6a8ff',
    desc: ['電弧擊中敵人後跳向附近目標', '跳躍 +2', '傷害 +50%', '跳躍 +2、充能加快', '同時放出兩道電弧'],
    lv: [
      { dmg: 19, cd: 1.4, jumps: 2, range: 110, arcs: 1 },
      { dmg: 19, cd: 1.4, jumps: 4, range: 110, arcs: 1 },
      { dmg: 29, cd: 1.4, jumps: 4, range: 120, arcs: 1 },
      { dmg: 29, cd: 1.1, jumps: 6, range: 130, arcs: 1 },
      { dmg: 34, cd: 1.1, jumps: 6, range: 130, arcs: 2 },
    ],
  },
  // ---- M4 新增：每把的打法不同（彈道、節奏、範圍、觸發條件） ----
  boomerang: { // 飛出去再折返；去程、回程各能打同一隻一次
    name: '迴光刃', color: '#9ff0d0', kind: 'boomerang',
    desc: ['擲出光刃，飛到盡頭後折返，來回都能命中', '光刃 +1', '傷害 +40%、飛得更遠', '光刃 +1、擲得更快', '光刃 +1、傷害 +30%'],
    lv: [
      { dmg: 16, cd: 1.5, count: 1, range: 170, speed: 340, size: 11 },
      { dmg: 16, cd: 1.5, count: 2, range: 170, speed: 340, size: 11 },
      { dmg: 22, cd: 1.5, count: 2, range: 210, speed: 360, size: 12 },
      { dmg: 22, cd: 1.2, count: 3, range: 210, speed: 380, size: 12 },
      { dmg: 29, cd: 1.2, count: 4, range: 230, speed: 400, size: 14 },
    ],
  },
  mortar: { // 延遲落下的範圍轟炸，自動挑怪多的地方
    name: '落星', color: '#ffb0f0', kind: 'mortar',
    desc: ['0.6 秒後在怪群中央落下一顆星，範圍傷害', '一次落兩顆', '範圍變大、傷害 +40%', '一次落三顆、間隔縮短', '一次落四顆、傷害 +30%'],
    lv: [
      { dmg: 38, cd: 1.9, count: 1, radius: 52, delay: 0.6 },
      { dmg: 38, cd: 1.9, count: 2, radius: 52, delay: 0.6 },
      { dmg: 53, cd: 1.9, count: 2, radius: 62, delay: 0.55 },
      { dmg: 53, cd: 1.5, count: 3, radius: 62, delay: 0.5 },
      { dmg: 68, cd: 1.5, count: 4, radius: 68, delay: 0.5 },
    ],
  },
  flame: { // 朝移動方向噴出的錐形持續傷害：要面對怪才有用
    name: '燈焰吐息', color: '#ff9a4a', kind: 'flame',
    desc: ['火口會轉向最近的敵人，噴出短程火焰持續灼燒', '射程變長', '傷害 +50%', '噴口變寬、轉得更快', '射程與傷害大幅提升'],
    lv: [
      { dmg: 6, tick: 0.15, range: 80, half: 0.5, turn: 4 },
      { dmg: 6, tick: 0.15, range: 100, half: 0.5, turn: 4 },
      { dmg: 9, tick: 0.15, range: 100, half: 0.55, turn: 4 },
      { dmg: 9, tick: 0.12, range: 110, half: 0.7, turn: 6 },
      { dmg: 14, tick: 0.12, range: 130, half: 0.75, turn: 6 },
    ],
  },
  wisps: { // 自己追怪的召喚物
    name: '螢蜂', color: '#e6ff7a', kind: 'wisps',
    desc: ['放出會自己追擊敵人的螢蜂', '螢蜂 +1', '傷害 +50%、飛得更快', '螢蜂 +1', '螢蜂 +1、傷害 +30%'],
    lv: [
      { dmg: 13, count: 2, speed: 260, hitCd: 0.35, seek: 280 },
      { dmg: 13, count: 3, speed: 260, hitCd: 0.35, seek: 280 },
      { dmg: 19, count: 3, speed: 300, hitCd: 0.3, seek: 300 },
      { dmg: 19, count: 4, speed: 300, hitCd: 0.3, seek: 320 },
      { dmg: 25, count: 5, speed: 320, hitCd: 0.25, seek: 320 },
    ],
  },
  mines: { // 放在腳下、怪踩到才爆：邊跑邊佈陣
    name: '燈籠雷', color: '#ffd84a', kind: 'mines',
    desc: ['每隔一段時間在腳下放燈籠，敵人踩到就爆炸', '可同時存在的燈籠 +2', '爆炸更大、傷害 +40%', '放得更快', '爆炸大幅強化'],
    lv: [
      { dmg: 38, cd: 1.3, max: 4, trigger: 24, radius: 58, arm: 0.5 },
      { dmg: 38, cd: 1.3, max: 6, trigger: 24, radius: 58, arm: 0.5 },
      { dmg: 53, cd: 1.3, max: 6, trigger: 26, radius: 70, arm: 0.5 },
      { dmg: 53, cd: 0.9, max: 7, trigger: 26, radius: 70, arm: 0.4 },
      { dmg: 75, cd: 0.9, max: 8, trigger: 28, radius: 84, arm: 0.4 },
    ],
  },
  // ---- 專屬起始武器：只能從「武器祈燈」抽到，裝備在起始武器欄才生效；不會出現在局內升級的「新武器」選項 ----
  starfall: {
    name: '星隕杖', color: '#ff7ad8', kind: 'mortar', exclusive: true,
    desc: ['一開始就一次落三顆星的強化落星', '傷害 +35%', '範圍變大、間隔縮短', '一次落四顆', '一次落五顆、傷害 +30%'],
    lv: [
      { dmg: 40, cd: 1.6, count: 3, radius: 58, delay: 0.5 },
      { dmg: 54, cd: 1.6, count: 3, radius: 58, delay: 0.5 },
      { dmg: 54, cd: 1.35, count: 3, radius: 68, delay: 0.45 },
      { dmg: 54, cd: 1.35, count: 4, radius: 68, delay: 0.45 },
      { dmg: 70, cd: 1.25, count: 5, radius: 74, delay: 0.4 },
    ],
  },
  twinblade: {
    name: '曦光雙刃', color: '#7affe0', kind: 'boomerang', exclusive: true,
    desc: ['一開始就同時擲出兩把大光刃', '傷害 +30%', '光刃 +1、飛得更遠', '擲得更快', '光刃 +1、傷害 +30%'],
    lv: [
      { dmg: 15, cd: 1.15, count: 2, range: 200, speed: 380, size: 15 },
      { dmg: 20, cd: 1.15, count: 2, range: 200, speed: 380, size: 15 },
      { dmg: 20, cd: 1.15, count: 3, range: 240, speed: 400, size: 16 },
      { dmg: 20, cd: 0.85, count: 3, range: 240, speed: 420, size: 16 },
      { dmg: 27, cd: 0.85, count: 4, range: 250, speed: 440, size: 18 },
    ],
  },
  emberbow: {
    name: '燼羽弓', color: '#ff6a3a', kind: 'bolt', exclusive: true,
    desc: ['三支穿透火箭，命中會讓敵人持續燃燒', '燃燒更久、傷害 +25%', '箭 +1、穿透 +1', '射速加快', '箭 +1、燃燒大幅強化'],
    lv: [
      { dmg: 11, cd: 0.6, shots: 3, pierce: 2, speed: 460, burn: 4, burnT: 2 },
      { dmg: 14, cd: 0.6, shots: 3, pierce: 2, speed: 460, burn: 6, burnT: 2.5 },
      { dmg: 14, cd: 0.6, shots: 4, pierce: 3, speed: 480, burn: 6, burnT: 2.5 },
      { dmg: 14, cd: 0.48, shots: 4, pierce: 3, speed: 500, burn: 6, burnT: 2.5 },
      { dmg: 17, cd: 0.48, shots: 5, pierce: 3, speed: 520, burn: 11, burnT: 3 },
    ],
  },
};
export const START_WEAPON = 'bolt'; // 沒有裝備專屬武器時的起始武器

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
  // M6：每一把武器（含專屬起始武器）都要有對應的增幅（被動）可以共鳴。
  // 曦光雙刃原本配引光石，但引光石（拾取／移速）不加戰力，照共鳴提示先升它反而變弱（第三章 0/6），改配聚光鏡。
  // tools/resonance-check.mjs 檢查「武器總數 ＝ 有共鳴的武器數」、需要的被動存在、共鳴數值涵蓋那把武器用到的每個欄位（部署門檻）。
  aura:      { needs: 'ember', name: '暖陽',     desc: '燈暈擴大成一輪暖陽，灼燒更快、敵人大幅減速',
               stats: { dmg: 26, radius: 104, tick: 0.35, slow: 0.45 } },
  chain:     { needs: 'stone', name: '雷網',     desc: '三道電弧同時竄出，在怪群之間跳得更遠更多次',
               stats: { dmg: 44, cd: 0.9, jumps: 9, range: 150, arcs: 3 } },
  boomerang: { needs: 'stone', name: '月輪',     desc: '五把大光刃同時擲出，飛得更遠更快',
               stats: { dmg: 38, cd: 1.0, count: 5, range: 250, speed: 440, size: 16 } },
  mortar:    { needs: 'lens',  name: '流星雨',   desc: '一次落下六顆星，間隔更短、範圍更大',
               stats: { dmg: 84, cd: 1.2, count: 6, radius: 76, delay: 0.45 } },
  flame:     { needs: 'wick',  name: '龍焰',     desc: '火舌變長變寬，轉向極快，幾乎沒有死角',
               stats: { dmg: 20, tick: 0.1, range: 160, half: 0.9, turn: 8 } },
  wisps:     { needs: 'ember', name: '螢群',     desc: '七隻螢蜂成群追擊，飛得更快、咬得更頻繁',
               stats: { dmg: 32, count: 7, speed: 360, hitCd: 0.2, seek: 360 } },
  mines:     { needs: 'ember', name: '燈籠陣',   desc: '燈籠放得更快、數量更多，爆炸範圍大幅擴張',
               stats: { dmg: 100, cd: 0.7, max: 10, trigger: 30, radius: 100, arm: 0.3 } },
  starfall:  { needs: 'lens',  name: '星墜',     desc: '一次落下七顆星，幾乎不停歇',
               stats: { dmg: 90, cd: 1.1, count: 7, radius: 82, delay: 0.35 } },
  twinblade: { needs: 'lens',  name: '曦日雙輪', desc: '五把巨大光刃高速來回，範圍與速度都再提升',
               stats: { dmg: 32, cd: 0.75, count: 5, range: 270, speed: 480, size: 20 } },
  emberbow:  { needs: 'wick',  name: '焚天羽',   desc: '六支火箭貫穿怪群，燃燒大幅增強',
               stats: { dmg: 22, cd: 0.4, shots: 6, pierce: 5, speed: 560, burn: 16, burnT: 3.5 } },
};

// ---- 怪物 ----
// ai：chase 追擊 / weave 蛇行 / spit 保持距離吐孢 / lunge 蓄力撲擊 / bomber 貼近自爆 / turret 定點三連射 / blink 預警後瞬移
// 其他旗標：split 死後分裂、armor 受傷倍率（越小越硬）、oil 擊倒給的燈油
export const ENEMIES = {
  mite:     { name: '菌蟎',   r: 11, hp: 10,  speed: 60,  dmg: 6,  xp: 1, oil: 1, ai: 'chase' },
  swarm:    { name: '潮孢',   r: 9,  hp: 6,   speed: 78,  dmg: 4,  xp: 6, oil: 1, ai: 'chase' }, // 菌潮專用：很脆、經驗多
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
    reward: { clear: 300, firstClear: 300, gear: [60, 30, 10, 0, 0], stardust: 10, firstStardust: 60 },
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
    reward: { clear: 500, firstClear: 500, gear: [35, 40, 20, 5, 0], stardust: 15, firstStardust: 90 },
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
    reward: { clear: 800, firstClear: 800, gear: [15, 35, 35, 13, 2], stardust: 20, firstStardust: 120 },
  },
];
export const CHAPTER1 = CHAPTERS[0];

// ---- 菌潮（週期性的怪物海）----
// 從 first 秒開始每 every 秒一波，到守衛出現前 beforeBoss 秒為止；第 k 波（0 起算）共 base＋grow×k 隻潮孢，分 bursts 批從四周湧入。
// 目的（擁有者回饋）：一局之內升不滿。量測（tools/level-report.mjs）：M7 前過關局結束時組建完成度 81～90%、全滿 0 局。
// cap：場上「菌潮怪」的上限，和一般怪的上限（章節的 maxEnemies）分開算——若共用同一個上限，菌潮滿場會擠掉本章的招牌怪
//      （量過：第二章脹孢囊的引信從 136 次掉到 1 次）。實際同屏總數見 tools/level-report 旁的量測與回報。
//      依據：擁有者手機（第 2 章、DPR 3）重場面 89 隻怪時繪製 p95 2ms、平均 59.5fps；怪物繪製大致隨數量線性增加（推論，要請擁有者重量）。
export const SURGE = { first: 60, every: 60, beforeBoss: 15, base: 20, grow: 60, bursts: 3, burstGap: 1.2, cap: 220, kind: 'swarm', hpPerWave: 0.3 };

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
// 自動分解門檻最高只能設到「稀有」（索引 2）：史詩、傳說永遠不會被自動分解，一定要玩家親手處理
export const AUTO_SALVAGE_MAX = 2;
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

// ---- 進階（M7 第二批）----
// 燈芯結晶：進階材料。任何一件裝備被分解（手動、批量、自動分解、背包與暫存區都滿）都會給「燈油＋結晶」，
// 所以自動分解不會吃掉材料，而是把裝備換成材料。每個稀有度給的結晶數：
export const CRYSTALS = [1, 2, 3, 5, 8];
// 裝備突破：強化到 GEAR_MAX_LV 之後，用結晶＋燈油突破 ★1～★5，每一星解鎖一項能力（能力數值依稀有度乘上 scale）。
// 第 s 星（1 起算）要 crystal[稀有度] × s 個結晶、oil(稀有度, s) 燈油。
export const GEAR_ASCEND = {
  max: 5,
  crystal: [1, 2, 3, 5, 8],
  oil: (rarity, star) => 300 * star * (rarity + 1),
  scale: [0.5, 0.6, 0.75, 0.9, 1],
  perks: {
    lamp:  [{ stat: 'dmg', pct: 0.04 }, { stat: 'cdr', pct: 0.02 }, { stat: 'dmg', pct: 0.05 }, { stat: 'armor', pct: 0.03 }, { stat: 'dmg', pct: 0.07 }],
    cloak: [{ stat: 'maxHp', flat: 15 }, { stat: 'regen', flat: 0.3 }, { stat: 'armor', pct: 0.03 }, { stat: 'maxHp', flat: 25 }, { stat: 'armor', pct: 0.05 }],
    charm: [{ stat: 'cdr', pct: 0.02 }, { stat: 'dmg', pct: 0.03 }, { stat: 'cdr', pct: 0.03 }, { stat: 'oil', pct: 0.05 }, { stat: 'cdr', pct: 0.04 }],
    boots: [{ stat: 'speed', pct: 0.03 }, { stat: 'magnet', pct: 0.15 }, { stat: 'speed', pct: 0.03 }, { stat: 'regen', flat: 0.3 }, { stat: 'speed', pct: 0.05 }],
  },
};
// 專屬武器進階：武器祈燈抽到已擁有的專屬武器 → 那把的「星核」+1。星核升 ★1～★5，只有「已裝備」的那把生效（擁有≠生效）。
export const WEAPON_ASCEND = {
  max: 5,
  shards: [1, 1, 2, 2, 3], // 第 s 星要幾個星核
  perks: [
    { startLv: 2, text: '開局武器直接 2 級' },
    { mod: { stat: 'dmg', pct: 0.08 }, text: '所有傷害 +8%' },
    { startLv: 3, text: '開局武器直接 3 級' },
    { startPassive: true, text: '開局就帶著它的共鳴增幅（1 級）' },
    { mod: { stat: 'dmg', pct: 0.12 }, text: '所有傷害再 +12%' },
  ],
};
export const STAT_NAMES = { dmg: '傷害', maxHp: '最大生命', speed: '移速', magnet: '拾取範圍', cdr: '冷卻', regen: '每秒回復', oil: '燈油獲得', armor: '受到傷害', revive: '復活' };

export const XP_CURVE = (lv) => Math.round(5 + lv * 4 + lv * lv * 0.3);
export const SLOTS = { weapon: 4, passive: 4 };
export const MAX_LV = 5;

// ---- 商城（不接任何付款；所有價格都是遊戲內貨幣） ----
// 貨幣：燈油（局內賺）、星砂（通關、每日補給、用燈油兌換）、祈燈券（每日補給、禮包）。
// 商城賣的每一樣東西，玩遊戲都拿得到：星砂靠通關＋每日補給，祈燈券靠每日補給，裝備靠通關掉落。
export const DAILY = { oil: 150, stardust: 15, tickets: 1 };
export const SHOP = [
  // 價格一律是遊戲內貨幣（燈油／星砂／祈燈券），全部靠遊玩取得。M5 起拿掉「模擬購買」品項（它的標價不是遊戲內貨幣）。
  // 兌換比例要保證來回換一定虧（燈油→星砂→燈油 < 1），否則會變成無限刷貨幣；shop-test 會檢查。
  // 星砂補給（M6 依擁有者指示放回）：free＝免費領取。沒有任何標價、沒有確認或結帳步驟，按「領取」就入帳——
  // 刻意不做成「一排價位」的樣子（那是儲值商店的長相）。shop-test 檢查：free 的品項不可以有 price，畫面上只寫「免費」。
  { id: 'dust_s', free: true, name: '一小袋星砂', desc: '星砂 ×60', gives: { stardust: 60 } },
  { id: 'dust_m', free: true, name: '一瓶星砂',   desc: '星砂 ×330', gives: { stardust: 330 } },
  { id: 'dust_l', free: true, name: '一箱星砂',   desc: '星砂 ×1400', gives: { stardust: 1400 } },
  { id: 'starter', name: '新手守燈人禮包', desc: '燈油 ×1200、祈燈券 ×3、稀有裝備 ×1（限購一次）', price: { stardust: 60 }, limit: 1, gives: { oil: 1200, tickets: 3, gear: 2 } },
  { id: 'oilbox',  name: '燈油補給箱', desc: '燈油 ×1000', price: { stardust: 50 }, gives: { oil: 1000 } },
  { id: 'dustex',  name: '星砂兌換', desc: '星砂 ×60（用燈油換）', price: { oil: 1500 }, gives: { stardust: 60 } },
];

// ---- 祈燈（抽獎）----
// rates：單抽時各稀有度的機率（百分比，順序同 RARITIES）。這是唯一一份機率表：抽獎邏輯與商城畫面都從這裡算。
// pity：第 pity 抽必得最高稀有度（計數＝距離上次抽到最高稀有度的抽數；抽到就歸零）。
export const GACHA = {
  rates: [45, 33, 16, 5, 1],
  pity: 40,
  cost: { single: { stardust: 30, tickets: 1 }, ten: { stardust: 270, tickets: 10 } },
};

// ---- 武器祈燈（第二個抽獎池）：專屬起始武器只能從這裡抽到 ----
// outcomes 與 rates 一一對應，最後一項（專屬武器）是最高獎項，保底也是它。
// 抽中「專屬武器」時，從尚未擁有的專屬武器中平均抽一把；三把都有了就從三把中平均抽一把，變成那把的「星核」（進階材料）。
// 抽獎用的星砂與祈燈券都能靠遊玩取得（通關、每日補給），不涉及任何真實付款。
export const WEAPON_GACHA = {
  outcomes: [
    { id: 'oil', name: '燈油 ×200', gives: { oil: 200 } },
    { id: 'dust', name: '星砂 ×15', gives: { stardust: 15 } },
    { id: 'ticket', name: '祈燈券 ×1', gives: { tickets: 1 } },
    { id: 'weapon', name: '專屬武器' },
  ],
  rates: [58, 27, 13, 2],
  pity: 50,
  cost: { single: { stardust: 30, tickets: 1 }, ten: { stardust: 270, tickets: 10 } },
};
