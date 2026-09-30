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
  // ---- M7 第三批新增：打一條線、擊退、定點火力 ----
  lance: { // 瞬間光束：整條線上的怪都受傷
    name: '聚光槍', color: '#8fd0ff', kind: 'lance',
    desc: ['朝最近的敵人射出一道光束，一整條線上的怪都會受傷', '傷害 +35%', '光束更長更寬', '同時射出兩道（前後）', '射速加快、傷害 +30%'],
    lv: [
      { dmg: 22, cd: 1.6, len: 300, w: 16, beams: 1 },
      { dmg: 30, cd: 1.6, len: 300, w: 16, beams: 1 },
      { dmg: 30, cd: 1.6, len: 360, w: 22, beams: 1 },
      { dmg: 30, cd: 1.6, len: 360, w: 22, beams: 2 },
      { dmg: 39, cd: 1.25, len: 380, w: 24, beams: 2 },
    ],
  },
  pulse: { // 震波：傷害＋把怪推開
    name: '燈鐘', color: '#ffe08a', kind: 'pulse',
    desc: ['每隔一段時間敲響燈鐘，震波傷害並把周圍的怪推開', '範圍變大', '傷害 +50%、推得更遠', '敲得更快', '範圍與傷害大幅提升'],
    lv: [
      { dmg: 14, cd: 2.4, radius: 80, push: 70 },
      { dmg: 14, cd: 2.4, radius: 96, push: 70 },
      { dmg: 21, cd: 2.4, radius: 96, push: 95 },
      { dmg: 21, cd: 1.8, radius: 104, push: 95 },
      { dmg: 30, cd: 1.8, radius: 124, push: 110 },
    ],
  },
  sentry: { // 定點火力：放下的小燈塔自己射擊
    name: '燈塔哨', color: '#9fffb8', kind: 'sentry',
    desc: ['在腳下立起小燈塔，會自己朝附近的怪射擊，一段時間後熄滅', '可同時存在 +1', '射得更快', '每次射兩發、射程更遠', '可同時存在 +1、傷害 +40%'],
    lv: [
      { dmg: 9,  cd: 3.2, max: 1, life: 10, fireCd: 0.55, range: 240, shots: 1 },
      { dmg: 9,  cd: 3.2, max: 2, life: 10, fireCd: 0.55, range: 240, shots: 1 },
      { dmg: 9,  cd: 3.2, max: 2, life: 10, fireCd: 0.42, range: 240, shots: 1 },
      { dmg: 9,  cd: 3.0, max: 2, life: 11, fireCd: 0.42, range: 280, shots: 2 },
      { dmg: 13, cd: 3.0, max: 3, life: 11, fireCd: 0.42, range: 280, shots: 2 },
    ],
  },
  // ---- M8 第四輪新武器：每一把的「形態」（從哪裡出手、打到的形狀、怎麼動、瞄誰、對怪做什麼）都和既有的不同，
  //      tools/weapon-form.mjs 用實際模擬逐項驗證（不是看形容詞）。 ----
  slash: { // 劍氣：一道橫向的光弧往前飛，越飛越寬——打「一片往外擴的帶狀」，不是一條線、也不是一個點
    name: '裂光斬', color: '#c9f6ff', kind: 'slash',
    desc: ['朝最近的敵人揮出劍氣，往前飛並越飛越寬，沿路的怪都會被斬中', '一次揮出兩道', '傷害 +40%', '揮得更快、劍氣更寬', '一次揮出三道、傷害 +15%'],
    // M8 第四輪：第一版傷害 24／34／40，單武器測試在均勻抽的對照組是中位數 1.59 倍（加權後的正式設定被 600 分的滿分蓋住、看不出來），調低約 17%
    lv: [
      { dmg: 20, cd: 1.3,  count: 1, speed: 330, range: 260, w0: 14, w1: 46 },
      { dmg: 20, cd: 1.3,  count: 2, speed: 330, range: 260, w0: 14, w1: 46 },
      { dmg: 28, cd: 1.3,  count: 2, speed: 330, range: 260, w0: 14, w1: 46 },
      { dmg: 28, cd: 1.1,  count: 2, speed: 340, range: 270, w0: 16, w1: 58 },
      { dmg: 32, cd: 1.1,  count: 3, speed: 340, range: 270, w0: 16, w1: 58 },
    ],
  },
  vortex: { // 黑洞：丟到怪群裡張開，把周圍的怪往中心吸、持續傷害，最後炸開——唯一會把怪「拉近」的武器
    name: '蝕光井', color: '#b48cff', kind: 'vortex',
    desc: ['朝敵人丟出一口光井，把周圍的怪吸往中心並持續傷害，最後炸開', '吸力與範圍變大', '傷害 +50%', '一次丟兩口', '持續更久、炸開傷害大增'],
    lv: [
      { dmg: 5, tick: 0.3, cd: 4.2, r: 70, pull: 70,  dur: 1.8, burst: 26, count: 1 },
      { dmg: 5, tick: 0.3, cd: 4.2, r: 84, pull: 90,  dur: 1.8, burst: 26, count: 1 },
      { dmg: 8, tick: 0.3, cd: 4.2, r: 84, pull: 90,  dur: 1.8, burst: 38, count: 1 },
      { dmg: 8, tick: 0.3, cd: 4.0, r: 84, pull: 90,  dur: 1.8, burst: 38, count: 2 },
      { dmg: 9, tick: 0.3, cd: 4.0, r: 88, pull: 100, dur: 2.3, burst: 60, count: 2 },
    ],
  },
  wall: { // 推進光牆：一面光牆從身邊往前推，把碰到的怪一路推著走——不是往外震開（燈鐘），是整排「帶著走」
    name: '推光壁', color: '#ffe6b0', kind: 'wall',
    desc: ['朝敵人推出一面光牆，碰到的怪會被一路推著走', '傷害 +40%', '光牆更寬', '推得更快、前後各推一面', '推得更遠、傷害 +30%'],
    lv: [
      { dmg: 20, cd: 2.4, len: 44, speed: 210, range: 230, walls: 1 },
      { dmg: 28, cd: 2.4, len: 44, speed: 210, range: 230, walls: 1 },
      { dmg: 28, cd: 2.4, len: 60, speed: 210, range: 230, walls: 1 },
      { dmg: 28, cd: 2.0, len: 60, speed: 240, range: 230, walls: 2 },
      { dmg: 36, cd: 2.0, len: 64, speed: 240, range: 290, walls: 2 },
    ],
  },
  sniper: { // 遠星：專挑射程內「最遠」的怪——其他武器都先打近的，這把先清遠處的射手與精英
    name: '遠星銃', color: '#9fb8ff', kind: 'sniper',
    desc: ['瞄準射程內最遠的敵人，一槍命中並在落點小範圍炸開', '傷害 +35%', '一次打兩個目標', '射得更快', '一次打三個目標、傷害 +30%'],
    lv: [
      { dmg: 52, cd: 1.4, range: 420, shots: 1, splash: 26 },
      { dmg: 70, cd: 1.4, range: 420, shots: 1, splash: 26 },
      { dmg: 70, cd: 1.4, range: 420, shots: 2, splash: 26 },
      { dmg: 70, cd: 1.1, range: 420, shots: 2, splash: 30 },
      { dmg: 92, cd: 1.1, range: 420, shots: 3, splash: 32 },
    ],
  },
  trail: { // 燼痕：走過的地方留下燃燒的痕跡，一段時間內持續燒——出手的位置是「你剛走過的路」，不是你現在站的地方
    name: '燼痕', color: '#ff7a3c', kind: 'trail',
    desc: ['走過的地方留下燃燒的燼痕，踩進去的怪持續受傷', '燼痕留得更久', '傷害 +50%', '燼痕更寬', '留得更久、傷害 +30%'],
    lv: [
      { dmg: 7,  tick: 0.4, r: 22, life: 2.0, step: 26 },
      { dmg: 7,  tick: 0.4, r: 22, life: 2.6, step: 26 },
      { dmg: 11, tick: 0.4, r: 22, life: 2.6, step: 26 },
      { dmg: 11, tick: 0.4, r: 28, life: 2.6, step: 28 },
      { dmg: 14, tick: 0.4, r: 28, life: 3.2, step: 28 },
    ],
  },
  ricochet: { // 折光彈：碰到畫面邊緣會反彈——子彈在畫面裡來回穿梭，打的是「整個畫面」
    name: '折光彈', color: '#9ffff0', kind: 'ricochet',
    desc: ['射出光彈，碰到畫面邊緣會反彈，在畫面裡來回穿梭', '一次射兩發', '傷害 +40%、多反彈一次', '射得更快、多穿透一隻', '一次射三發、傷害 +20%'],
    lv: [
      { dmg: 15, cd: 1.3, shots: 1, speed: 360, bounces: 3, pierce: 2 },
      { dmg: 15, cd: 1.3, shots: 2, speed: 360, bounces: 3, pierce: 2 },
      { dmg: 21, cd: 1.3, shots: 2, speed: 360, bounces: 4, pierce: 2 },
      { dmg: 21, cd: 1.0, shots: 2, speed: 380, bounces: 4, pierce: 3 },
      { dmg: 25, cd: 1.0, shots: 3, speed: 380, bounces: 4, pierce: 3 },
    ],
  },
  // ---- 專屬起始武器：只能從「武器祈燈」抽到，裝備在起始武器欄才生效；不會出現在局內升級的「新武器」選項 ----
  starfall: {
    name: '星隕杖', color: '#ff7ad8', kind: 'mortar', exclusive: true,
    // guard（M8 第五輪）：燈術師改用燈暈起始後，星隕杖（落星類）在前期一樣擋不住身邊的小怪（晶窟 fresh 1/12 對燈暈 7/12），所以第一顆星會先砸身邊最近的怪
    desc: ['一開始就一次落三顆星的強化落星，第一顆會先砸身邊最近的怪', '傷害 +35%', '範圍變大、間隔縮短', '一次落四顆', '一次落五顆、傷害 +30%'],
    lv: [
      { dmg: 37, cd: 1.4, count: 3, radius: 58, delay: 0.35, guard: 130 },
      { dmg: 49, cd: 1.4, count: 3, radius: 58, delay: 0.35, guard: 130 },
      { dmg: 49, cd: 1.3, count: 3, radius: 66, delay: 0.35, guard: 130 },
      { dmg: 49, cd: 1.3, count: 4, radius: 66, delay: 0.35, guard: 130 },
      { dmg: 62, cd: 1.3, count: 5, radius: 72, delay: 0.4, guard: 130 },
    ],
  },
  twinblade: {
    name: '曦光雙刃', color: '#7affe0', kind: 'boomerang', exclusive: true,
    // M8 第四輪：升級選項加權（CHOICE）讓每把武器都更快升滿，其他武器單武器分數平均 +54%，雙刃只 +22%——它一開局就強、每升一級卻加得少。
    // 所以調的是「升級的成長」（第 2～5 級與共鳴），不是第 1 級。
    desc: ['一開始就同時擲出兩把大光刃', '傷害 +40%', '光刃 +1、飛得更遠', '擲得更快', '光刃 +1、傷害 +20%'],
    lv: [
      { dmg: 18, cd: 1.0,  count: 2, range: 210, speed: 400, size: 16 },
      { dmg: 25, cd: 1.0,  count: 2, range: 210, speed: 400, size: 16 },
      { dmg: 25, cd: 1.0,  count: 3, range: 245, speed: 420, size: 17 },
      { dmg: 27, cd: 0.85, count: 3, range: 245, speed: 440, size: 18 },
      { dmg: 32, cd: 0.85, count: 4, range: 255, speed: 460, size: 19 },
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
// M8 第五輪：職業制。每個職業 6 把武器、6 個增幅，職業內「一把武器對一個增幅」（專屬武器共用同類武器的那一個）。
// 每個增幅＝一點基礎數值（和 M8 以前的 4 個增幅同一個量級：傷害 10%／冷卻 8%／拾取＋移速／生命＋回復）＋ 一個改變打法的效果（fx，規則寫在 sim.js）。
// 效果來自這個類型共通的機制（分裂、彈射、暴擊、持續傷害、擴散、吸引、擊退、暈眩、延長存在、停止或移動時累積），名稱全部自己取。
// 每個效果都有行為探針（tools/passive-form.mjs）：只有拿了它才陽性，其他增幅全部是對照組。
const ST = {
  dmg: [{ stat: 'dmg', pct: 0.10 }], cdr: [{ stat: 'cdr', pct: 0.08 }],
  move: [{ stat: 'magnet', pct: 0.30 }, { stat: 'speed', pct: 0.04 }], life: [{ stat: 'maxHp', flat: 20 }, { stat: 'regen', flat: 0.4 }],
};
const STXT = { dmg: '每級傷害 +10%', cdr: '每級冷卻 -8%', move: '每級拾取 +30%、移速 +4%', life: '每級生命 +20、回復 +0.4/秒' };
const pv = (name, color, st, effect, fx) => ({ name, color, desc: `${effect}（${STXT[st]}）`, effect, mods: ST[st], fx });
export const PASSIVES = {
  // ---- 燈銃手 ----
  shardtip: pv('裂光彈頭', '#ffe08a', 'cdr', '光矢命中時分裂出兩道碎光', { n: 2, dmgK: 0.4, speed: 300, life: 0.35 }),
  prism:    pv('折光稜鏡', '#9ffff0', 'cdr', '折光彈每反彈一次，傷害 +20%', { perBounce: 0.2 }),
  steady:   pv('靜息準星', '#9fb8ff', 'dmg', '站定 0.5 秒後，遠星銃下一槍必定暴擊（2.5 倍）', { still: 0.5, mul: 2.5 }),
  lens:     pv('聚光鏡',   '#fff0a0', 'dmg', '聚光槍連續打中同一隻，每次傷害 +25%（最多 +100%）', { per: 0.25, max: 4, keep: 1.6 }),
  beacon:   pv('哨站燈油', '#9fffb8', 'life', '站在燈塔 100px 內時，燈塔射速 +70%', { r: 100, rate: 1.7 }),
  hive:     pv('蜂巢',     '#e6ff7a', 'move', '擊倒怪物時多放出一隻暫時的螢蜂（最多 4 隻、存在 4 秒）', { max: 4, life: 4 }),
  // ---- 燈術師 ----
  stardust: pv('星塵',     '#ffb0f0', 'dmg', '落星爆炸處留下 2 秒的星塵區，持續傷害', { life: 2, rK: 0.7, dmgK: 0.12, tick: 0.3 }),
  stone:    pv('引光石',   '#b48cff', 'move', '被光井吸在一起的怪互相碰撞會受傷', { r: 26, dmgK: 1.2 }),
  conduct:  pv('導電',     '#c8b8ff', 'dmg', '被雷蕊打中的怪，下一次受到其他傷害 +60%', { mul: 1.6, keep: 2.5 }),
  wick:     pv('快燃芯',   '#ff8a5c', 'cdr', '燃燒中的怪死掉時，火會傳給 70px 內的怪', { r: 70, t: 2 }),
  ember:    pv('暖芯',     '#ff9fb4', 'life', '燈暈每燒到一隻怪回復 0.3 生命（每次最多 3）', { per: 0.3, cap: 3 }),
  ashwalk:  pv('焦土步',   '#ff7a3c', 'cdr', '移動時累積熱量，停下 0.3 秒時一圈爆開（走越久越痛）', { perPx: 0.05, max: 60, r: 95, stop: 0.3, minHeat: 8 }),
  // ---- 刃舞者 ----
  gale:     pv('刃風',     '#c9f6ff', 'move', '裂光斬在身邊 110px 內斬中怪時，1 秒內移速 +30%', { r: 110, t: 1, mul: 1.3 }),
  returner: pv('迴旋',     '#9ff0d0', 'dmg', '光刃回程更快、回程傷害 +50%', { speed: 1.35, dmg: 1.5 }),
  ward:     pv('護身環',   '#8fe8ff', 'life', '環燈的光球會擋下敵人的子彈', { pad: 6 }),
  bulwark:  pv('堅壁',     '#ffe6b0', 'cdr', '被光牆推著走的怪撞到其他怪時，兩隻都受傷', { dmgK: 0.6 }),
  stun:     pv('震心',     '#ffe08a', 'dmg', '被燈鐘震到的怪暈眩 0.7 秒（守衛除外）', { t: 0.7 }),
  chainfuse:pv('連環引信', '#ffd84a', 'cdr', '燈籠爆炸會引爆 130px 內的其他燈籠', { r: 130 }),
};

// ---- 職業：開局前選（主選單記住上次的）；局內「新武器／新增幅」只會出現自己職業池裡的 ----
// trait：天生能力（不用選）。規則寫在 sim.js；三個職業玩起來憑什麼不同，由 tools/class-form.mjs 實際量（命中距離、持續傷害比例、擊退位移）。
export const CLASSES = {
  gunner: { name: '燈銃手', color: '#ffd27a', desc: '遠距、點與直線、精準', traitDesc: '天生：12% 機率暴擊（2 倍傷害）',
    weapons: ['bolt', 'lance', 'sniper', 'ricochet', 'sentry', 'wisps'], passives: ['shardtip', 'lens', 'steady', 'prism', 'beacon', 'hive'],
    start: 'bolt', exclusive: ['emberbow'], trait: { crit: 0.12, critMul: 2 } },
  mage:   { name: '燈術師', color: '#c8a0ff', desc: '範圍、場、持續傷害', traitDesc: '天生：範圍攻擊命中時附帶 1.2 秒灼燒',
    weapons: ['mortar', 'vortex', 'chain', 'flame', 'aura', 'trail'], passives: ['stardust', 'stone', 'conduct', 'wick', 'ember', 'ashwalk'],
    // 預設起始武器原本是落星：延遲落下、冷卻長，早期擋不住一般小怪（第一章 fresh 12 局只過 2 局，改燈暈起始是 12/12；tools/class-gap.mjs）
    start: 'aura', exclusive: ['starfall'], trait: { areaBurn: 0.3, burnT: 1.2 } },
  blade:  { name: '刃舞者', color: '#9ff0d0', desc: '推擠、擊退、把怪趕走', traitDesc: '天生：身邊 90px 內的命中擊退加倍，受到碰撞傷害 -25%，對推不動的守衛與精英傷害加倍',
    weapons: ['slash', 'boomerang', 'orbit', 'wall', 'pulse', 'mines'], passives: ['gale', 'returner', 'ward', 'bulwark', 'stun', 'chainfuse'],
    // heavyMul（M8 第五輪）：推擠與擊退對守衛無效，刃舞者在守衛戰裡明顯吃虧（tools/class-gap.mjs：六個生態系有四個晚一個養成階段）。
    // 24 局掃描（晶窟 early／凍星原 mid／深根城 late）：×1 守衛戰輸 10／14／7 局，×1.3 輸 6／6／8，×2 輸 1／4／1，×2.5 輸 2／4／2——×2 之後持平，取 2
    start: 'boomerang', exclusive: ['twinblade'], trait: { nearR: 90, nearKnock: 2, contact: 0.75, heavyMul: 2 } },
};
export const DEFAULT_CLASS = 'gunner';
// ---- 羈絆（M8 第五輪第二批）：同時持有兩把特定武器時觸發的效果，和增幅一樣要「改變打法」（規則寫在 sim.js，行為探針在 tools/bond-form.mjs）。
// 每個職業三組、剛好把 6 把武器分成三對：選 4 把時至少完成一組、最多兩組——帶哪 4 把（完成哪幾組）就是決定。
// 專屬武器算成它同類的一般武器（燼羽弓＝螢火連弩、星隕杖＝落星、曦光雙刃＝迴光刃）。
// 每個職業 6 選 4 只有 15 種組合（三職業 45 種），bond-form 全部窮舉：每條羈絆只在兩把都在時生效，其餘組合是對照組。
export const BONDS = {
  crossfire:  { cls: 'gunner', weapons: ['bolt', 'ricochet'],   name: '交錯火網', desc: '光矢碰到畫面邊緣會反彈（最多兩次），每次反彈多飛 0.6 秒、能再打中同一隻', fx: { bounces: 2, life: 0.6 } },
  mark:       { cls: 'gunner', weapons: ['sniper', 'lance'],    name: '標定',     desc: '遠星銃打中的怪被標記 3 秒：受到的所有傷害 +30%，聚光槍也會優先轉向它', fx: { t: 3, mul: 1.3 } },
  patrol:     { cls: 'gunner', weapons: ['sentry', 'wisps'],    name: '巡哨',     desc: '每立起一座燈塔，就多放出一隻螢蜂守著它（燈塔熄滅就消失）', fx: {} },
  starwell:   { cls: 'mage',   weapons: ['mortar', 'vortex'],   name: '隕井',     desc: '每口張開的光井會額外引來一顆落星砸在中心（傷害 +30%）', fx: { mul: 1.3 } }, // 第一版是「把原本的落星改砸光井」：燈術師的落星不再打最密的怪，level-report 霧沼 fresh 從 6/6 掉到 2/6——羈絆不可以讓人變弱，改成額外加一顆
  thunderfire:{ cls: 'mage',   weapons: ['chain', 'flame'],     name: '雷火',     desc: '電弧打中燃燒中的怪時，引爆一圈火焰', fx: { r: 55, dmgK: 0.6 } },
  warmpath:   { cls: 'mage',   weapons: ['aura', 'trail'],      name: '暖徑',     desc: '站在自己的燼痕上時，燈暈範圍擴大 40%', fx: { mul: 1.4 } },
  returnslash:{ cls: 'blade',  weapons: ['boomerang', 'slash'], name: '迴斬',     desc: '迴光刃回到手上時，朝最近的怪揮出一道劍氣（每 0.9 秒最多一道）', fx: { cd: 0.9 } },
  bellring:   { cls: 'blade',  weapons: ['orbit', 'pulse'],     name: '鐘環',     desc: '燈鐘敲響時，環燈的光球向外擴張到 2.2 倍半徑（1.5 秒）', fx: { mul: 2.2, t: 1.5 } },
  minewall:   { cls: 'blade',  weapons: ['wall', 'mines'],      name: '推雷',     desc: '每推出一次光牆，就在正前方放下一顆燈籠', fx: { ahead: 70 } },
};
export const BOND_ALIAS = { emberbow: 'bolt', starfall: 'mortar', twinblade: 'boomerang' }; // 專屬武器在羈絆裡算成哪一把
// 燈術師天生灼燒認得的「範圍攻擊」（傷害來源）
export const AREA_SRC = ['mortar', 'starfall', 'aura', 'flame', 'vortex', 'trail', 'stardust', 'ashwalk', 'crush'];
export const classOf = (weaponId) => Object.keys(CLASSES).find((c) => CLASSES[c].weapons.includes(weaponId) || CLASSES[c].exclusive.includes(weaponId)) ?? null;

// ---- 共鳴：武器滿級＋持有指定被動，開燈核時進化 ----
export const RESONANCES = {
  bolt:  { needs: 'shardtip', name: '流星弩', desc: '巨大的流星光矢貫穿一切，擊殺時迸出碎光',
           stats: { dmg: 24, cd: 0.32, shots: 5, pierce: 99, speed: 520, shard: 3 } },
  orbit: { needs: 'ward', name: '星環',   desc: '光環擴張，並不斷向外拋射星光',
           stats: { dmg: 32, count: 6, radius: 68, spin: 4.4, size: 12, flingCd: 0.6 } },
  lance:     { needs: 'lens', name: '天光槍',   desc: '四道光束同時射向四方，又長又寬、傷害大增',
               stats: { dmg: 52, cd: 1.0, len: 440, w: 30, beams: 4 } },
  pulse:     { needs: 'stun', name: '晨鐘',     desc: '震波範圍大增、敲得更快，推開整片菌群',
               stats: { dmg: 42, cd: 1.3, radius: 150, push: 140 } },
  sentry:    { needs: 'beacon',  name: '燈塔群',   desc: '可同時立起五座燈塔，每座三連發、射得更快更遠',
               stats: { dmg: 16, cd: 2.4, max: 5, life: 12, fireCd: 0.34, range: 320, shots: 3, pierce: 2 } },
  // M8 第四輪新武器（當時沿用 4 個增幅；M8 第五輪職業制改成職業內一對一，配對見 CLASSES 與每一行的 needs）
  slash:     { needs: 'gale',  name: '天裂',     desc: '一次揮出三道巨大的劍氣，飛得更遠、寬到橫掃半個畫面',
               stats: { dmg: 58, cd: 0.8, count: 3, speed: 380, range: 340, w0: 20, w1: 84 } },
  vortex:    { needs: 'stone', name: '蝕星',     desc: '三口巨大的光井同時張開，吸力極強，炸開時傷害驚人',
               stats: { dmg: 12, tick: 0.25, cd: 3.4, r: 110, pull: 150, dur: 2.4, burst: 90, count: 3 } },
  wall:      { needs: 'bulwark', name: '晨壁',     desc: '四面光牆同時往四方推出，又寬又遠',
               stats: { dmg: 48, cd: 1.7, len: 80, speed: 260, range: 320, walls: 4 } },
  sniper:    { needs: 'steady',  name: '天狼',     desc: '一次狙擊四個最遠的目標，落點大爆炸',
               stats: { dmg: 140, cd: 0.8, range: 460, shots: 4, splash: 48 } },
  trail:     { needs: 'ashwalk', name: '燎原',     desc: '燼痕又寬又久，踩進去的怪大幅減速',
               stats: { dmg: 22, tick: 0.35, r: 36, life: 3.6, step: 32, slow: 0.45 } },
  ricochet:  { needs: 'prism', name: '萬華鏡',   desc: '四發光彈在畫面裡反彈六次，每次反彈都分出一道碎光',
               stats: { dmg: 30, cd: 0.8, shots: 4, speed: 420, bounces: 6, pierce: 4, split: 1 } },
  // M6：每一把武器（含專屬起始武器）都要有對應的增幅（被動）可以共鳴。
  // 曦光雙刃原本配引光石，但引光石（拾取／移速）不加戰力，照共鳴提示先升它反而變弱（第三章 0/6），改配聚光鏡。
  // tools/resonance-check.mjs 檢查「武器總數 ＝ 有共鳴的武器數」、需要的被動存在、共鳴數值涵蓋那把武器用到的每個欄位（部署門檻）。
  aura:      { needs: 'ember', name: '暖陽',     desc: '燈暈擴大成一輪暖陽，灼燒更快、敵人大幅減速',
               stats: { dmg: 26, radius: 104, tick: 0.35, slow: 0.45 } },
  chain:     { needs: 'conduct', name: '雷網',     desc: '三道電弧同時竄出，在怪群之間跳得更遠更多次',
               stats: { dmg: 44, cd: 0.9, jumps: 9, range: 150, arcs: 3 } },
  boomerang: { needs: 'returner', name: '月輪',     desc: '五把大光刃同時擲出，飛得更遠更快',
               stats: { dmg: 38, cd: 1.0, count: 5, range: 250, speed: 440, size: 16 } },
  mortar:    { needs: 'stardust',  name: '流星雨',   desc: '一次落下六顆星，間隔更短、範圍更大',
               stats: { dmg: 84, cd: 1.2, count: 6, radius: 76, delay: 0.45 } },
  flame:     { needs: 'wick',  name: '龍焰',     desc: '火舌變長變寬，轉向極快，幾乎沒有死角',
               stats: { dmg: 20, tick: 0.1, range: 160, half: 0.9, turn: 8 } },
  wisps:     { needs: 'hive', name: '螢群',     desc: '七隻螢蜂成群追擊，飛得更快、咬得更頻繁',
               stats: { dmg: 32, count: 7, speed: 360, hitCd: 0.2, seek: 360 } },
  mines:     { needs: 'chainfuse', name: '燈籠陣',   desc: '燈籠放得更快、數量更多，爆炸範圍大幅擴張',
               stats: { dmg: 100, cd: 0.7, max: 10, trigger: 30, radius: 100, arm: 0.3 } },
  // M8：共鳴燈核讓共鳴幾乎每局拿得到之後，兩把專屬武器在單武器測試超過專屬上限（1.51、1.57 倍）。
  // 先試傷害 −4～5%：分數完全沒動（通關記滿分，第三章的陣亡點不變），所以改成每次少一顆星／一把刃。
  starfall:  { needs: 'stardust',  name: '星墜',     desc: '一次落下六顆星，幾乎不停歇',
               stats: { dmg: 78, cd: 1.15, count: 6, radius: 80, delay: 0.35, guard: 150 } },
  twinblade: { needs: 'returner',  name: '曦日雙輪', desc: '四把巨大光刃高速來回，範圍與速度都再提升',
               stats: { dmg: 34, cd: 0.75, count: 4, range: 275, speed: 490, size: 21 } },
  emberbow:  { needs: 'shardtip',  name: '焚天羽',   desc: '六支火箭貫穿怪群，燃燒大幅增強',
               stats: { dmg: 22, cd: 0.4, shots: 6, pierce: 5, speed: 560, burn: 14, burnT: 3.5 } }, // M8：燃燒 16 → 14（脹孢囊變快變多後，它的燃燒特別剋脹孢囊，單武器測試 1.50 倍碰到專屬上限）
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
  // farGuard（M8 第五輪）：被遠處（> dist）打到時外殼硬化（受傷 ×dmgTaken）並衝過來（速度 ×rush、t 秒）。
  // 理由：職業制之後燈銃手在遠處就把脹孢囊打掉，霧沼的招牌對它形同不存在（引爆只剩基準的 2～12%）；加強怪、不削弱玩家，近身職業幾乎碰不到這條規則
  // 只算「被射中」（範圍攻擊、場、灼燒不算）；距離掃過 170／220／260：170、220 時燈術師（雷蕊跳得遠）霧沼 30 局少贏 6 局，260 時 20 對 22（雜訊內），燈銃手每關仍 ≥ 基準 24%
  bloater:  { name: '脹孢囊', r: 16, hp: 45,  speed: 85,  dmg: 6,  xp: 3, oil: 2, ai: 'bomber', fuse: 1.0, blastR: 72, blastDmg: 22, blastHurtsEnemies: 60, farGuard: { dist: 260, dmgTaken: 0.35, rush: 2.4, t: 1.5 } },
  // 第三章：晶窟
  turret:   { name: '晶刺',   r: 14, hp: 60,  speed: 0,   dmg: 8,  xp: 4, oil: 3, ai: 'turret', fireCd: 2.8, shotDmg: 8, mass: 99 },
  blinker:  { name: '閃晶蛾', r: 10, hp: 16,  speed: 80,  dmg: 7,  xp: 2, oil: 2, ai: 'blink', blinkCd: 3.6, blinkWarn: 0.8 },
  shell:    { name: '晶甲蟲', r: 17, hp: 42,  speed: 38,  dmg: 11, xp: 4, oil: 3, ai: 'chase', armor: 0.6, mass: 3 },
  // 第四章：灰燼坡
  cinder:   { name: '燼蟲',   r: 10, hp: 20,  speed: 72,  dmg: 7,  xp: 2, oil: 2, ai: 'chase', deathZone: { r: 28, dur: 1.5, dmg: 5 } }, // 死後留下一灘火
  golem:    { name: '焦岩獸', r: 22, hp: 160, speed: 34,  dmg: 16, xp: 7, oil: 5, ai: 'slam', armor: 0.7, mass: 5, slamR: 76, slamDmg: 12, windup: 0.9, slamCd: 4.5 },
  // 第五章：凍星原
  frostmoth:{ name: '霜蛾',   r: 11, hp: 22,  speed: 72,  dmg: 5,  xp: 2, oil: 2, ai: 'spit', keep: 170, fireCd: 2.4, shotDmg: 6, shotSpeed: 150, slowShot: { t: 1.4, k: 0.4 } }, // 冰針命中會減速
  glider:   { name: '冰滑蟲', r: 12, hp: 30,  speed: 66,  dmg: 10, xp: 3, oil: 2, ai: 'lunge', lungeSpeed: 430, windup: 0.5, lungeT: 0.45, lungeCd: 2.2, range: 200 },
  // 第六章：深根城
  hive:     { name: '菌巢',   r: 24, hp: 240, speed: 0,   dmg: 8,  xp: 10, oil: 6, ai: 'hive', mass: 99, spawnCd: 3.2, spawn: { kind: 'mite', n: 2, max: 8 } },
  rooter:   { name: '根鬚兵', r: 16, hp: 64,  speed: 44,  dmg: 9,  xp: 4, oil: 3, ai: 'chase', armor: 0.7, mass: 3 },
  // 燈塔守衛
  boss1:    { name: '噬燈菌母', r: 42, hp: 40000, speed: 44, dmg: 14, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss2:    { name: '沼母巨蛭', r: 40, hp: 52000, speed: 50, dmg: 13, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss3:    { name: '晶心守衛', r: 44, hp: 70000, speed: 30, dmg: 18, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss4:    { name: '熔心巨獸', r: 46, hp: 110000, speed: 40, dmg: 20, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss5:    { name: '霜冠巨像', r: 46, hp: 140000, speed: 34, dmg: 20, xp: 0, oil: 0, ai: 'boss', mass: 50 },
  boss6:    { name: '深根之心', r: 50, hp: 180000, speed: 14, dmg: 24, xp: 0, oil: 0, ai: 'boss', mass: 50 },
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
    roster: [[0, 'mite', 8], [20, 'leech', 4], [90, 'moth', 4], [140, 'bloater', 8], [220, 'spitter', 2], [300, 'leech', 3]], // M8：脹孢囊 3 → 8（和速度 50 → 85、第 300 秒多一波包圍一起，讓引信回到 M7 水準；量測見回報）
    events: [
      { at: 75,  type: 'rush',  kind: 'leech', n: 12 },
      { at: 130, type: 'elite', kind: 'leech' },
      { at: 180, type: 'ring',  kind: 'bloater', n: 12 },
      { at: 240, type: 'rush',  kind: 'moth', n: 30 },
      { at: 280, type: 'elite', kind: 'bloater' },
      { at: 300, type: 'ring',  kind: 'bloater', n: 14 },
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
  // ---- M7 第三批：第四～六章。難度建立在「有進階系統之後」的戰力上（見 tools/chapter-curve.mjs） ----
  {
    id: 4, name: '灰燼坡', tagline: '熔坑定時噴發，敵我都會被燒；焦岩獸砸地、燼蟲死後留下火', palette: 'ash', hue: 330,
    length: 480, bossAt: 420, arenaR: 250, boss: 'boss4', terrain: 'vents', fog: null,
    hpScale: (t) => 1.4 + Math.max(0, t - 30) / 85,
    dmgScale: (t) => 1.2 + t / 280,
    spawnRate: (t) => 1.9 + t * 0.024 + (t > 240 ? (t - 240) * 0.02 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 6], [0, 'cinder', 4], [60, 'moth', 3], [120, 'golem', 1], [200, 'spitter', 2], [260, 'cinder', 4], [300, 'golem', 1]],
    events: [
      { at: 70,  type: 'ring',  kind: 'cinder', n: 24 },
      { at: 130, type: 'elite', kind: 'golem' },
      { at: 190, type: 'rush',  kind: 'cinder', n: 26 },
      { at: 250, type: 'ring',  kind: 'golem', n: 5 },
      { at: 300, type: 'elite', kind: 'cinder' },
      { at: 350, type: 'rush',  kind: 'moth', n: 34 },
      { at: 395, type: 'ring',  kind: 'cinder', n: 40 },
      { at: 420, type: 'boss',  kind: 'boss4' },
    ],
    reward: { clear: 1200, firstClear: 1200, gear: [5, 25, 40, 25, 5], stardust: 25, firstStardust: 150 },
  },
  {
    id: 5, name: '凍星原', tagline: '冰面上會滑，霜霧縮短瞄準，霜蛾的冰針會讓你變慢', palette: 'frost', hue: 200,
    length: 480, bossAt: 420, arenaR: 260, boss: 'boss5', terrain: 'ice', fog: 260,
    hpScale: (t) => 1.9 + Math.max(0, t - 30) / 60,
    dmgScale: (t) => 1.45 + t / 240,
    spawnRate: (t) => 2.1 + t * 0.026 + (t > 240 ? (t - 240) * 0.022 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 6], [0, 'frostmoth', 3], [40, 'glider', 3], [120, 'shell', 2], [200, 'frostmoth', 3], [280, 'glider', 3]],
    events: [
      { at: 65,  type: 'rush',  kind: 'glider', n: 14 },
      { at: 125, type: 'elite', kind: 'frostmoth' },
      { at: 180, type: 'ring',  kind: 'frostmoth', n: 16 },
      { at: 240, type: 'elite', kind: 'glider' },
      { at: 290, type: 'ring',  kind: 'shell', n: 12 },
      { at: 345, type: 'rush',  kind: 'glider', n: 22 },
      { at: 395, type: 'ring',  kind: 'frostmoth', n: 30 },
      { at: 420, type: 'boss',  kind: 'boss5' },
    ],
    reward: { clear: 1600, firstClear: 1600, gear: [0, 20, 40, 32, 8], stardust: 30, firstStardust: 180 },
  },
  {
    id: 6, name: '深根城', tagline: '菌根牆從兩側推進包夾，菌巢不拆會一直生怪', palette: 'root', hue: 100,
    length: 480, bossAt: 420, arenaR: 270, boss: 'boss6', terrain: null, fog: null,
    roots: { first: 25, every: 14, dist: 300, speed: 34, len: 420, w: 26, dmg: 6 },
    hpScale: (t) => 2.0 + Math.max(0, t - 30) / 58,
    dmgScale: (t) => 1.5 + t / 230,
    spawnRate: (t) => 2.2 + t * 0.027 + (t > 240 ? (t - 240) * 0.024 : 0),
    maxEnemies: 300,
    roster: [[0, 'mite', 6], [0, 'rooter', 2], [45, 'hive', 1], [100, 'splitter', 3], [160, 'rooter', 3], [240, 'hive', 1], [300, 'blinker', 3]],
    events: [
      { at: 60,  type: 'ring',  kind: 'rooter', n: 10 },
      { at: 120, type: 'elite', kind: 'hive' },
      { at: 175, type: 'rush',  kind: 'splitter', n: 18 },
      { at: 235, type: 'elite', kind: 'rooter' },
      { at: 285, type: 'ring',  kind: 'hive', n: 4 },
      { at: 340, type: 'rush',  kind: 'rooter', n: 16 },
      { at: 395, type: 'ring',  kind: 'blinker', n: 30 },
      { at: 420, type: 'boss',  kind: 'boss6' },
    ],
    reward: { clear: 2000, firstClear: 2000, gear: [0, 10, 40, 38, 12], stardust: 35, firstStardust: 220 },
  },
];
export const CHAPTER1 = CHAPTERS[0];

// ---- 關卡（M8 第二輪）：每個生態系（上面的每一章）10 關，難度遞增 ----
// 擁有者提案：「每個生態系擴增到 10 關，難度遞增，怪物血量上調」。
// 第 base 關的數值＝M8 以前的那一章（倍率全部是 1），舊的平衡數字有明確的對應點；其他關只改參數，程式路徑完全相同。
// M8 第三輪（擁有者選「B」）：第 1 關就是原本的難度，之後每關更難——不設比原本容易的關卡（唯一的玩家是擁有者，不為假想的新手暖身）。
// 第一批只用簡單的遞增規則（每往後一關乘一次）：血量、出怪速度、怪物傷害三個槓桿一起動，不只調血量。逐關的槓桿設計是第二批。
export const STAGES = {
  count: 10, base: 1,
  unlockNext: 3,                        // 通關第幾關開放下一個生態系的第 1 關（主線 6 × 3 關；第 4～10 關是往深處的挑戰）
  oil: 1.10,                            // 通關燈油（一般＋首通）每往後一關的倍率；擊倒燈油本來就隨擊倒的數量變多
  deepFirstStardust: 20,                // 第 2～10 關每關的首通星砂（第 1 關＝原本一章的首通星砂；舊存檔的第 1 關視為已領過）
};
// 逐關的難度槓桿（M8 第三輪第三批）。北極星：擁有者不要「無腦加怪物血量」——血量是最後才動的槓桿（第 5 關起才加、第 10 關只到 1.25 倍）。
// 每一關的主要槓桿寫在最後一欄（回報與選關畫面都照這裡說）。欄位：
//   spawn 出怪密度、speed 怪的移動速度、cd 怪的攻擊冷卻（除以它＝更常出手）、sig 招牌機制強度（招牌怪在名單與成群事件裡的份量、
//   深根城根牆的頻率）、elites 多出現的精英隻數（會掉燈核）、dmg 怪的傷害、hp 怪的血量（含守衛）
// 量過（M8 第三輪）：舊規則每關血量 ×1.10，第 10 關 2.36 倍——凍星原、深根城 asc2 在 3～4 分鐘就被一般小怪磨死、招牌機制反而變少。
export const STAGE_LEVERS = [
  { n: 1,  spawn: 1.00, speed: 1.00, cd: 1.00, sig: 1.0, elites: 0, dmg: 1.00, hp: 1.00, main: '原本的難度' },
  { n: 2,  spawn: 1.08, speed: 1.00, cd: 1.00, sig: 1.3, elites: 0, dmg: 1.00, hp: 1.00, main: '招牌機制變多、出怪變密' },
  { n: 3,  spawn: 1.14, speed: 1.04, cd: 1.05, sig: 1.5, elites: 0, dmg: 1.03, hp: 1.00, main: '招牌機制、怪變快' },
  { n: 4,  spawn: 1.18, speed: 1.07, cd: 1.10, sig: 1.7, elites: 1, dmg: 1.05, hp: 1.00, main: '怪更常出手、多一隻精英' },
  { n: 5,  spawn: 1.22, speed: 1.09, cd: 1.14, sig: 1.9, elites: 1, dmg: 1.08, hp: 1.05, main: '怪的行為更凶' },
  { n: 6,  spawn: 1.26, speed: 1.11, cd: 1.18, sig: 2.1, elites: 1, dmg: 1.11, hp: 1.08, main: '招牌機制加倍' },
  { n: 7,  spawn: 1.30, speed: 1.13, cd: 1.21, sig: 2.3, elites: 2, dmg: 1.14, hp: 1.11, main: '再多一隻精英、出怪更密' },
  { n: 8,  spawn: 1.34, speed: 1.15, cd: 1.24, sig: 2.5, elites: 2, dmg: 1.18, hp: 1.15, main: '全面加壓' },
  { n: 9,  spawn: 1.38, speed: 1.17, cd: 1.27, sig: 2.7, elites: 2, dmg: 1.22, hp: 1.20, main: '全面加壓' },
  { n: 10, spawn: 1.42, speed: 1.20, cd: 1.30, sig: 3.0, elites: 2, dmg: 1.26, hp: 1.25, main: '最終試煉：招牌機制三倍' },
];
// 各生態系的招牌怪（sig 放大它們在名單與成群事件裡的份量）；螢苔原的招牌是精英，所以它的 sig 換成多一隻精英
export const SIGNATURE = { 1: [], 2: ['bloater'], 3: ['blinker'], 4: ['cinder', 'golem'], 5: ['frostmoth', 'glider'], 6: ['rooter', 'hive'] };
// 多出來的精英：在菌潮最後幾波附近出現（組建已成形、燈核用得到）；種類用本章最後一隻精英
const EXTRA_ELITE_AT = [335, 385, 250]; // 最多 3 隻（螢苔原的招牌是精英，第 7 關起會用到第 3 個時間點）
// 某生態系的第 n 關：回傳一份 chapter（sim、meta、render 都照原本的方式使用它）
export function stageChapter(ch, n) {
  const L = STAGE_LEVERS[n - 1], oil = STAGES.oil ** (n - STAGES.base), sigKinds = SIGNATURE[ch.id] ?? [], r = ch.reward;
  const lastElite = [...ch.events].reverse().find((e) => e.type === 'elite')?.kind;
  const extra = (L.elites + (ch.id === 1 && L.sig >= 2 ? 1 : 0));
  const events = [
    ...ch.events.map((e) => ((e.type === 'ring' || e.type === 'rush') && sigKinds.includes(e.kind) ? { ...e, n: Math.round(e.n * L.sig) } : e)),
    ...EXTRA_ELITE_AT.slice(0, extra).map((at) => ({ at, type: 'elite', kind: lastElite })),
  ].sort((a, b) => a.at - b.at);
  return {
    ...ch, stage: n, key: `${ch.id}-${n}`, levers: L, bossHpMul: L.hp, speedMul: L.speed, cdMul: L.cd,
    hpScale: (t) => ch.hpScale(t) * L.hp, dmgScale: (t) => ch.dmgScale(t) * L.dmg, spawnRate: (t) => ch.spawnRate(t) * L.spawn,
    roster: ch.roster.map(([at, kind, w]) => [at, kind, sigKinds.includes(kind) ? w * L.sig : w]),
    events,
    ...(ch.roots ? { roots: { ...ch.roots, every: ch.roots.every / Math.sqrt(L.sig) } } : {}),
    reward: { ...r, clear: Math.round(r.clear * oil), firstClear: Math.round(r.firstClear * oil),
      firstStardust: n === STAGES.base ? r.firstStardust : STAGES.deepFirstStardust },
  };
}

// ---- 菌潮（週期性的怪物海）----
// 從 first 秒開始每 every 秒一波，到守衛出現前 beforeBoss 秒為止；第 k 波（0 起算）共 base＋grow×k 隻潮孢，分 bursts 批從四周湧入。
// 目的（擁有者回饋）：一局之內升不滿。量測（tools/level-report.mjs）：M7 前過關局結束時組建完成度 81～90%、全滿 0 局。
// cap：場上「菌潮怪」的上限，和一般怪的上限（章節的 maxEnemies）分開算——若共用同一個上限，菌潮滿場會擠掉本章的招牌怪
//      （量過：第二章脹孢囊的引信從 136 次掉到 1 次）。實際同屏總數見 tools/level-report 旁的量測與回報。
//      依據：擁有者手機（第 2 章、DPR 3）重場面 89 隻怪時繪製 p95 2ms、平均 59.5fps；怪物繪製大致隨數量線性增加（推論，要請擁有者重量）。
// 共鳴燈核（M8）：身上有武器「滿級＋持有對應增幅、還沒共鳴」，而場上的燈核不夠每把一顆時，delay 秒後在玩家附近 dist 處出現一顆燈核。
// 理由：燈核原本只有精英會掉（每章 2～3 隻、多在武器滿級之前出現），一局 4 把武器共鳴不完；擁有者滿等後仍然共鳴不了。
// 只補「等著共鳴的那幾把」：沒有武器在等時不出現，所以不會多給一般強化、燈油或經驗。量測見 tools/chest-report.mjs。
export const RESO_CHEST = { delay: 12, dist: 90 };
export const SURGE = { first: 60, every: 60, beforeBoss: 15, base: 20, grow: 60, bursts: 3, burstGap: 1.2, cap: 220, kind: 'swarm', hpPerWave: 0.3, total: 360, reserve: 60 };
// total：場上怪物總數的硬上限（M7 第三批量到：各類上限只管自己時，第六章同屏衝到 487 隻、邏輯耗時超過門檻）。
// reserve：菌潮最多只填到 total − reserve，保留給本章的怪（招牌怪不會被菌潮擠掉）。

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
// 升級選項的抽法（M8 第四輪：武器從 12 把變 18 把，均勻抽的話「新武器卡」會擠掉身上東西的升級，組建更難完成）：
// 身上已有的（武器升級、被動升級）權重 held，新的（新武器、新被動）權重 fresh；一次三張裡新武器卡最多 maxNewWeapon 張。
// pairHeld（M8 第五輪）：和身上某把武器配對的新增幅也算 held（一對一之後，共鳴不能只靠運氣抽到）
export const CHOICE = { held: 2, fresh: 1, maxNewWeapon: 1, pairHeld: true };
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
