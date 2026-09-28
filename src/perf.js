// 效能量測模式：遊戲網址加 ?perf=章節（1～3），例如 …/lumen-watch-play/?perf=2
// 自動進行一局（無敵、固定 seed、自動繞圈移動、自動選升級），分兩段量每一幀：
//   輕場面：開局前 300 幀
//   重場面：快轉到第 360 秒（大量怪物、共鳴武器）後再量 600 幀
// 每一幀記錄：瀏覽器給的幀間隔、邏輯耗時、繪製耗時（再細分各繪製步驟）。量完在畫面上顯示報表，也放在 window.__perf。
// 手機實機要量就用手機開這個網址；桌面瀏覽器量到的數字不能代表手機。
// &off=fog,vignette,glow,particles,ground,filter：A/B 量測，關掉指定的繪製項目（看各項佔多少）
// &dpr=1：把畫布解析度上限改成指定倍率（看解析度佔多少）
// &sync=1：同步模式——每次 rAF 連續畫多幀，每幀畫完讀回一個像素逼 GPU 做完再計時。
//   給「頁面不可見、rAF 被節流」的環境用（例如開發環境的隱藏瀏覽器面板）：量得到繪製成本，量不到真實幀間隔。
import { CHAPTERS } from './content.js';

const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
const f1 = (x) => x.toFixed(1);

export function createPerf(chapterId, sync = false, off = []) {
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
  const stages = [{ name: '輕場面（開局）', frames: 300, skipTo: 0 }, { name: '重場面（第 360 秒）', frames: 600, skipTo: 360 }];
  let stage = 0, rec = [], lastNow = null, done = false, report = null, curPhases = null;
  const results = [];
  const prof = { off: new Set(off), // render.js 每畫完一個步驟呼叫 lap(名稱)
    start() { curPhases = {}; this.t = performance.now(); },
    lap(name) { const t = performance.now(); curPhases[name] = (curPhases[name] || 0) + (t - this.t); this.t = t; },
  };
  function summarize(st, rows, s) {
    const iv = rows.map((r) => r.interval).sort((a, b) => a - b);
    const up = rows.map((r) => r.update).sort((a, b) => a - b);
    const rd = rows.map((r) => r.render).sort((a, b) => a - b);
    const phases = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.phases)) (phases[k] ||= []).push(v);
    const ph = Object.entries(phases).map(([k, v]) => { v.sort((a, b) => a - b); return { k, avg: v.reduce((a, b) => a + b, 0) / v.length, p95: pct(v, 0.95) }; }).sort((a, b) => b.avg - a.avg);
    const elapsed = iv.reduce((a, b) => a + b, 0) / 1000;
    return { name: st.name, fps: rows.length / elapsed, iv: { p50: pct(iv, 0.5), p95: pct(iv, 0.95), p99: pct(iv, 0.99), max: iv.at(-1), over20: iv.filter((x) => x > 20).length, over34: iv.filter((x) => x > 34).length },
      update: { p50: pct(up, 0.5), p99: pct(up, 0.99), max: up.at(-1) }, render: { p50: pct(rd, 0.5), p95: pct(rd, 0.95), p99: pct(rd, 0.99), max: rd.at(-1) }, phases: ph,
      scene: { enemies: s.enemies.length, bullets: s.bullets.length, gems: s.gems.length } };
  }
  function text() {
    const lines = [`效能量測 第${chapter.id}章 ${chapter.name}｜${sync ? '同步模式' : '一般模式'}${off.length ? `｜關閉：${off.join(',')}` : ''}｜畫布 ${document.getElementById('game').width}×${document.getElementById('game').height}｜螢幕 ${innerWidth}×${innerHeight}、DPR ${devicePixelRatio}`];
    for (const r of results) {
      lines.push('', `【${r.name}】場面：怪 ${r.scene.enemies}、子彈 ${r.scene.bullets}、光屑 ${r.scene.gems}`,
        sync ? '幀間隔：同步模式不量（只量繪製成本）' : `平均 ${f1(r.fps)} fps；幀間隔 p50 ${f1(r.iv.p50)}／p95 ${f1(r.iv.p95)}／p99 ${f1(r.iv.p99)}／最慢 ${f1(r.iv.max)} ms；超過 20ms 的幀 ${r.iv.over20}、超過 34ms 的幀 ${r.iv.over34}`,
        `邏輯 p50 ${r.update.p50.toFixed(2)}／p99 ${r.update.p99.toFixed(2)}／最慢 ${r.update.max.toFixed(2)} ms`,
        `繪製 p50 ${f1(r.render.p50)}／p95 ${f1(r.render.p95)}／p99 ${f1(r.render.p99)}／最慢 ${f1(r.render.max)} ms`,
        `繪製細項（平均／p95 ms）：${r.phases.map((p) => `${p.k} ${p.avg.toFixed(2)}/${p.p95.toFixed(2)}`).join('、')}`);
    }
    return lines.join('\n');
  }
  return {
    chapter, prof, sync,
    get done() { return done; }, get report() { return report; },
    skipTo(stageIdx) { return stages[stageIdx]?.skipTo ?? 0; },
    get stage() { return stage; },
    // 自動移動：繞大圈，讓鏡頭與場面持續變化
    move(s) { const a = s.t * 0.5; return { x: Math.cos(a), y: Math.sin(a) }; },
    // 每幀呼叫：now＝rAF 時間；update／render 為量好的毫秒
    record(now, update, render, s) {
      if (done) return;
      if (sync || lastNow !== null) rec.push({ interval: sync ? 16.7 : now - lastNow, update, render, phases: curPhases || {} });
      lastNow = now;
      if (rec.length >= stages[stage].frames) {
        results.push(summarize(stages[stage], rec, s));
        rec = []; lastNow = null; stage++;
        if (stage >= stages.length) { done = true; report = { results, text: text() }; window.__perf = report; }
      }
    },
    needsSkip(s) { return !done && stages[stage].skipTo > s.t + 1; },
  };
}
