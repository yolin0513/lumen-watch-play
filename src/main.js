// 進入點：畫布尺寸、主迴圈、畫面狀態切換（主選單／章節／天賦／裝備／遊戲中／暫停／結算）、存檔。
// 網址參數：?debug 顯示 FPS／實體數。
import { createInput } from './input.js';
import { createSim, makeRng, VW } from './sim.js';
import { createRenderer } from './render.js';
import { createUI, gearName, autoSalvageText } from './ui.js';
import { CHAPTERS, CHAPTER1, WEAPON_GACHA } from './content.js';
import { createStore, loadProfile, saveProfile, defaultProfile, SAVE_KEY } from './save.js';
import { profileMods, startBonusOf, ascendGear, ascendWeapon, settleRun, buyTalent, equip, unequip, upgradeGear, salvage, salvageMany, claimPending, gearSpace, setAutoSalvage, autoSalvageLevel, chapterUnlocked, startWeaponOf, equipWeapon, unequipWeapon } from './meta.js';
import { createPerf } from './perf.js';
import { createClock, SPEEDS } from './clock.js';
import { drawGacha, drawWeaponGacha, gachaPay, gachaCost, buyItem, canBuy, claimDaily, canClaimDaily, shopItem } from './shop.js';

const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const input = createInput(canvas);
// 量測用：頁面若先定義 window.LUMEN_PARAMS（本機單檔版以 data: 網址開啟時沒有 query string），就用它；正式網頁不會定義
const params = new URLSearchParams(window.LUMEN_PARAMS ?? location.search);
const DEBUG = params.has('debug');
const perf = params.has('perf') ? createPerf(Number(params.get('perf')) || 1, params.has('sync'), (params.get('off') || '').split(',').filter(Boolean), params.get('waves') !== 'off') : null; // 效能量測模式，見 perf.js

let W = 0, H = 0, scale = 1, safeTop = 0;
const clock = createClock(); // 固定步長時鐘：倍速只改每幀跑幾步，不改步長
let sim = null, mode = 'menu', paused = false, shown = null; // mode: menu 主選單類畫面（背景跑展示局）/ run 正式一局
let renderer = null, runSeed = 0, chapterId = 1, settled = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, Number(params.get('dpr')) || 2);
  let r = canvas.getBoundingClientRect();
  // 量測用：&size=375x812——頁面沒有版面大小時（隱藏的瀏覽器面板裡開的本機單檔版）用指定的 CSS 尺寸；正式遊玩不會帶這個參數
  if (!r.width && params.get('size')) { const [sw, sh] = params.get('size').split('x').map(Number); r = { width: sw, height: sh }; }
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
// 裝備畫面的狀態：打開的詳細頁、批量分解的勾選、目前的底部面板、剛成功的動作（給按鈕回饋用）
let gearView = { open: null, sel: null, sheet: null, fx: null };
const refreshGear = (patch = {}) => { gearView = { ...gearView, fx: null, ...patch }; ui.gear(profile, gearView); };
const allGear = () => [...profile.gear.items, ...profile.gear.pending];
// 商城：抽獎與購買用獨立亂數（不影響關卡的 seed）
const shopRand = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);
const refreshShop = (fx = null) => ui.shop(profile, Date.now(), fx);
const CUR = { stardust: '星砂', tickets: '祈燈券', oil: '燈油' };
// 手機的返回手勢／返回鍵：進子頁面時推一筆瀏覽紀錄，按返回就回主選單，而不是直接離開遊戲
let subPushed = false;
function enterSub() { if (subPushed) return; try { history.pushState({ sub: 1 }, ''); subPushed = true; } catch { /* 沒有 history（測試環境）就算了 */ } }
addEventListener('popstate', () => { subPushed = false; if (mode === 'menu' && ['chapters', 'talents', 'gear', 'shop'].some((id) => document.getElementById(id)?.classList.contains('show'))) toMenu(); });
// 抽之前就把空間講清楚：背包放不下的去暫存區（不分解）；自動分解是玩家自己開的才會發生
function spaceLines(n) {
  const sp = gearSpace(profile), auto = autoSalvageLevel(profile), out = [];
  if (sp.bag >= n) out.push(`背包剩 ${sp.bag} 格，放得下。`);
  else out.push({ warn: true, text: `背包只剩 ${sp.bag} 格：多出來的最多 ${n - sp.bag} 件會先放進「暫存區」，不會被分解。之後到「裝備」畫面收進背包或分解。` });
  if (auto >= 0) out.push({ warn: true, text: `你開了自動分解（${autoSalvageText(auto)}）：抽到這些稀有度會直接變成燈油。史詩與傳說不會被自動分解。` });
  return out;
}
const ui = createUI({
  openChapters: () => { enterSub(); ui.chapters(profile); },
  openTalents: () => { enterSub(); ui.talents(profile); },
  openGear: () => { enterSub(); gearView = { open: null, sel: null, sheet: null, fx: null }; ui.gear(profile, gearView); },
  openShop: () => { enterSub(); refreshShop(); },
  claimDaily: () => { const ok = claimDaily(profile, Date.now()).ok; if (ok) { persist(); ui.toast('已領取今日補給'); } refreshShop(ok ? 'daily' : null); },
  gachaAsk: (d) => {
    const n = Number(d.n), pay = gachaPay(profile, n);
    if (!pay) return;
    if (gearSpace(profile).total < n) { ui.toast('背包與暫存區都不夠放，先到「裝備」畫面整理。'); return; }
    ui.shopModal({ type: 'confirm', title: n === 1 ? '祈燈 ×1' : '十連祈燈', lines: [`使用 ${gachaCost(n)[pay]} ${CUR[pay]}抽 ${n} 次。`, ...spaceLines(n)], act: 'gachaGo', data: { n }, ok: '祈燈' });
  },
  gachaGo: (d) => {
    const n = Number(d.n), pay = gachaPay(profile, n);
    const r = pay && drawGacha(profile, shopRand, n, pay);
    if (!r?.ok) { ui.shopModal(null); if (r?.reason === 'space') ui.toast('背包與暫存區都不夠放，先到「裝備」畫面整理。'); return; }
    persist(); refreshShop(); ui.shopModal({ type: 'gacha', results: r.results, skip: profile.settings.skipAnim });
  },
  wgachaAsk: (d) => {
    const n = Number(d.n), pay = gachaPay(profile, n, WEAPON_GACHA);
    if (!pay) return;
    ui.shopModal({ type: 'confirm', title: n === 1 ? '武器祈燈 ×1' : '十連武器祈燈', lines: [`使用 ${gachaCost(n, WEAPON_GACHA)[pay]} ${CUR[pay]}抽 ${n} 次。`], act: 'wgachaGo', data: { n }, ok: '祈燈' });
  },
  wgachaGo: (d) => {
    const n = Number(d.n), pay = gachaPay(profile, n, WEAPON_GACHA);
    const r = pay && drawWeaponGacha(profile, shopRand, n, pay);
    if (!r?.ok) { ui.shopModal(null); return; }
    persist(); refreshShop(); ui.shopModal({ type: 'wgacha', results: r.results, skip: profile.settings.skipAnim });
  },
  revealSkip: () => ui.revealDone(),
  toggleSkipAnim: () => { profile.settings.skipAnim = !profile.settings.skipAnim; persist(); refreshShop(); },
  gotoGear: () => { ui.shopModal(null); gearView = { open: null, sel: null, sheet: null, fx: null }; ui.gear(profile, gearView); },
  weaponEquip: (d) => { const ok = equipWeapon(profile, d.id).ok; if (ok) persist(); refreshGear({ open: null, fx: ok ? { kind: 'weapon' } : null }); },
  weaponUnequip: () => { unequipWeapon(profile); persist(); refreshGear({ open: null, fx: { kind: 'weapon' } }); },
  buyAsk: (d) => {
    const it = shopItem(d.id), chk = canBuy(profile, d.id);
    if (!it || it.free || !chk.ok) return;
    const lines = [`「${it.name}」：${it.desc}`, `花費 ${Object.entries(it.price).map(([k, v]) => `${v} ${CUR[k]}`).join('＋')}。`];
    if (it.gives.gear !== undefined) lines.push(...spaceLines(1));
    ui.shopModal({ type: 'confirm', title: '確認購買？', lines, act: 'buyGo', data: { id: it.id }, ok: '購買' });
  },
  buyGo: (d) => {
    const it = shopItem(d.id);
    if (!it) return;
    const r = buyItem(profile, it.id, shopRand, Date.now());
    if (!r.ok) { ui.shopModal(null); refreshShop(); return; }
    persist(); refreshShop(it.id);
    ui.shopModal({ type: 'done', lines: [`獲得：${it.desc}`], gear: r.gear });
  },
  claimFree: (d) => { // 星砂補給：免費，直接入帳，不經過確認框（不做成結帳流程）
    const it = shopItem(d.id);
    if (!it?.free || !buyItem(profile, it.id, shopRand, Date.now()).ok) return;
    persist(); refreshShop(it.id); ui.toast(`已領取：${it.desc}`);
  },
  shopClose: () => ui.shopModal(null),
  shopHistory: () => ui.shopModal({ type: 'history', entries: profile.shop.history }),
  menu: () => { if (subPushed) { subPushed = false; try { history.back(); } catch { /* 無 */ } } toMenu(); },
  startChapter: (d) => {
    const id = Number(d.id);
    if (!chapterUnlocked(profile, id)) return;
    // 一局最多掉 3 件；背包與暫存區都放不下時，放不下的只能分解——先問玩家，不在他不知情時發生
    const sp = gearSpace(profile);
    if (sp.total < 3 && !confirm(`背包和暫存區只剩 ${sp.total} 格。\n這局掉落的裝備放不下時，會直接分解成燈油（包括稀有度高的）。\n\n仍要出發嗎？（取消後可以先到「裝備」畫面整理）`)) return;
    newRun(id);
  },
  retry: () => newRun(chapterId),
  buyTalent: (d) => { const ok = buyTalent(profile, d.id).ok; if (ok) persist(); ui.talents(profile, ok ? d.id : null); },
  gearOpen: (d) => refreshGear({ open: Number(d.uid), sheet: null }),
  gearClose: () => refreshGear({ open: null, sheet: null }),
  gearEquip: (d) => { const uid = Number(d.uid); equip(profile, uid); persist(); refreshGear({ open: uid, fx: { uid, kind: 'equip' } }); },
  gearUnequip: (d) => { const uid = Number(d.uid), it = profile.gear.items.find((i) => i.uid === uid); if (it) unequip(profile, it.slot); persist(); refreshGear({ open: uid }); },
  gearUpgrade: (d) => { const uid = Number(d.uid), ok = upgradeGear(profile, uid).ok; if (ok) persist(); refreshGear({ open: uid, fx: ok ? { uid, kind: 'up' } : null }); },
  gearSalvage: (d) => {
    const it = allGear().find((i) => i.uid === Number(d.uid));
    if (!it || (it.rarity >= 2 && !confirm(`確定分解「${gearName(it)}」？`))) return;
    salvage(profile, it.uid); persist(); refreshGear({ open: null });
  },
  // 暫存區
  pendingClaim: (d) => { const uid = Number(d.uid); if (claimPending(profile, uid).ok) { persist(); refreshGear({ open: null, fx: { uid, kind: 'claim' } }); } },
  pendingClaimAll: () => { let n = 0; for (const it of [...profile.gear.pending].sort((a, b) => b.rarity - a.rarity)) if (claimPending(profile, it.uid).ok) n++; if (n) persist(); refreshGear({ open: null }); if (n) ui.toast(`收進背包 ${n} 件`); },
  // 自動分解門檻（預設關閉；要玩家自己打開）
  autoSalvOpen: () => refreshGear({ open: null, sheet: 'auto' }),
  autoSalvSet: (d) => { if (setAutoSalvage(profile, Number(d.r)).ok) persist(); refreshGear({ sheet: null, fx: { kind: 'auto' } }); },
  // 批量分解：勾選 → 確認（列出各稀有度件數與燈油）→ 分解；已裝備的不能勾，也會被 salvageMany 擋下
  gearBatch: () => refreshGear({ open: null, sheet: null, sel: new Set() }),
  gearBatchCancel: () => refreshGear({ sel: null, sheet: null }),
  gearPick: (d) => { const s = new Set(gearView.sel), uid = Number(d.uid); if (s.has(uid)) s.delete(uid); else s.add(uid); refreshGear({ sel: s }); },
  gearPickTier: (d) => {
    const r = Number(d.r), eq = profile.gear.equipped;
    refreshGear({ sel: new Set(r < 0 ? [] : allGear().filter((it) => it.rarity <= r && eq[it.slot] !== it.uid).map((it) => it.uid)) });
  },
  gearBatchAsk: () => { if (gearView.sel?.size) refreshGear({ sheet: 'batch' }); },
  gearBatchBack: () => refreshGear({ sheet: null }),
  // 進階：裝備突破、專屬武器進階
  gearAscend: (d) => { const uid = Number(d.uid), r = ascendGear(profile, uid); if (r.ok) { persist(); ui.toast(`突破到 ★${r.star}，解鎖新能力`); } refreshGear({ open: uid, fx: r.ok ? { uid, kind: 'star' } : null }); },
  wstarOpen: (d) => refreshGear({ open: null, sheet: 'wstar', wid: d.id }),
  wstarGo: (d) => { const r = ascendWeapon(profile, d.id); if (r.ok) { persist(); ui.toast(`${d.id && r.star ? `進階到 ★${r.star}` : ''}`); } refreshGear({ sheet: 'wstar', wid: d.id, fx: r.ok ? { kind: 'wstar', id: d.id } : null }); },
  gearBatchGo: () => {
    const r = salvageMany(profile, [...(gearView.sel || [])]);
    persist(); refreshGear({ sel: null, sheet: null });
    ui.toast(`分解 ${r.count} 件，燈油 +${r.oil.toLocaleString('zh-Hant')}、結晶 +${r.crystals}${r.skipped.length ? `（${r.skipped.length} 件裝備中，已略過）` : ''}`);
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
// 倍速鍵：1 → 1.5 → 2 → 1 循環，記在存檔設定裡
const speed = () => (SPEEDS.includes(profile.settings?.speed) ? profile.settings.speed : 1);
const speedBtn = document.getElementById('speedBtn');
const showSpeed = () => { speedBtn.textContent = `${speed()}×`; speedBtn.classList.toggle('fast', speed() > 1); };
speedBtn.addEventListener('click', () => { profile.settings.speed = SPEEDS[(SPEEDS.indexOf(speed()) + 1) % SPEEDS.length]; persist(); showSpeed(); });
showSpeed();
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
  shown = null; ui.shopModal(null); ui.menu(profile, canClaimDaily(profile, Date.now()));
}
function newRun(id) {
  clock.reset();
  chapterId = id;
  const chapter = CHAPTERS.find((c) => c.id === id);
  mode = 'run'; paused = false; settled = null;
  runSeed = (Math.random() * 2 ** 31) | 0;
  sim = createSim({ seed: runSeed, vh: H / scale, chapter, meta: profileMods(profile), startWeapon: startWeaponOf(profile), startBonus: startBonusOf(profile) }); // 只有「已裝備」的專屬武器（和它的進階）會生效
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
  else if (!paused && sim.state.phase === 'play') {
    // 固定步長：每步永遠 1/60 秒，倍速＝這一幀多跑幾步（見 clock.js）。掉幀時一樣靠多跑幾步補回，最多 MAX_STEPS 步。
    const { steps, dt: sdt } = clock.advance(raw, speed());
    for (let i = 0; i < steps && sim.state.phase === 'play'; i++) sim.update(sdt, input.move);
    sync();
  } else { clock.reset(); if (!paused) sync(); } // 選卡／燈核／暫停時不累積時間，回來不會一口氣補一大段
  renderer.render(g, sim.state, paused || sim.state.phase !== 'play' ? 0 : dt * (mode === 'run' ? speed() : 1), W, H, scale, safeTop, mode === 'run');
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

// 逼 GPU 做完主畫布的繪製：把主畫布縮畫到 1×1 小畫布再讀回。
// 不能直接對主畫布 getImageData——Chrome 會把常被讀回的畫布降級成 CPU 繪圖，量到的就不是實際情況（先前踩過）。
let flushCtx = null;
function flushGPU() {
  flushCtx ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  flushCtx.drawImage(canvas, 0, 0, 1, 1); flushCtx.getImageData(0, 0, 1, 1);
}

// 畫面亮度：把主畫布縮畫到 90 寬的小畫布再讀回（不直接讀主畫布，理由同 flushGPU），回傳「過亮」的像素比例。
// 「過亮」＝亮度（luma）≥ 220：白、淡金、淡黃都算（加法疊加飽和後就是這些顏色）。M8 擁有者回報特效把畫面變成一團白光，這是瀏覽器裡量它的尺（Node 裡的近似量測見 tools/glow-check.mjs）。
let whiteCtx = null;
function measureWhite() {
  const w = 90, h = Math.max(1, Math.round(90 * H / W));
  whiteCtx ??= Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  whiteCtx.canvas.height = h; whiteCtx.clearRect(0, 0, w, h); whiteCtx.drawImage(canvas, 0, 0, w, h);
  const d = whiteCtx.getImageData(0, 0, w, h).data; let n = 0, sum = 0;
  for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += y; if (y >= 220) n++; }
  measureWhite.mean = sum / (w * h); // 平均亮度（0～255）：抓「整片灰白霧」這種不到全白、但整體被洗亮的情況
  return n / (w * h);
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
    if (perf.sync) flushGPU(); // 逼 GPU 把這一幀做完，計時才包含真正的繪製
    const t2 = performance.now();
    perf.record(now, t1 - t0, t2 - t1, s, perf.frameNo() % 6 === 0 ? measureWhite() : null); // 亮度取樣（不計入繪製時間）
  }
  const box = document.getElementById('perfBox');
  box.style.display = 'block';
  box.textContent = perf.done ? perf.report.text : `效能量測中…（${perf.stage + 1}/${perf.stageCount}）第 ${Math.floor(s.t)} 秒`;
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

// 同步量測入口：頁面被判定為隱藏時 rAF 會完全停止，改由外部直接呼叫 window.__perfRun() 一次跑完整段量測
// budget：這次最多跑幾毫秒（沒跑完就回傳進度，再呼叫一次接著跑）
// 同步量測模式才有：讓量測腳本能擺出指定場面、畫一幀、量亮度（正式遊玩不會有這個入口）
if (perf?.sync) window.__perfDebug = { get sim() { return sim; }, frame(n = 1) { for (let i = 0; i < n; i++) { sim.update(1 / 60, { x: 0, y: 0 }); renderer.render(g, sim.state, 1 / 60, W, H, scale, safeTop, true, null); } flushGPU(); return measureWhite(); } };
if (perf?.sync) window.__perfRun = (budget = 20000) => {
  const end = performance.now() + budget;
  while (!perf.done && performance.now() < end) perfFrame(performance.now(), 1 / 60);
  return perf.done ? perf.report.text : document.getElementById('perfBox').textContent;
};
if (perf) { // 量測模式不動存檔：用空白進度、無敵、固定 seed
  mode = 'run'; sim = createSim({ seed: 12345, vh: H / scale, chapter: perf.chapter }); sim.state.god = true; sim.state.surgeOn = perf.waves;
  // &evo=aura,orbit,pulse,wisps：量「後期滿配」的畫面——指定的武器全部滿級並共鳴、四個被動滿級（特效最多的情況）
  if (params.get('evo')) {
    const p = sim.state.player; p.weapons = [];
    for (const id of params.get('evo').split(',')) { const w = sim.addWeapon(id); w.lv = 5; w.evo = true; }
    for (const id of ['lens', 'wick', 'stone', 'ember']) p.passives[id] = 5;
    sim.recalc(); p.hp = p.maxHp;
  }
  renderer = createRenderer(perf.chapter); ui.hud(); document.getElementById('pauseBtn').style.display = 'none';
} else toMenu();
if (!perf && LOAD_NOTICE[loaded.status]) ui.toast(LOAD_NOTICE[loaded.status], 6000);
// 升級或修復成功就立刻寫回：否則在玩家做任何動作前，每次開遊戲都會重新升級、重跳提示
if (!perf && loaded.writable && ['migrated', 'repaired', 'corrupt'].includes(loaded.status)) persist();
requestAnimationFrame(frame);
