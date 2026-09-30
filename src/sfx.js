// 音效排程（M8 第三輪第二批，第四輪加變化）：把每一幀的遊戲事件變成「這一幀要播哪些聲音」。純邏輯、不碰 Web Audio，Node 可以直接測。
// 為什麼要有預算：滿場 300 隻怪、每次命中都播一聲會爆掉（聲音糊成一團、手機也吃不消）——和光暈疊加是同一類問題：數量沒有上限。
// 規則：
//   1. 同一種聲音有冷卻（cd 秒）：冷卻中的同類事件不另外發聲，累積起來，下一次發聲時音量隨累積數量變大（但有上限）——「很多下」聽得出來，但不會變成一堆聲音。
//   2. 同一種聲音同時最多 max 個在響；全部種類加起來最多 VOICES 個。各種類的 max 加總 ≤ VOICES（測試檢查），
//      所以重要的聲音（升級、共鳴、守衛）一定有自己的位置，不會被一大堆命中聲擠掉。
//   3. 每一幀依優先序處理（重要的先）。
// 第四輪（擁有者：「打擊音效有一點枯燥」＝變化不足）：
//   - 命中依「武器種類」分音色（刀刃、射擊、雷、火、光暈類、重擊、光束），一局的聲音隨組建不同；每一種是獨立的聲音，各有冷卻與上限。
//   - 同一次發聲帶上這段時間內命中的「最重的一下」與「打到精英／守衛」，合成時多疊一層（厚重、金屬、低沉）。
//   - 擊倒帶「連擊數」：連續擊倒（間隔短）音高逐步上揚，每 10 連擊多一聲清脆的鈴。
export const VOICES = 19; // ＝各種類 max 的加總（meta-test 檢查加總 ≤ VOICES）
export const SFX = {
  // id:         cd（秒）、dur（響多久，用來算同時發聲）、max（同類同時最多幾個）、prio（大的先處理）、vol（基礎音量 0～1）
  hit_slash:  { cd: 0.06, dur: 0.12, max: 1, prio: 1, vol: 0.4 },   // 刀刃：金屬擦過
  hit_shot:   { cd: 0.05, dur: 0.09, max: 1, prio: 1, vol: 0.35 },  // 射擊：短促的爆響
  hit_zap:    { cd: 0.06, dur: 0.1,  max: 1, prio: 1, vol: 0.35 },  // 雷：劈啪
  hit_fire:   { cd: 0.08, dur: 0.14, max: 1, prio: 1, vol: 0.3 },   // 火：轟
  hit_soft:   { cd: 0.07, dur: 0.1,  max: 1, prio: 1, vol: 0.3 },   // 光暈、光球、螢蜂：玻璃般的輕敲
  hit_thump:  { cd: 0.08, dur: 0.14, max: 1, prio: 1, vol: 0.4 },   // 落星、燈籠雷、燈鐘：重擊
  hit_beam:   { cd: 0.07, dur: 0.12, max: 1, prio: 1, vol: 0.35 },  // 光束：嗡的一聲
  kill:       { cd: 0.07, dur: 0.22, max: 2, prio: 2, vol: 0.5 },
  gem:        { cd: 0.09, dur: 0.12, max: 1, prio: 1, vol: 0.25 },
  blast:      { cd: 0.12, dur: 0.45, max: 2, prio: 3, vol: 0.6 },   // 燈籠雷、落星、燈鐘、自爆等爆炸類
  hurt:       { cd: 0.25, dur: 0.3,  max: 1, prio: 4, vol: 0.7 },
  level:      { cd: 0.35, dur: 0.9,  max: 1, prio: 6, vol: 0.7 },
  chest:      { cd: 0.4,  dur: 1.2,  max: 1, prio: 6, vol: 0.75 },
  evo:        { cd: 0.5,  dur: 1.6,  max: 1, prio: 7, vol: 0.85 },  // 共鳴
  boss:       { cd: 1.0,  dur: 2.2,  max: 1, prio: 8, vol: 0.8 },   // 守衛出現
  bossdown:   { cd: 1.0,  dur: 2.5,  max: 1, prio: 9, vol: 0.9 },
  heal:       { cd: 0.3,  dur: 0.4,  max: 1, prio: 3, vol: 0.45 },
};
// 武器（與其他傷害來源）→ 命中音色。每一把武器都要有（meta-test 的母體檢查：WEAPONS 全部都在這張表裡，含對照組）
export const HIT_FAMILY = {
  boomerang: 'slash', twinblade: 'slash', slash: 'slash', wall: 'slash',
  bolt: 'shot', emberbow: 'shot', sentry: 'shot', shard: 'shot', ricochet: 'shot',
  chain: 'zap',
  flame: 'fire', burn: 'fire', trail: 'fire',
  orbit: 'soft', aura: 'soft', wisps: 'soft', vortex: 'soft',
  mortar: 'thump', starfall: 'thump', mines: 'thump', pulse: 'thump',
  lance: 'beam', sniper: 'beam',
};
export const hitSound = (src) => `hit_${HIT_FAMILY[src] ?? 'shot'}`;
// 其他遊戲事件 → 聲音。沒列的事件不發聲
export const EVENT_SOUND = {
  kill: 'kill', gem: 'gem', blast: 'blast', mineBoom: 'blast', strike: 'blast', pulse: 'blast', hurt: 'hurt',
  level: 'level', chest: 'chest', evo: 'evo', bossdown: 'bossdown', revive: 'evo', heal: 'heal',
};
// 同一幀／冷卻中累積的次數 → 音量倍率：1 下＝1，之後慢慢變大，最多 MAX_BOOST 倍
export const MAX_BOOST = 1.8;
export const boostOf = (n) => Math.min(MAX_BOOST, 1 + Math.log2(Math.max(1, n)) * 0.25);
export const HEAVY = 30;          // 一下傷害 ≥ 這個值算「重擊」，多疊一層厚重的聲音
export const STREAK_GAP = 0.45;   // 兩次擊倒聲的間隔在這之內算連擊
export const STREAK_MAX = 12;     // 音高最多往上爬幾階

export function createMixer() {
  const last = {}, pending = {}, playing = []; // playing：[{ id, end }]；pending[id]：{ n, heavy, elite, boss }
  let streak = 0, lastKill = -Infinity;
  const add = (id, e) => {
    const q = (pending[id] ??= { n: 0, heavy: false, elite: false, boss: false });
    q.n++;
    if (e) { if ((e.v ?? 0) >= HEAVY || e.big) q.heavy = true; if (e.elite) q.elite = true; if (e.boss) q.boss = true; }
  };
  return {
    playing,
    get streak() { return streak; },
    // events：這一幀的遊戲事件；now：現在的時間（秒，單調遞增）。回傳 [{ id, vol, n, heavy, elite, boss, streak }]
    plan(events, now) {
      for (let i = playing.length - 1; i >= 0; i--) if (playing[i].end <= now) playing.splice(i, 1);
      for (const e of events) {
        if (e.type === 'hit') add(hitSound(e.src), e);
        else { const id = e.type === 'announce' && e.big ? 'boss' : EVENT_SOUND[e.type]; if (id) add(id, e.type === 'kill' ? { elite: e.elite, boss: e.boss } : null); }
      }
      const out = [];
      for (const id of Object.keys(pending).sort((a, b) => SFX[b].prio - SFX[a].prio)) {
        const d = SFX[id], q = pending[id];
        if (last[id] !== undefined && now - last[id] < d.cd) continue; // 冷卻中：留著，下一次發聲時一起算
        if (playing.filter((v) => v.id === id).length >= d.max || playing.length >= VOICES) continue;
        const o = { id, vol: d.vol * boostOf(q.n), n: q.n, heavy: q.heavy, elite: q.elite, boss: q.boss };
        if (id === 'kill') { streak = now - lastKill <= STREAK_GAP ? streak + q.n : q.n; lastKill = now; o.streak = streak; }
        out.push(o);
        playing.push({ id, end: now + d.dur });
        last[id] = now; delete pending[id];
      }
      return out;
    },
  };
}
