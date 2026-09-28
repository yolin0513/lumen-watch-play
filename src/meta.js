// 局外養成：天賦、裝備、燈油結算。純邏輯，存檔物件（profile）由呼叫端傳入並就地修改。
// 數值全部在 content.js；疊加規則全部在 stats.js。
import { TALENTS, GEAR_SLOTS, RARITIES, GEAR_AFFIXES, GEAR_MAX_LV, gearUpgradeCost, CHAPTERS, ENEMIES, OIL } from './content.js';
import { aggregate } from './stats.js';
import { MAX_ITEMS } from './save.js';

// ---- 加成：天賦＋已裝備的裝備 → modifier 陣列（交給 createSim 的 meta） ----
export function talentMods(profile) {
  const out = [];
  for (const [id, lv] of Object.entries(profile.talents)) for (const m of TALENTS[id].mods) for (let i = 0; i < lv; i++) out.push(m);
  return out;
}
// 裝備主屬性：稀有度基礎值 × (1 + 0.1 × (強化等級 − 1))；副詞條不受強化影響
export function gearMods(item) {
  const main = GEAR_SLOTS[item.slot].main, k = 1 + 0.1 * (item.lv - 1);
  const m = { stat: main.stat };
  if (main.pct) m.pct = main.pct[item.rarity] * k; else m.flat = main.flat[item.rarity] * k;
  return [m, ...item.affixes.map((a) => ({ stat: a.stat, [a.type]: a.value }))];
}
export function equippedItems(profile) {
  return Object.values(profile.gear.equipped).filter((u) => u != null).map((u) => profile.gear.items.find((i) => i.uid === u)).filter(Boolean);
}
export function profileMods(profile) { return [...talentMods(profile), ...equippedItems(profile).flatMap(gearMods)]; }
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
export const salvageValue = (it) => Math.round(RARITIES[it.rarity].salvage * (1 + 0.25 * (it.lv - 1)));
export function salvage(profile, uid) {
  const i = profile.gear.items.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false };
  const it = profile.gear.items[i];
  if (profile.gear.equipped[it.slot] === uid) profile.gear.equipped[it.slot] = null;
  profile.gear.items.splice(i, 1);
  const v = salvageValue(it); profile.oil += v;
  return { ok: true, oil: v };
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

  const drops = [];
  const n = won ? 2 : t >= 240 ? 1 : 0;
  for (let i = 0; i < n; i++) drops.push(rollGear(profile, rand, chapter.reward.gear));
  if (firstClear) drops.push(rollGear(profile, rand, chapter.reward.gear.map((w, i) => (i >= 2 ? Math.max(w, 1) : w)), 2));
  let autoSalvage = 0;
  for (const it of drops) {
    if (profile.gear.items.length < MAX_ITEMS) profile.gear.items.push(it);
    else { const v = salvageValue(it); autoSalvage += v; it.salvaged = v; }
  }
  profile.oil += autoSalvage;

  if (won && firstClear) profile.chapters.cleared = [...profile.chapters.cleared, chapterId].sort();
  const best = profile.chapters.best[chapterId];
  if (won && (!best || t < best.t)) profile.chapters.best[chapterId] = { t: Math.round(t), kills };
  profile.stats.runs++; profile.stats.kills += kills;
  return { oil, drops, autoSalvage, firstClear, won };
}

export const chapterUnlocked = (profile, id) => id === 1 || profile.chapters.cleared.includes(id - 1);
