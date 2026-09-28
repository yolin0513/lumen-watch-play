// 商城與祈燈（抽獎）：純邏輯。存檔物件（profile）由呼叫端傳入並就地修改；亂數與時間由呼叫端注入。
// 🔴 全部是模擬：不接任何付款、不收任何資料、不連外。「模擬購買」的項目只走流程，不扣任何東西。
// 機率只有一份來源：content.js 的 GACHA。抽獎（rollRarity）與商城畫面（gachaOdds → ui.js）都從它算；
// tools/shop-test.mjs 會把「畫面上的百分比」和「實際抽 N 次量到的分布」這兩個獨立來源拿來比對。
import { SHOP, GACHA, DAILY, RARITIES } from './content.js';
import { rollGear, salvageValue } from './meta.js';
import { MAX_ITEMS, MAX_HISTORY } from './save.js';

// ---- 機率（給畫面顯示）----
// base：單抽機率（照表）。composite：長期下每一抽的實際機率（含保底）。
// 保底推導：設最高稀有度單抽機率 p、保底抽數 N。距離上次最高稀有度的抽數在 N 抽內一定結束，
// 平均間隔 E = Σ_{k=0}^{N-1} (1-p)^k；每個間隔有 (1-p)^{N-1} 的機率是靠保底結束，
// 所以長期下「被保底強制」的抽數比例 f = (1-p)^{N-1} / E；其餘 (1-f) 的抽照表抽。
export function gachaOdds(table = GACHA) {
  const total = table.rates.reduce((a, b) => a + b, 0);
  const base = table.rates.map((r) => r / total);
  const top = base.length - 1, p = base[top], N = table.pity;
  let E = 0;
  for (let k = 0; k < N; k++) E += (1 - p) ** k;
  const forced = (1 - p) ** (N - 1) / E;
  const composite = base.map((b, i) => (1 - forced) * b + (i === top ? forced : 0));
  return { base, composite, pity: N, top, forced };
}
export const fmtPct = (x) => `${(x * 100).toFixed(2)}%`;

// ---- 抽一次的稀有度（保底在這裡）----
export function rollRarity(profile, rand, table = GACHA) {
  const rates = table.rates;
  const top = rates.length - 1, n = profile.gacha.pity + 1; // n：這是距離上次最高稀有度的第幾抽
  let rarity = top, pity = false;
  if (n >= table.pity) pity = true;
  else {
    const total = rates.reduce((a, b) => a + b, 0);
    let x = rand() * total;
    for (let i = 0; i < rates.length; i++) { x -= rates[i]; if (x < 0) { rarity = i; break; } }
  }
  profile.gacha.pity = rarity === top ? 0 : n;
  profile.gacha.total++;
  return { rarity, pity };
}

export function gachaCost(count) { return GACHA.cost[count === 10 ? 'ten' : 'single']; }
// 付款方式：祈燈券夠就用券，不夠用星砂；都不夠回 null
export function gachaPay(profile, count) {
  const c = gachaCost(count);
  if (profile.tickets >= c.tickets) return 'tickets';
  if (profile.stardust >= c.stardust) return 'stardust';
  return null;
}

// 祈燈：count 抽（1 或 10），pay＝'tickets' | 'stardust'（遊戲內貨幣）。
// 抽到的裝備進背包；背包滿就自動分解成燈油（另列）。
export function drawGacha(profile, rand, count, pay) {
  if (count !== 1 && count !== 10) return { ok: false, reason: 'count' };
  const cost = gachaCost(count)[pay];
  if (cost === undefined) return { ok: false, reason: 'pay' };
  if (profile[pay] < cost) return { ok: false, reason: pay };
  profile[pay] -= cost;
  const results = [];
  let autoSalvage = 0;
  for (let i = 0; i < count; i++) {
    const { rarity, pity } = rollRarity(profile, rand);
    const item = rollGear(profile, rand, RARITIES.map((_, j) => (j === rarity ? 1 : 0)), rarity);
    let salvaged = 0;
    if (profile.gear.items.length < MAX_ITEMS) profile.gear.items.push(item);
    else { salvaged = salvageValue(item); autoSalvage += salvaged; }
    results.push({ rarity, pity, item, salvaged });
  }
  profile.oil += autoSalvage;
  return { ok: true, results, cost: { [pay]: cost }, autoSalvage };
}

// ---- 每日補給（本地日期，一天一次）----
export function localDate(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const canClaimDaily = (profile, now) => profile.daily.last !== localDate(now);
export function claimDaily(profile, now) {
  if (!canClaimDaily(profile, now)) return { ok: false, reason: 'claimed' };
  profile.oil += DAILY.oil; profile.stardust += DAILY.stardust; profile.tickets += DAILY.tickets;
  profile.daily.last = localDate(now);
  return { ok: true, got: { ...DAILY } };
}

// ---- 商城購買 ----
// kind 'sim'：模擬購買——不收任何東西，只走流程並記錄；kind 'game'：用遊戲內貨幣（星砂／燈油）買。
export function shopItem(id) { return SHOP.find((x) => x.id === id); }
export function canBuy(profile, id) {
  const item = shopItem(id);
  if (!item) return { ok: false, reason: 'missing' };
  if (item.limit && (profile.shop.bought[id] || 0) >= item.limit) return { ok: false, reason: 'limit' };
  if (item.kind === 'game') for (const [cur, n] of Object.entries(item.price)) if (profile[cur] < n) return { ok: false, reason: cur };
  return { ok: true, item };
}
export function buyItem(profile, id, rand, now) {
  const chk = canBuy(profile, id);
  if (!chk.ok) return chk;
  const item = chk.item;
  if (item.kind === 'game') for (const [cur, n] of Object.entries(item.price)) profile[cur] -= n;
  const g = item.gives, gear = [];
  profile.oil += g.oil || 0; profile.stardust += g.stardust || 0; profile.tickets += g.tickets || 0;
  if (g.gear !== undefined) {
    const it = rollGear(profile, rand, RARITIES.map((_, j) => (j === g.gear ? 1 : 0)), g.gear);
    if (profile.gear.items.length < MAX_ITEMS) profile.gear.items.push(it);
    else { it.salvaged = salvageValue(it); profile.oil += it.salvaged; }
    gear.push(it);
  }
  profile.shop.bought[id] = (profile.shop.bought[id] || 0) + 1;
  profile.shop.history.push({ t: now, id });
  if (profile.shop.history.length > MAX_HISTORY) profile.shop.history.splice(0, profile.shop.history.length - MAX_HISTORY);
  return { ok: true, simulated: item.kind === 'sim', item, gear };
}
