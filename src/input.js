// 輸入：浮動虛擬搖桿（觸控/滑鼠按住拖曳）＋鍵盤。輸出統一為 move 向量（長度 0~1）。
// 搖桿的計算在 stick.js（純邏輯，tools/input-latency.mjs 用同一份量反應時間）。
import { stickDown, stickMove, stickUp, stickVector } from './stick.js';

// M4 起：拖 22px 就全速；原點跟隨手指、保持在 30px 內（反向時手指只要往回拉一小段）。量測見 tools/input-latency.mjs
export const STICK = { dead: 6, full: 22, ring: 30, follow: true };

export function createInput(el) {
  const keys = new Set();
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); stickDown(stick, e.pointerId, e.clientX, e.clientY); e.preventDefault(); });
  el.addEventListener('pointermove', (e) => stickMove(stick, e.pointerId, e.clientX, e.clientY, STICK));
  el.addEventListener('pointerup', (e) => stickUp(stick, e.pointerId));
  el.addEventListener('pointercancel', (e) => stickUp(stick, e.pointerId));
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); stick.active = false; });

  return {
    stick, RADIUS: STICK.ring,
    reset() { keys.clear(); stick.active = false; stick.id = null; },
    get move() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const v = stickVector(stick, STICK);
      x += v.x; y += v.y;
      const len = Math.hypot(x, y);
      return len > 1 ? { x: x / len, y: y / len } : { x, y };
    },
  };
}
