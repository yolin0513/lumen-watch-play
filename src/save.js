// 存檔：讀、寫、升級、修復。不直接碰 localStorage——儲存體由 createStore 包起來注入，Node 測試可塞假的。
//
// 原則（tools/save-test.mjs 逐條驗證，並用突變證明測試會紅）：
// 1. localStorage 任何一步都可能 throw（隱私模式、被停用、空間滿）。讀寫都包 try/catch，失敗就改用記憶體存檔，遊戲照玩。
// 2. 看不懂的東西不覆蓋：壞檔（不是 JSON、被截斷）先備份到 <KEY>.corrupt 再用新檔；比本程式新的版本（future）只讀不寫。
// 3. 升級舊版存檔前，先把原文備份到 <KEY>.backup.v<舊版號>；備份寫不進去就不升級寫回（只在記憶體玩），
//    升級過程出錯也保留原檔不動。玩家的進度不能在一次改版中無聲消失。
// 4. 欄位缺了、型別不對、數值越界：逐欄修復成合法值並記下 notes，不因為一個欄位壞掉就整份丟掉。
import { TALENTS, GEAR_SLOTS, RARITIES, GEAR_AFFIXES, GEAR_MAX_LV, CHAPTERS, SHOP, GACHA } from './content.js';

export const SAVE_KEY = 'lumen.save';
export const SAVE_VERSION = 2;
export const MAX_HISTORY = 50;
export const MAX_ITEMS = 60;

export function defaultProfile() {
  return {
    v: SAVE_VERSION, oil: 0, talents: {}, nextUid: 1,
    gear: { items: [], equipped: { lamp: null, cloak: null, charm: null, boots: null } },
    chapters: { cleared: [], best: {} },
    stats: { runs: 0, kills: 0 },
    // v2（M3 商城）
    stardust: 0, tickets: 0,
    gacha: { pity: 0, total: 0 },          // pity：距離上次抽到最高稀有度的抽數（0 ~ GACHA.pity-1）
    shop: { bought: {}, history: [] },     // bought：各商品已買次數（限購用）；history：模擬交易紀錄
    daily: { last: null },                 // 上次領每日補給的本地日期 YYYY-MM-DD
  };
}

// ---- 儲存體：包住 localStorage 的每個動作；拿不到就退回記憶體 ----
export function createStore(getStorage) {
  let ls = null;
  try { ls = getStorage(); ls.getItem('__probe__'); } catch { ls = null; }
  const mem = new Map();
  const store = {
    persistent: !!ls,
    get(k) { if (!ls) return { ok: true, value: mem.has(k) ? mem.get(k) : null }; try { return { ok: true, value: ls.getItem(k) }; } catch (e) { return { ok: false, error: e?.name || 'Error' }; } },
    set(k, v) { if (!ls) { mem.set(k, v); return { ok: true, memory: true }; } try { ls.setItem(k, v); return { ok: true }; } catch (e) { mem.set(k, v); return { ok: false, error: e?.name || 'Error' }; } },
  };
  return store;
}

// ---- 版本升級：MIGRATIONS[n] 把 v=n 的資料升成 v=n+1 ----
// v0＝沒有版本號的存檔（本作沒有正式發行過 v0；這是給「缺版本號」的資料一條升級路，而不是直接丟棄）。
export const MIGRATIONS = {
  0: (d) => ({ ...defaultProfile(), oil: d.oil, talents: d.talents, v: 1 }),
  // v1 → v2：加入商城欄位（星砂、祈燈券、保底計數、購買紀錄、每日補給），原有進度原樣保留
  1: (d) => ({ ...d, stardust: 0, tickets: 0, gacha: { pity: 0, total: 0 }, shop: { bought: {}, history: [] }, daily: { last: null }, v: 2 }),
};

// 讀檔。回傳 { profile, status, notes, writable }
// status：new 沒存檔 / ok / repaired 有欄位被修 / migrated 升級成功 / corrupt 壞檔已備份 / future 比程式新（唯讀）
//         unavailable 儲存體讀不到 / migrate-failed 升級失敗（原檔保留、唯讀）/ backup-failed 升級前備份失敗（原檔保留、唯讀）
export function loadProfile(store) {
  const got = store.get(SAVE_KEY);
  if (!got.ok) return { profile: defaultProfile(), status: 'unavailable', notes: [`讀取失敗：${got.error}`], writable: false };
  if (got.value == null) return { profile: defaultProfile(), status: 'new', notes: [], writable: true };
  let data;
  try { data = JSON.parse(got.value); } catch { data = undefined; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    store.set(`${SAVE_KEY}.corrupt`, got.value);
    return { profile: defaultProfile(), status: 'corrupt', notes: ['存檔無法解析，已備份到 .corrupt 並重新開始'], writable: true };
  }
  let v = Number.isInteger(data.v) ? data.v : 0;
  if (v > SAVE_VERSION) {
    const r = sanitize(data);
    return { profile: r.profile, status: 'future', notes: [`存檔版本 v${v} 比遊戲新，這次只讀不寫`, ...r.notes], writable: false };
  }
  let status = 'ok';
  if (v < SAVE_VERSION) {
    const b = store.set(`${SAVE_KEY}.backup.v${v}`, got.value);
    if (!b.ok || b.memory) {
      const r = sanitize(tryMigrate(data, v) ?? {});
      return { profile: r.profile, status: 'backup-failed', notes: ['升級前無法備份舊存檔，為保護進度，這次只在記憶體中遊玩'], writable: false };
    }
    const migrated = tryMigrate(data, v);
    if (!migrated) return { profile: defaultProfile(), status: 'migrate-failed', notes: [`v${v} 存檔升級失敗，原檔保留在 .backup.v${v}`], writable: false };
    data = migrated; status = 'migrated';
  }
  const r = sanitize(data);
  if (r.notes.length && status === 'ok') status = 'repaired';
  return { profile: r.profile, status, notes: r.notes, writable: true };
}
function tryMigrate(data, from) {
  try {
    let d = data;
    for (let v = from; v < SAVE_VERSION; v++) { d = MIGRATIONS[v](d); if (!d || d.v !== v + 1) throw new Error(`migration ${v} 結果不對`); }
    return d;
  } catch { return null; }
}

export function saveProfile(store, profile, writable = true) {
  if (!writable) return { ok: false, reason: 'readonly' };
  let json;
  try { json = JSON.stringify(profile); } catch (e) { return { ok: false, reason: e?.name || 'Error' }; }
  const r = store.set(SAVE_KEY, json);
  return r.ok ? { ok: true, memory: !!r.memory } : { ok: false, reason: r.error };
}

// ---- 逐欄修復 ----
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const nonNegInt = (x) => Number.isFinite(x) && x >= 0 ? Math.floor(x) : null;
export function sanitize(d) {
  const notes = [], out = defaultProfile();
  const fix = (msg) => notes.push(msg);

  const oil = nonNegInt(d.oil);
  if (oil === null) { if (d.oil !== undefined) fix(`oil 不合法（${JSON.stringify(d.oil)}），歸零`); } else out.oil = oil;

  if (isObj(d.talents)) {
    for (const [id, lv] of Object.entries(d.talents)) {
      const def = TALENTS[id];
      if (!def) { fix(`未知天賦 ${id} 已移除`); continue; }
      const n = nonNegInt(lv);
      if (n === null) { fix(`天賦 ${id} 等級不合法，歸零`); continue; }
      if (n > def.cost.length) fix(`天賦 ${id} 等級 ${n} 超過上限，改為 ${def.cost.length}`);
      if (n > 0) out.talents[id] = Math.min(n, def.cost.length);
    }
  } else if (d.talents !== undefined) fix('talents 型別不對，重設');

  const uids = new Set();
  if (isObj(d.gear) && Array.isArray(d.gear.items)) {
    for (const it of d.gear.items) {
      const item = sanitizeItem(it);
      if (!item || uids.has(item.uid)) { fix('移除一件不合法或重複的裝備'); continue; }
      if (out.gear.items.length >= MAX_ITEMS) { fix('裝備超過上限，多的移除'); break; }
      uids.add(item.uid); out.gear.items.push(item);
    }
    if (isObj(d.gear.equipped)) {
      for (const slot of Object.keys(out.gear.equipped)) {
        const uid = d.gear.equipped[slot];
        if (uid == null) continue;
        const it = out.gear.items.find((i) => i.uid === uid);
        if (it && it.slot === slot) out.gear.equipped[slot] = uid; else fix(`${slot} 裝備參照不存在，卸下`);
      }
    }
  } else if (d.gear !== undefined) fix('gear 型別不對，重設');
  const maxUid = Math.max(0, ...uids);
  const nu = nonNegInt(d.nextUid);
  out.nextUid = Math.max(maxUid + 1, nu ?? 1);

  if (isObj(d.chapters)) {
    const valid = new Set(CHAPTERS.map((c) => c.id));
    if (Array.isArray(d.chapters.cleared)) out.chapters.cleared = [...new Set(d.chapters.cleared.filter((id) => valid.has(id)))].sort();
    if (isObj(d.chapters.best)) for (const [id, b] of Object.entries(d.chapters.best)) {
      if (valid.has(Number(id)) && isObj(b) && nonNegInt(b.t) !== null && nonNegInt(b.kills) !== null) out.chapters.best[id] = { t: b.t, kills: nonNegInt(b.kills) };
    }
  } else if (d.chapters !== undefined) fix('chapters 型別不對，重設');

  if (isObj(d.stats)) { out.stats.runs = nonNegInt(d.stats.runs) ?? 0; out.stats.kills = nonNegInt(d.stats.kills) ?? 0; }

  // ---- v2 商城欄位 ----
  for (const k of ['stardust', 'tickets']) {
    const n = nonNegInt(d[k]);
    if (n === null) { if (d[k] !== undefined) fix(`${k} 不合法（${JSON.stringify(d[k])}），歸零`); } else out[k] = n;
  }
  if (isObj(d.gacha)) {
    const pity = nonNegInt(d.gacha.pity);
    if (pity === null) { if (d.gacha.pity !== undefined) fix(`保底計數不合法（${JSON.stringify(d.gacha.pity)}），歸零`); }
    else if (pity > GACHA.pity - 1) { fix(`保底計數 ${pity} 超過上限，改為 ${GACHA.pity - 1}`); out.gacha.pity = GACHA.pity - 1; }
    else out.gacha.pity = pity;
    out.gacha.total = nonNegInt(d.gacha.total) ?? 0;
  } else if (d.gacha !== undefined) fix('gacha 型別不對，重設');
  if (isObj(d.shop)) {
    if (isObj(d.shop.bought)) for (const [id, n] of Object.entries(d.shop.bought)) {
      const item = SHOP.find((x) => x.id === id), c = nonNegInt(n);
      if (!item || c === null) { fix(`購買紀錄 ${id} 不合法，移除`); continue; }
      if (c > 0) out.shop.bought[id] = item.limit ? Math.min(c, item.limit) : c;
    }
    if (Array.isArray(d.shop.history)) out.shop.history = d.shop.history.filter((h) => isObj(h) && Number.isFinite(h.t) && SHOP.some((x) => x.id === h.id)).slice(-MAX_HISTORY).map((h) => ({ t: h.t, id: h.id }));
  } else if (d.shop !== undefined) fix('shop 型別不對，重設');
  if (isObj(d.daily) && typeof d.daily.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.daily.last)) out.daily.last = d.daily.last;
  else if (d.daily !== undefined && d.daily?.last != null) fix('每日補給日期不合法，重設');
  return { profile: out, notes };
}
const AFFIX_STATS = new Map(GEAR_AFFIXES.map(([stat, type]) => [stat, type]));
function sanitizeItem(it) {
  if (!isObj(it)) return null;
  const uid = nonNegInt(it.uid), rarity = nonNegInt(it.rarity), lv = nonNegInt(it.lv);
  if (!uid || !GEAR_SLOTS[it.slot] || rarity === null || rarity >= RARITIES.length || !lv) return null;
  const affixes = Array.isArray(it.affixes) ? it.affixes.filter((a) => isObj(a) && AFFIX_STATS.get(a.stat) === a.type && Number.isFinite(a.value)).slice(0, 4) : [];
  return { uid, slot: it.slot, rarity, lv: Math.min(lv, GEAR_MAX_LV), affixes };
}
