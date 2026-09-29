// 燈核指引（M8 第三輪）：擁有者回報「精英掉的寶箱發現不了，還是無法共鳴全部武器」。
// 先前只有一個 10px 的小三角形、位置是用夾擠估的（斜方向時會偏）。這裡算出每一顆燈核（精英掉的、共鳴燈核）的：
//   距離與方向（從角色算）、在不在畫面裡（被頂部 HUD 蓋住的也算不在）、不在畫面裡時箭頭放在哪（角色→燈核的射線和內縮邊框的交點）。
// 純函式、不碰 DOM：render 照這裡的結果畫，也把結果回傳；shop-test 用自己算的座標比對（指引必須由實際座標算出，不能是裝飾）。
export const GUIDE = { margin: 28, hudTop: 92 };

// 座標都用「邏輯單位」（和世界座標同尺度，camX/camY 是畫面左上角的世界座標）。w、h：畫面的邏輯寬高；top：HUD 佔掉的頂部高度
export function chestGuides(pickups, player, camX, camY, w, h, top = GUIDE.hudTop) {
  const out = [], px = player.x - camX, py = player.y - camY, m = GUIDE.margin;
  const L = m, R = w - m, T = top + m, B = h - m;
  for (const it of pickups) {
    if (it.type !== 'chest') continue;
    const sx = it.x - camX, sy = it.y - camY, dx = it.x - player.x, dy = it.y - player.y;
    const dist = Math.hypot(dx, dy), angle = Math.atan2(dy, dx), onScreen = sx >= 0 && sx <= w && sy >= top && sy <= h;
    let ex = sx, ey = sy;
    if (!onScreen) {
      const c = Math.cos(angle), s = Math.sin(angle); let t = Infinity;
      if (c > 1e-9) t = Math.min(t, (R - px) / c); else if (c < -1e-9) t = Math.min(t, (L - px) / c);
      if (s > 1e-9) t = Math.min(t, (B - py) / s); else if (s < -1e-9) t = Math.min(t, (T - py) / s);
      ex = px + c * t; ey = py + s * t;
    }
    out.push({ reso: !!it.reso, onScreen, sx, sy, ex, ey, angle, dist });
  }
  return out;
}
