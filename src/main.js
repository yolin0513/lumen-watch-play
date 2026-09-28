// 進入點：畫布尺寸、主迴圈、畫面狀態切換（主選單／章節／天賦／裝備／遊戲中／暫停／結算）、存檔。
// 網址參數：?debug 顯示 FPS／實體數。
import { createInput } from './input.js';
import { createSim, makeRng, VW } from './sim.js';
import { createRenderer } from './render.js';
import { createUI, gearName } from './ui.js';
import { CHAPTERS, CHAPTER1 } from './content.js';
import { createStore, loadProfile, saveProfile, defaultProfile, SAVE_KEY } from './save.js';
import { profileMods, settleRun, buyTalent, equip, unequip, upgradeGear, salvage, chapterUnlocked } from './meta.js';
import { createPerf } from './perf.js';
import { drawGacha, gachaPay, gachaCost, buyItem, canBuy, claimDaily, canClaimDaily, shopItem } from './shop.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const input = createInput(canvas);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const perf = params.has('perf') ? createPerf(Number(params.get('perf')) || 1, params.has('sync')) : null; // 效能量測模式，見 perf.js

let W = 0, H = 0, scale = 1, safeTop = 0;
let sim = null, mode = 'menu', paused = false, shown = null; // mode: menu 主選單類畫面（背景跑展示局）/ run 正式一局
let renderer = null, runSeed = 0, chapterId = 1, settled = null;

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

// ---------- 存檔（任何失敗都不擋遊戲，只提示一次） ----------
const store = createStore(() => window.localStorage);
const loaded = loadProfile(store);
let profile = loaded.profile, writable = loaded.writable, warnedSave = false;
const LOAD_NOTICE = {
  corrupt: '存檔損壞，已另外備份並重新開始。',
  repaired: '部分存檔資料不正確，已自動修正。',
  migrated: '存檔已升級到新版本（舊檔已備份）。',
  future: '這份存檔來自較新版本的遊戲，這次遊玩不會寫入存檔。',
  unavailable: '讀不到瀏覽器存檔，這次的進度只保留到關閉頁面為止。',
  'migrate-failed': '存檔升級失敗，原檔已保留；這次的進度只保留到關閉頁面為止。',
  'backup-failed': '無法備份舊存檔，為保護進度，這次只在記憶體中遊玩。',
};
function persist() {
  const r = saveProfile(store, profile, writable);
  if (warnedSave) return;
  if (!r.ok && r.reason !== 'readonly') { warnedSave = true; ui.toast(`進度無法存入瀏覽器（${r.reason}），關閉頁面後會遺失。`, 6000); }
  else if (r.ok && r.memory) { warnedSave = true; ui.toast('瀏覽器不允許存檔（例如無痕模式），進度只保留到關閉頁面為止。', 6000); }
}

// ---------- 介面動作 ----------
const refreshGear = (uid) => ui.gear(profile, uid);
// 商城：抽獎與購買用獨立亂數（不影響關卡的 seed）；busy 期間忽略重複點擊，避免連點買兩次
const shopRand = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);
let shopBusy = false;
const refreshShop = () => ui.shop(profile, Date.now());
const CUR = { stardust: '星砂', tickets: '祈燈券', oil: '燈油' };
const ui = createUI({
  openChapters: () => ui.chapters(profile),
  openTalents: () => ui.talents(profile),
  openGear: () => ui.gear(profile),
  openShop: () => refreshShop(),
  claimDaily: () => { if (claimDaily(profile, Date.now()).ok) { persist(); ui.toast('已領取今日補給'); } refreshShop(); },
  gachaAsk: (d) => {
    const n = Number(d.n), pay = gachaPay(profile, n);
    if (!pay) return;
    ui.shopModal({ type: 'confirm', title: `模擬抽獎 ×${n}`, lines: [`使用 ${gachaCost(n)[pay]} ${CUR[pay]}（遊戲內貨幣）抽 ${n} 次。`, '這是模擬交易，不會產生任何費用。'], act: 'gachaGo', data: { n }, ok: '確認（模擬）' });
  },
  gachaGo: (d) => {
    if (shopBusy) return;
    const n = Number(d.n), pay = gachaPay(profile, n);
    const r = pay && drawGacha(profile, shopRand, n, pay);
    if (!r?.ok) { ui.shopModal(null); return; }
    persist(); refreshShop(); ui.shopModal({ type: 'gacha', results: r.results });
  },
  buyAsk: (d) => {
    const it = shopItem(d.id), chk = canBuy(profile, d.id);
    if (!it || !chk.ok) return;
    const lines = it.kind === 'sim'
      ? [`「${it.name}」：${it.desc}`, `標示「模擬 ${it.simPoints} 點」為虛構單位。`, '這是模擬交易，不會扣款，也不需要填寫任何資料。']
      : [`「${it.name}」：${it.desc}`, `花費 ${Object.entries(it.price).map(([k, v]) => `${v} ${CUR[k]}`).join('＋')}（遊戲內貨幣）。`];
    ui.shopModal({ type: 'confirm', title: it.kind === 'sim' ? '確認模擬購買？' : '確認購買？', lines, act: 'buyGo', data: { id: it.id }, ok: it.kind === 'sim' ? '確認（模擬）' : '購買' });
  },
  buyGo: (d) => {
    if (shopBusy) return;
    const it = shopItem(d.id);
    if (!it) return;
    const finish = () => {
      const r = buyItem(profile, it.id, shopRand, Date.now());
      shopBusy = false;
      if (!r.ok) { ui.shopModal(null); refreshShop(); return; }
      persist(); refreshShop();
      ui.shopModal({ type: 'done', lines: [`獲得：${it.desc}`], gear: r.gear });
    };
    if (it.kind === 'sim') { shopBusy = true; ui.shopModal({ type: 'processing' }); setTimeout(finish, 900); } // 模擬流程的「處理中」畫面
    else finish();
  },
  shopClose: () => { if (!shopBusy) ui.shopModal(null); },
  shopHistory: () => ui.shopModal({ type: 'history', entries: profile.shop.history }),
  menu: () => toMenu(),
  startChapter: (d) => { const id = Number(d.id); if (chapterUnlocked(profile, id)) newRun(id); },
  retry: () => newRun(chapterId),
  buyTalent: (d) => { if (buyTalent(profile, d.id).ok) persist(); ui.talents(profile); },
  gearOpen: (d) => refreshGear(Number(d.uid)),
  gearClose: () => refreshGear(null),
  gearEquip: (d) => { equip(profile, Number(d.uid)); persist(); refreshGear(Number(d.uid)); },
  gearUnequip: (d) => { const it = profile.gear.items.find((i) => i.uid === Number(d.uid)); if (it) unequip(profile, it.slot); persist(); refreshGear(Number(d.uid)); },
  gearUpgrade: (d) => { if (upgradeGear(profile, Number(d.uid)).ok) persist(); refreshGear(Number(d.uid)); },
  gearSalvage: (d) => {
    const it = profile.gear.items.find((i) => i.uid === Number(d.uid));
    if (!it || (it.rarity >= 2 && !confirm(`確定分解「${gearName(it)}」？`))) return;
    salvage(profile, it.uid); persist(); refreshGear(null);
  },
  resetSave: () => {
    if (!confirm('清除所有進度（燈油、天賦、裝備、通關紀錄）？\n舊進度會另外備份一份在瀏覽器裡。')) return;
    store.set(`${SAVE_KEY}.before-reset`, JSON.stringify(profile));
    profile = defaultProfile(); persist(); ui.menu(profile, canClaimDaily(profile, Date.now()));
  },
  choose: (d) => { sim.choose(Number(d.i)); input.reset(); shown = null; sync(); }, // 連續升級時 phase 仍是 choice，要強制重畫
  chestClose: () => { sim.closeChest(); input.reset(); sync(); },
  resume: () => { paused = false; input.reset(); sync(); },
  quit: () => { if (mode !== 'run') return; sim.state.phase = 'lose'; sim.state.quit = true; paused = false; sync(); },
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
  if (mode !== 'menu' || !sim) {
    mode = 'menu'; paused = false;
    sim = createSim({ seed: 7, vh: H / scale });
    sim.state.god = true;
    renderer = createRenderer(CHAPTER1);
  }
  shown = null; ui.menu(profile, canClaimDaily(profile, Date.now()));
}
function newRun(id) {
  chapterId = id;
  const chapter = CHAPTERS.find((c) => c.id === id);
  mode = 'run'; paused = false; settled = null;
  runSeed = (Math.random() * 2 ** 31) | 0;
  sim = createSim({ seed: runSeed, vh: H / scale, chapter, meta: profileMods(profile) });
  renderer = createRenderer(chapter);
  input.reset(); shown = null; sync();
}

// 一局結束只結算一次：燈油入帳、掉裝備、存檔
function settle() {
  if (settled) return settled;
  const s = sim.state;
  settled = settleRun(profile, { ledger: s.ledger, chapterId, won: s.phase === 'win', t: s.t, kills: s.kills }, makeRng(runSeed ^ 0x9e3779b9));
  persist();
  return settled;
}

// 依 sim 狀態決定要顯示哪個面板（只在狀態改變時重畫 DOM）
function sync() {
  if (mode === 'menu') return;
  const s = sim.state;
  const want = paused ? 'pause' : s.phase;
  if (want === shown) return;
  shown = want;
  if (want === 'choice') ui.levelUp(s.choice);
  else if (want === 'chest') ui.chest(s.chest);
  else if (want === 'pause') ui.pause(s);
  else if (want === 'win' || want === 'lose') { const sum = settle(); setTimeout(() => ui.result(s, sum, profile), want === 'lose' && !s.quit ? 700 : 0); }
  else if (want === 'play') ui.hud();
}

function demoStep(dt) {
  const s = sim.state;
  if (s.phase === 'choice') sim.choose(0);
  if (s.phase === 'chest') sim.closeChest();
  if (s.t > 150) { sim = createSim({ seed: 7, vh: H / scale }); sim.state.god = true; } // 展示局定期重來，避免怪太多
  const a = s.t * 0.35;
  sim.update(dt, { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 });
}

const fps = { frames: 0, acc: 0, value: 0, worst: 0, cur: 0 };
let last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(raw, 1 / 30); // 分頁切回來時不要一次跳太多
  const t0 = performance.now();
  if (perf) { perfFrame(now, dt); requestAnimationFrame(frame); return; }
  if (mode === 'menu') demoStep(dt);
  else if (!paused) { sim.update(dt, input.move); sync(); }
  renderer.render(g, sim.state, paused || sim.state.phase !== 'play' ? 0 : dt, W, H, scale, safeTop, mode === 'run');
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

// 效能量測模式：自動跑、自動選升級；需要快轉時整段只跑邏輯不畫
function perfFrame(now, dt) {
  const s = sim.state;
  const auto = () => { if (s.phase === 'choice') sim.choose(0); if (s.phase === 'chest') sim.closeChest(); };
  if (perf.needsSkip(s)) { for (let i = 0; i < (perf.sync ? 3000 : 600) && s.t < perf.skipTo(perf.stage); i++) { auto(); sim.update(1 / 60, perf.move(s)); s.events.length = 0; } }
  for (let k = 0; k < (perf.sync && !perf.done && !perf.needsSkip(s) ? 30 : 1); k++) {
    auto();
    const step = perf.sync ? 1 / 60 : dt;
    const t0 = performance.now(); sim.update(step, perf.move(s)); const t1 = performance.now();
    renderer.render(g, s, step, W, H, scale, safeTop, true, perf.done ? null : perf.prof);
    if (perf.sync) g.getImageData(0, 0, 1, 1); // 逼 GPU 把這一幀做完，計時才包含真正的繪製
    const t2 = performance.now();
    perf.record(now, t1 - t0, t2 - t1, s);
  }
  const box = document.getElementById('perfBox');
  box.style.display = 'block';
  box.textContent = perf.done ? perf.report.text : `效能量測中…（${perf.stage + 1}/2）第 ${Math.floor(s.t)} 秒`;
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

if (perf) { // 量測模式不動存檔：用空白進度、無敵、固定 seed
  mode = 'run'; sim = createSim({ seed: 12345, vh: H / scale, chapter: perf.chapter }); sim.state.god = true;
  renderer = createRenderer(perf.chapter); ui.hud(); document.getElementById('pauseBtn').style.display = 'none';
} else toMenu();
if (!perf && LOAD_NOTICE[loaded.status]) ui.toast(LOAD_NOTICE[loaded.status], 6000);
// 升級或修復成功就立刻寫回：否則在玩家做任何動作前，每次開遊戲都會重新升級、重跳提示
if (!perf && loaded.writable && ['migrated', 'repaired', 'corrupt'].includes(loaded.status)) persist();
requestAnimationFrame(frame);
