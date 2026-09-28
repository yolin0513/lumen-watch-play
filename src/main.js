// 進入點：畫布尺寸、主迴圈、畫面狀態切換（主選單／遊戲中／暫停）。
// 網址參數：?debug 顯示 FPS／實體數。
import { createInput } from './input.js';
import { createSim, VW } from './sim.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const input = createInput(canvas);
const DEBUG = new URLSearchParams(location.search).has('debug');

let W = 0, H = 0, scale = 1, safeTop = 0;
let sim = null, mode = 'menu', paused = false, shown = null; // mode: menu 主選單背景展示 / run 正式一局
let renderer = createRenderer();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  W = canvas.width = Math.round(r.width * dpr);
  H = canvas.height = Math.round(r.height * dpr);
  scale = W / VW;
  // 瀏海高度：用一個 padding-top: env(safe-area-inset-top) 的隱形元素量出來，轉成邏輯單位
  const probe = document.getElementById('safeProbe');
  safeTop = probe ? probe.offsetHeight * (W / r.width) / scale : 0;
  if (sim) sim.state.vh = H / scale;
}
resize();
addEventListener('resize', resize);

const ui = createUI({
  start: () => newRun(),
  retry: () => newRun(),
  menu: () => toMenu(),
  choose: (i) => { sim.choose(i); input.reset(); shown = null; sync(); }, // 連續升級時 phase 仍是 choice，要強制重畫
  chestClose: () => { sim.closeChest(); input.reset(); sync(); },
  resume: () => { paused = false; input.reset(); sync(); },
  quit: () => toMenu(),
});
document.getElementById('pauseBtn').addEventListener('click', () => pause());
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && e.code !== 'KeyP') return;
  if (paused) { paused = false; input.reset(); sync(); } else pause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function pause() { if (mode !== 'run' || sim.state.phase !== 'play') return; paused = true; sync(); }

// 新版 Service Worker 接手後重新載入拿新檔案；遊戲中不打斷，等回主選單再載入。
// 第一次安裝（原本沒有 controller）不需要重載。
let reloadPending = false;
if (navigator.serviceWorker?.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (mode === 'menu') location.reload(); else reloadPending = true; });
}

// 主選單背景：無敵、繞圈走、自動挑升級的展示局
function toMenu() {
  if (reloadPending) { location.reload(); return; }
  mode = 'menu'; paused = false;
  sim = createSim({ seed: 7, vh: H / scale });
  sim.state.god = true;
  renderer = createRenderer();
  shown = null; ui.menu();
}
function newRun() {
  mode = 'run'; paused = false;
  sim = createSim({ seed: (Math.random() * 2 ** 31) | 0, vh: H / scale });
  renderer = createRenderer();
  input.reset(); shown = null; sync();
}

// 依 sim 狀態決定要顯示哪個面板（只在狀態改變時重畫 DOM）
function sync() {
  const s = sim.state;
  const want = mode === 'menu' ? 'menu' : paused ? 'pause' : s.phase;
  if (want === shown) return;
  shown = want;
  if (want === 'choice') ui.levelUp(s.choice);
  else if (want === 'chest') ui.chest(s.chest);
  else if (want === 'pause') ui.pause(s);
  else if (want === 'win' || want === 'lose') setTimeout(() => ui.result(s), want === 'lose' ? 700 : 0);
  else if (want === 'play') ui.hud();
}

function demoStep(dt) {
  const s = sim.state;
  if (s.phase === 'choice') sim.choose(0);
  if (s.phase === 'chest') sim.closeChest();
  if (s.t > 150) toMenu(); // 展示局定期重來，避免怪太多
  const a = s.t * 0.35;
  sim.update(dt, { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 });
}

const fps = { frames: 0, acc: 0, value: 0, worst: 0, cur: 0 };
let last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(raw, 1 / 30); // 分頁切回來時不要一次跳太多
  const t0 = performance.now();
  if (mode === 'menu') demoStep(dt);
  else if (!paused) { sim.update(dt, input.move); sync(); }
  renderer.render(g, sim.state, paused || sim.state.phase !== 'play' ? 0 : dt, W, H, scale, safeTop);
  if (input.stick.active && mode === 'run' && sim.state.phase === 'play' && !paused) drawStick();
  const cost = performance.now() - t0;
  fps.frames++; fps.acc += raw; fps.worst = Math.max(fps.worst, cost);
  if (fps.acc >= 1) { fps.value = fps.frames / fps.acc; fps.cur = fps.worst; fps.frames = 0; fps.acc = 0; fps.worst = 0; }
  if (DEBUG) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `${12 * (W / canvas.clientWidth)}px monospace`; g.fillStyle = '#0f0'; g.textAlign = 'left';
    const s = sim.state;
    g.fillText(`fps ${fps.value.toFixed(0)}  worst ${fps.cur.toFixed(1)}ms  enemies ${s.enemies.length}  bullets ${s.bullets.length}  gems ${s.gems.length}`, 8, H - 10);
  }
  requestAnimationFrame(frame);
}

// 浮動搖桿
function drawStick() {
  const st = input.stick, k = scale;
  g.setTransform(k, 0, 0, k, 0, 0);
  const cssToLogic = (W / canvas.clientWidth) / k;
  const rect = canvas.getBoundingClientRect();
  const ox = (st.ox - rect.left) * cssToLogic, oy = (st.oy - rect.top) * cssToLogic;
  let dx = (st.x - st.ox) * cssToLogic, dy = (st.y - st.oy) * cssToLogic;
  const R = input.RADIUS * cssToLogic, d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.strokeStyle = 'rgba(255,220,160,0.3)'; g.lineWidth = 2;
  g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,230,180,0.55)'; g.beginPath(); g.arc(ox + dx, oy + dy, R * 0.42, 0, Math.PI * 2); g.fill();
}

toMenu();
requestAnimationFrame(frame);
