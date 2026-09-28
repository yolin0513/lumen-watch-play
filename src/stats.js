// 加成疊加規則——全遊戲唯一一處。局內被動、天賦、裝備的加成都轉成 modifier 丟進來算，規則不准在別處另寫。
//
// modifier 形狀：{ stat, flat?, pct? }
//   flat：同一屬性的所有 flat 直接相加。
//   pct ：同一屬性的所有百分比「先相加」，再一次乘上 (1 + Σpct)。
//         → 兩個 +20% 疊起來是 +40%（×1.40），不是 ×1.2×1.2＝×1.44。
//   最終值 ＝ (基礎值 + Σflat) × (1 + Σpct)
// 例外（「縮減類」，越多越好但不能無限）：
//   cdr   冷卻縮減：Σpct 相加後上限 CAPS.cdr，冷卻倍率 ＝ 1 − min(Σ, 上限)
//   armor 減傷    ：Σpct 相加後上限 CAPS.armor，受傷倍率 ＝ 1 − min(Σ, 上限)
// 這些規則由 tools/meta-test.mjs 的「疊加規則」情境釘住。
export const STATS = ['dmg', 'maxHp', 'speed', 'magnet', 'cdr', 'regen', 'oil', 'armor', 'revive'];
export const CAPS = { cdr: 0.6, armor: 0.5 };

export function aggregate(mods) {
  const agg = {};
  for (const s of STATS) agg[s] = { flat: 0, pct: 0 };
  for (const m of mods) {
    const a = agg[m.stat];
    if (!a) throw new Error(`未知屬性 ${m.stat}`);
    a.flat += m.flat || 0; a.pct += m.pct || 0;
  }
  return agg;
}
export const scaled = (base, a) => (base + a.flat) * (1 + a.pct);
export const reduction = (a, cap) => 1 - Math.min(a.pct, cap);
