// 輸入：浮動虛擬搖桿（觸控/滑鼠按住拖曳）＋鍵盤。輸出統一為 move 向量（長度 0~1）。
export function createInput(el) {
  const keys = new Set();
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const RADIUS = 56; // CSS px，搖桿最大半徑

  const down = (id, x, y) => { Object.assign(stick, { active: true, id, ox: x, oy: y, x, y }); };
  const move = (id, x, y) => { if (stick.active && stick.id === id) { stick.x = x; stick.y = y; } };
  const up = (id) => { if (stick.id === id) { stick.active = false; stick.id = null; } };

  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); down(e.pointerId, e.clientX, e.clientY); e.preventDefault(); });
  el.addEventListener('pointermove', (e) => move(e.pointerId, e.clientX, e.clientY));
  el.addEventListener('pointerup', (e) => up(e.pointerId));
  el.addEventListener('pointercancel', (e) => up(e.pointerId));
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); stick.active = false; });

  return {
    stick, RADIUS,
    reset() { keys.clear(); stick.active = false; stick.id = null; },
    get move() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (stick.active) {
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > 6) { const k = Math.min(d, RADIUS) / RADIUS / d; x += dx * k; y += dy * k; }
      }
      const len = Math.hypot(x, y);
      return len > 1 ? { x: x / len, y: y / len } : { x, y };
    },
  };
}
