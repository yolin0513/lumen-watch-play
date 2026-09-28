// 局外養成：天賦、裝備、燈油結算。純邏輯，存檔物件（profile）由呼叫端傳入並就地修改。
// 數值全部在 content.js；疊加規則全部在 stats.js。
import { TALENTS, GEAR_SLOTS, RARITIES, GEAR_AFFIXES, GEAR_MAX_LV, gearUpgradeCost, CHAPTERS, ENEMIES, OIL, WEAPONS, START_WEAPON, AUTO_SALVAGE_MAX, CRYSTALS, GEAR_ASCEND, WEAPON_ASCEND, RESONANCES } from './content.js';
import { aggregate } from './stats.js';
import { MAX_ITEMS, PENDING_MAX } from './save.js';

// ---- 加成：天賦＋已裝備的裝備 → modifier 陣列（交給 createSim 的 meta） ----
export function talentMods(profile) {
  const out = [];
  for (const [id, lv] of Object.entries(profile.talents)) for (const m of TALENTS[id].mods) for (let i = 0; i < lv; i++) out.push(m);
  return out;
}
// 裝備主屬性：稀有度基礎值 × (1 + 0.1 × (強化等級 − 1))；副詞條不受強化影響
export function baseGearMods(item) {
  const main = GEAR_SLOTS[item.slot].main, k = 1 + 0.1 * (item.lv - 1);
  const m = { stat: main.stat };
  if (main.pct) m.pct = main.pct[item.rarity] * k; else m.flat = main.flat[item.rarity] * k;
  return [m, ...item.affixes.map((a) => ({ stat: a.stat, [a.type]: a.value }))];
}
// 突破能力：第 s 星解鎖 GEAR_ASCEND.perks[部位][s-1]，數值乘上稀有度的 scale。all＝true 時連還沒解鎖的也列出（給畫面顯示）
export function ascendPerks(item, all = false) {
  const k = GEAR_ASCEND.scale[item.rarity];
  return GEAR_ASCEND.perks[item.slot].slice(0, all ? GEAR_ASCEND.max : (item.star || 0))
    .map((m) => ({ stat: m.stat, ...(m.pct ? { pct: m.pct * k } : { flat: m.flat * k }) }));
}
export function gearMods(item) { return [...baseGearMods(item), ...ascendPerks(item)]; }
export function equippedItems(profile) {
  return Object.values(profile.gear.equipped).filter((u) => u != null).map((u) => profile.gear.items.find((i) => i.uid === u)).filter(Boolean);
}
// 專屬武器的進階加成：只有「已裝備而且確實擁有」的那把生效（擁有≠生效，和 startWeaponOf 同一條規則）
export function weaponStarMods(profile) {
  const id = startWeaponOf(profile);
  if (id === START_WEAPON) return [];
  const star = profile.weapons.stars?.[id] || 0;
  return WEAPON_ASCEND.perks.slice(0, star).filter((pk) => pk.mod).map((pk) => pk.mod);
}
export function profileMods(profile) { return [...talentMods(profile), ...equippedItems(profile).flatMap(gearMods), ...weaponStarMods(profile)]; }
// 開局加成（交給 createSim）：開局武器等級、開局帶的共鳴增幅
export function startBonusOf(profile) {
  const id = startWeaponOf(profile), out = { lv: 1, passive: null };
  if (id === START_WEAPON) return out;
  for (const pk of WEAPON_ASCEND.perks.slice(0, profile.weapons.stars?.[id] || 0)) {
    if (pk.startLv) out.lv = Math.max(out.lv, pk.startLv);
    if (pk.startPassive) out.passive = RESONANCES[id]?.needs ?? null;
  }
  return out;
}
export const oilBonus = (profile) => aggregate(profileMods(profile)).oil.pct;

// ---- 天賦 ----
export function talentCost(profile, id) { const lv = profile.talents[id] || 0; return TALENTS[id].cost[lv] ?? null; }
export function buyTalent(profile, id) {
  const cost = talentCost(profile, id);
  if (cost === null) return { ok: false, reason: 'max' };
  if (profile.oil < cost) return { ok: false, reason: 'oil' };
  profile.oil -= cost; profile.talents[id] = (profile.talents[id] || 0) + 1;
  return { ok: true, cost };
}

// ---- 裝備 ----
export function rollGear(profile, rand, weights, minRarity = 0) {
  let total = 0; weights.forEach((w, i) => { if (i >= minRarity) total += w; });
  let x = rand() * total, rarity = minRarity;
  for (let i = minRarity; i < weights.length; i++) { x -= weights[i]; if (x <= 0 && weights[i] > 0) { rarity = i; break; } }
  const slots = Object.keys(GEAR_SLOTS), slot = slots[Math.floor(rand() * slots.length)];
  const pool = GEAR_AFFIXES.filter(([stat]) => stat !== GEAR_SLOTS[slot].main.stat);
  const affixes = [];
  for (let i = 0; i < RARITIES[rarity].affixes && pool.length; i++) {
    const [stat, type, vals] = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    affixes.push({ stat, type, value: vals[rarity] });
  }
  return { uid: profile.nextUid++, slot, rarity, lv: 1, affixes };
}
export function equip(profile, uid) {
  const it = profile.gear.items.find((i) => i.uid === uid);
  if (!it) return { ok: false };
  profile.gear.equipped[it.slot] = uid;
  return { ok: true };
}
export function unequip(profile, slot) { profile.gear.equipped[slot] = null; return { ok: true }; }
export function upgradeGear(profile, uid) {
  const it = profile.gear.items.find((i) => i.uid === uid);
  if (!it) return { ok: false, reason: 'missing' };
  if (it.lv >= GEAR_MAX_LV) return { ok: false, reason: 'max' };
  const cost = gearUpgradeCost(it.rarity, it.lv);
  if (profile.oil < cost) return { ok: false, reason: 'oil' };
  profile.oil -= cost; it.lv++;
  return { ok: true, cost };
}
// ---- 裝備突破（強化滿級之後的路）：結晶＋燈油 → ★+1，解鎖下一項能力 ----
export function ascendCost(it) {
  const s = (it.star || 0) + 1;
  return s > GEAR_ASCEND.max ? null : { star: s, crystals: GEAR_ASCEND.crystal[it.rarity] * s, oil: GEAR_ASCEND.oil(it.rarity, s) };
}
export function ascendGear(profile, uid) {
  const it = profile.gear.items.find((i) => i.uid === uid);
  if (!it) return { ok: false, reason: 'missing' };
  if (it.lv < GEAR_MAX_LV) return { ok: false, reason: 'lv' };
  const c = ascendCost(it);
  if (!c) return { ok: false, reason: 'max' };
  if ((profile.crystals || 0) < c.crystals) return { ok: false, reason: 'crystals' };
  if (profile.oil < c.oil) return { ok: false, reason: 'oil' };
  profile.crystals -= c.crystals; profile.oil -= c.oil; it.star = c.star;
  return { ok: true, ...c };
}
export const salvageValue = (it) => Math.round(RARITIES[it.rarity].salvage * (1 + 0.25 * (it.lv - 1)));
export const crystalValue = (it) => CRYSTALS[it.rarity];
// 分解一件裝備的收入：全遊戲唯一一處（單件、批量、自動分解、放不下）。燈油＋結晶（進階材料）一起入帳。
function disposeGear(profile, it) {
  const oil = salvageValue(it), crystals = crystalValue(it);
  profile.oil += oil; profile.crystals = (profile.crystals || 0) + crystals;
  return { oil, crystals };
}
// 找一件裝備在哪裡：背包（items）或暫存區（pending）
function locate(profile, uid) {
  for (const list of [profile.gear.items, profile.gear.pending]) { const i = list.findIndex((x) => x.uid === uid); if (i >= 0) return { list, i, it: list[i] }; }
  return null;
}
// 單件分解：玩家在詳細頁親手按的，已裝備的也可以（先卸下）
export function salvage(profile, uid) {
  const at = locate(profile, uid);
  if (!at) return { ok: false };
  const it = at.it;
  if (profile.gear.equipped[it.slot] === uid) profile.gear.equipped[it.slot] = null;
  at.list.splice(at.i, 1);
  const got = disposeGear(profile, it);
  return { ok: true, ...got };
}
// 批量分解：已裝備的一律跳過（批量勾選很容易順手勾到，裝備中的不可以這樣被分解掉）
export function salvageMany(profile, uids) {
  let oil = 0, crystals = 0, count = 0; const skipped = [];
  for (const uid of new Set(uids)) {
    const at = locate(profile, uid);
    if (!at) continue;
    if (profile.gear.equipped[at.it.slot] === uid) { skipped.push(uid); continue; }
    at.list.splice(at.i, 1);
    const got = disposeGear(profile, at.it); oil += got.oil; crystals += got.crystals; count++;
  }
  return { ok: true, count, oil, crystals, skipped };
}
// 暫存區 → 背包（背包有空位才行）
export function claimPending(profile, uid) {
  const i = profile.gear.pending.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, reason: 'missing' };
  if (profile.gear.items.length >= MAX_ITEMS) return { ok: false, reason: 'full' };
  profile.gear.items.push(...profile.gear.pending.splice(i, 1));
  return { ok: true };
}

// ---- 新裝備的去處：全遊戲唯一一處。關卡掉落、裝備祈燈、禮包都走 storeGear ----
// 1. 玩家自己設了自動分解門檻、且這件在門檻以下 → 分解成燈油（'auto'）。門檻最高到 AUTO_SALVAGE_MAX，史詩與傳說永遠不會自動分解。
// 2. 背包有空位 → 進背包（'bag'）。
// 3. 背包滿 → 進暫存區（'pending'），不分解；玩家之後到裝備畫面收進背包或分解。
// 4. 暫存區也滿 → 分解（'overflow'）。祈燈與禮包在付款前就檢查空間，不會走到這步；關卡掉落只有在開局時警告過、玩家仍選擇出發才可能走到。
// 理由：M4 以前背包滿就直接分解，保底抽到的傳說在玩家不知情下變成燈油。高稀有度的東西不可以在玩家沒有做出選擇時消失。
export const autoSalvageLevel = (profile) => Math.min(profile.settings?.autoSalvage ?? -1, AUTO_SALVAGE_MAX);
export function gearSpace(profile) {
  const bag = Math.max(0, MAX_ITEMS - profile.gear.items.length), pending = Math.max(0, PENDING_MAX - profile.gear.pending.length);
  return { bag, pending, total: bag + pending };
}
export function storeGear(profile, it) {
  let where;
  if (it.rarity <= autoSalvageLevel(profile)) where = 'auto';
  else if (profile.gear.items.length < MAX_ITEMS) { profile.gear.items.push(it); return 'bag'; }
  else if (profile.gear.pending.length < PENDING_MAX) { profile.gear.pending.push(it); return 'pending'; }
  else where = 'overflow';
  const got = disposeGear(profile, it); it.salvaged = got.oil; it.crystals = got.crystals; // 分解的不是消失：換成燈油＋結晶
  return where;
}
export function setAutoSalvage(profile, level) {
  if (!Number.isInteger(level) || level < -1 || level > AUTO_SALVAGE_MAX) return { ok: false };
  profile.settings.autoSalvage = level; return { ok: true };
}

// ---- 燈油結算 ----
// 公式見 content.js 的 OIL 說明。lines 逐項列出，total 必須等於 floor(subtotal × (1 + bonusPct))。
export function computeOil(ledger, chapter, { won, firstClear }, bonusPct) {
  const lines = [];
  let killOil = 0, killCount = 0;
  for (const [kind, n] of Object.entries(ledger.kills)) { killOil += ENEMIES[kind].oil * n; killCount += n; }
  killOil = Math.floor(killOil * OIL.perKill);
  lines.push({ label: `擊倒 ${killCount}`, amount: killOil });
  if (ledger.elites) lines.push({ label: `精英 ×${ledger.elites}`, amount: ledger.elites * OIL.elite });
  if (won && ledger.boss) lines.push({ label: '擊敗燈塔守衛', amount: OIL.boss });
  if (won) lines.push({ label: '點亮燈塔', amount: chapter.reward.clear });
  if (won && firstClear) lines.push({ label: '首次通關', amount: chapter.reward.firstClear });
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const total = Math.floor(subtotal * (1 + bonusPct));
  if (total !== subtotal) lines.push({ label: `聚油加成 +${Math.round(bonusPct * 100)}%`, amount: total - subtotal });
  return { lines, subtotal, bonusPct, total };
}

// 一局結束：燈油入帳、掉裝備、記通關與最佳紀錄。回傳給結算畫面的摘要。
export function settleRun(profile, { ledger, chapterId, won, t, kills }, rand) {
  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  const firstClear = won && !profile.chapters.cleared.includes(chapterId);
  const oil = computeOil(ledger, chapter, { won, firstClear }, oilBonus(profile));
  profile.oil += oil.total;
  // 星砂：只有通關才給（首通另加），讓商城的星砂靠正常遊玩就拿得到
  const stardust = won ? chapter.reward.stardust + (firstClear ? chapter.reward.firstStardust : 0) : 0;
  profile.stardust += stardust;

  const drops = [];
  const n = won ? 2 : t >= 240 ? 1 : 0;
  for (let i = 0; i < n; i++) drops.push(rollGear(profile, rand, chapter.reward.gear));
  if (firstClear) drops.push(rollGear(profile, rand, chapter.reward.gear.map((w, i) => (i >= 2 ? Math.max(w, 1) : w)), 2));
  let autoSalvage = 0; // 分解成燈油的部分另列，不混進本局燈油（storeGear 已經入帳）
  for (const it of drops) { it.where = storeGear(profile, it); autoSalvage += it.salvaged || 0; }

  if (won && firstClear) profile.chapters.cleared = [...profile.chapters.cleared, chapterId].sort();
  const best = profile.chapters.best[chapterId];
  if (won && (!best || t < best.t)) profile.chapters.best[chapterId] = { t: Math.round(t), kills };
  profile.stats.runs++; profile.stats.kills += kills;
  return { oil, stardust, drops, autoSalvage, firstClear, won };
}

// ---- 專屬武器：擁有 ≠ 生效。只有「已裝備、而且確實擁有」的專屬武器會成為開局武器，其餘一律用預設起始武器 ----
export function startWeaponOf(profile) {
  const eq = profile.weapons?.equipped;
  return eq && profile.weapons.owned.includes(eq) && WEAPONS[eq]?.exclusive ? eq : START_WEAPON;
}
export function equipWeapon(profile, id) {
  if (!profile.weapons.owned.includes(id)) return { ok: false, reason: 'not-owned' };
  profile.weapons.equipped = id; return { ok: true };
}
export function unequipWeapon(profile) { profile.weapons.equipped = null; return { ok: true }; }
// ---- 專屬武器進階：星核 → ★+1（只有擁有的才能進階；生效與否看有沒有裝備）----
export function weaponAscendCost(profile, id) {
  const s = (profile.weapons.stars?.[id] || 0) + 1;
  return s > WEAPON_ASCEND.max ? null : { star: s, shards: WEAPON_ASCEND.shards[s - 1] };
}
export function ascendWeapon(profile, id) {
  if (!profile.weapons.owned.includes(id)) return { ok: false, reason: 'not-owned' };
  const c = weaponAscendCost(profile, id);
  if (!c) return { ok: false, reason: 'max' };
  if ((profile.weapons.shards[id] || 0) < c.shards) return { ok: false, reason: 'shards' };
  profile.weapons.shards[id] -= c.shards; profile.weapons.stars[id] = c.star;
  return { ok: true, ...c };
}

export const chapterUnlocked = (profile, id) => id === 1 || profile.chapters.cleared.includes(id - 1);
