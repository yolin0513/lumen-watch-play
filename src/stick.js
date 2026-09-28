// 浮動搖桿的純邏輯（不碰 DOM），input.js 用它，tools/input-latency.mjs 用同一份模擬手指軌跡量反應時間。
// cfg：
//   dead   死區（CSS px）：手指移動小於這個距離不動
//   full   拖多遠才全速（CSS px）：dead～full 之間速度線性增加
//   ring   搖桿外圈半徑（CSS px）：畫面上畫的圈
//   follow 手指拖出外圈時，原點跟著手指走（永遠保持在 ring 以內），反向時不必先把手指拖回原點
//   rampFrom 速度從哪個距離開始算起（預設＝dead；M1～M3 的舊版是從 0 算，所以一過死區就有 dead/full 的速度）
export const STICK_LEGACY = { dead: 6, full: 56, ring: 56, follow: false, rampFrom: 0 }; // M1～M3 的設定（量測對照用）

export function stickDown(s, id, x, y) { s.active = true; s.id = id; s.ox = x; s.oy = y; s.x = x; s.y = y; }
export function stickMove(s, id, x, y, cfg) {
  if (!s.active || s.id !== id) return;
  s.x = x; s.y = y;
  if (cfg.follow) {
    const dx = x - s.ox, dy = y - s.oy, d = Math.hypot(dx, dy);
    if (d > cfg.ring) { s.ox = x - dx / d * cfg.ring; s.oy = y - dy / d * cfg.ring; }
  }
}
export function stickUp(s, id) { if (s.id === id) { s.active = false; s.id = null; } }
// 回傳移動向量（長度 0～1）
export function stickVector(s, cfg) {
  if (!s.active) return { x: 0, y: 0 };
  const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
  if (d <= cfg.dead) return { x: 0, y: 0 };
  const from = cfg.rampFrom ?? cfg.dead;
  const k = Math.min(1, (d - from) / Math.max(1e-6, cfg.full - from)) / d;
  return { x: dx * k, y: dy * k };
}
