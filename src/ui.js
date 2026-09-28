// HTML 介面層：主選單、章節、天賦、裝備、升級三選一、燈核、暫停、結算、提示。
// 只負責顯示，並把點擊轉成 actions[act](dataset)；不直接改遊戲資料。
import { WEAPONS, PASSIVES, RESONANCES, CHAPTERS, TALENTS, RARITIES, GEAR_SLOTS, GEAR_MAX_LV, STAT_NAMES, gearUpgradeCost } from './content.js';
import { makeIcon } from './art.js';
import { talentCost, gearMods, salvageValue, chapterUnlocked, profileMods } from './meta.js';
import { aggregate } from './stats.js';

const $ = (sel) => document.querySelector(sel);
const iconUrl = (id, color) => makeIcon(id, color, 104).toDataURL();
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const num = (n) => Math.floor(n).toLocaleString('zh-Hant');

// 加成顯示：pct → +12%；flat → +10（回復顯示 /秒）
export function fmtMod(m) {
  const name = STAT_NAMES[m.stat];
  if (m.pct) return `${name} ${m.stat === 'cdr' || m.stat === 'armor' ? '-' : '+'}${+(m.pct * 100).toFixed(1)}%`;
  return `${name} +${+m.flat.toFixed(2)}${m.stat === 'regen' ? '/秒' : ''}`;
}
export const gearName = (it) => `${RARITIES[it.rarity].name}${GEAR_SLOTS[it.slot].name}${it.lv > 1 ? ` +${it.lv - 1}` : ''}`;

export function createUI(actions) {
  let lockUntil = 0; // 面板剛出現時短暫鎖住點擊，避免移動中的手指誤點
  const lock = () => { lockUntil = performance.now() + 350; };
  document.getElementById('stage').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || performance.now() < lockUntil) return;
    actions[el.dataset.act]?.(el.dataset);
  });

  function show(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
    $('#pauseBtn').style.display = id === null ? 'flex' : 'none';
    if (id) lock();
  }
  function card(o, i) {
    return `<button class="card" ${i === undefined ? '' : `data-act="choose" data-i="${i}"`} style="--c:${o.color}">
      <img src="${iconUrl(o.icon, o.color)}" alt="">
      <div><div><span class="t">${esc(o.name)}</span><span class="l">${esc(o.label)}</span></div>
      <div class="d">${esc(o.desc)}</div>${o.hint ? `<div class="h">${esc(o.hint)}</div>` : ''}</div></button>`;
  }
  function buildHtml(p) {
    const w = p.weapons.map((x) => `<span><img src="${iconUrl(x.id, WEAPONS[x.id].color)}" alt="">${esc(x.evo ? RESONANCES[x.id].name : WEAPONS[x.id].name)}<br>${x.evo ? '★共鳴' : 'Lv ' + x.lv}</span>`);
    const ps = Object.entries(p.passives).map(([id, lv]) => `<span><img src="${iconUrl(id, PASSIVES[id].color)}" alt="">${esc(PASSIVES[id].name)}<br>Lv ${lv}</span>`);
    return w.concat(ps).join('');
  }
  const oilTag = (profile) => `<div class="oil">燈油 <b>${num(profile.oil)}</b></div>`;
  function gearTile(it, equipped) {
    const c = RARITIES[it.rarity].color;
    return `<button class="gear" data-act="gearOpen" data-uid="${it.uid}" style="--c:${c}">
      <span class="slot">${GEAR_SLOTS[it.slot].name}</span><b>${esc(gearName(it))}</b>
      <span class="main">${esc(fmtMod(gearMods(it)[0]))}</span>${equipped ? '<span class="eq">裝備中</span>' : ''}</button>`;
  }

  let toastT = 0;
  return {
    hud() { show(null); },
    toast(text, ms = 3500) {
      const t = $('#toast'); t.textContent = text; t.classList.add('show');
      clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
    },

    menu(profile) {
      $('#menu .oil-slot').innerHTML = oilTag(profile);
      const cleared = profile.chapters.cleared.length;
      $('#menu .progress').textContent = cleared ? `已點亮 ${cleared} / ${CHAPTERS.length} 座燈塔` : '尚未點亮任何燈塔';
      show('menu');
    },
    chapters(profile) {
      $('#chapters .list').innerHTML = CHAPTERS.map((c) => {
        const open = chapterUnlocked(profile, c.id), done = profile.chapters.cleared.includes(c.id), best = profile.chapters.best[c.id];
        return `<button class="chapter ch${c.id}" ${open ? `data-act="startChapter" data-id="${c.id}"` : 'disabled'}>
          <b>第${'一二三四五六'[c.id - 1]}章・${esc(c.name)}</b>${done ? '<span class="done">已點亮</span>' : ''}
          <div>${open ? esc(c.tagline) : `通關第${'一二三四五六'[c.id - 2]}章後解鎖`}</div>
          ${best ? `<div class="best">最快 ${clock(best.t)}・擊倒 ${best.kills}</div>` : ''}</button>`;
      }).join('');
      show('chapters');
    },
    talents(profile) {
      $('#talents .oil-slot').innerHTML = oilTag(profile);
      $('#talents .list').innerHTML = Object.entries(TALENTS).map(([id, t]) => {
        const lv = profile.talents[id] || 0, max = t.cost.length, cost = talentCost(profile, id);
        const total = t.mods.map((m) => fmtMod({ stat: m.stat, flat: (m.flat || 0) * lv, pct: (m.pct || 0) * lv })).join('、');
        return `<div class="row"><div class="info"><b>${esc(t.name)}</b> <span class="lv">${lv} / ${max}</span>
          <div class="d">${esc(t.desc)}${lv ? `（目前 ${esc(total)}）` : ''}</div></div>
          ${cost === null ? '<span class="max">已滿</span>' : `<button class="buy" data-act="buyTalent" data-id="${id}" ${profile.oil < cost ? 'disabled' : ''}>升級<br><small>${num(cost)}</small></button>`}</div>`;
      }).join('');
      show('talents');
    },
    gear(profile, openUid = null) {
      $('#gear .oil-slot').innerHTML = oilTag(profile);
      const eq = profile.gear.equipped, items = profile.gear.items;
      $('#gear .equipped').innerHTML = Object.keys(GEAR_SLOTS).map((slot) => {
        const it = items.find((i) => i.uid === eq[slot]);
        return it ? gearTile(it, true) : `<div class="gear empty"><span class="slot">${GEAR_SLOTS[slot].name}</span><b>未裝備</b></div>`;
      }).join('');
      const agg = aggregate(profileMods(profile));
      const lines = Object.entries(agg).filter(([, a]) => a.flat || a.pct).map(([stat, a]) => fmtMod({ stat, flat: a.flat, pct: a.pct }));
      $('#gear .summary').textContent = lines.length ? `天賦＋裝備合計：${lines.join('、')}` : '還沒有任何局外加成';
      const sorted = [...items].sort((a, b) => b.rarity - a.rarity || b.lv - a.lv || a.uid - b.uid);
      $('#gear .bag-title').textContent = `背包 ${items.length}`;
      $('#gear .bag').innerHTML = sorted.map((it) => gearTile(it, eq[it.slot] === it.uid)).join('') || '<div class="empty-bag">還沒有裝備。打完一章（或撐過 4 分鐘）會掉落。</div>';
      const sheet = $('#gear .sheet');
      const it = items.find((i) => i.uid === openUid);
      if (it) {
        const on = eq[it.slot] === it.uid, cost = it.lv < GEAR_MAX_LV ? gearUpgradeCost(it.rarity, it.lv) : null;
        sheet.innerHTML = `<div class="sheet-card" style="--c:${RARITIES[it.rarity].color}">
          <b class="name">${esc(gearName(it))}</b><div class="rar">${RARITIES[it.rarity].name}・${GEAR_SLOTS[it.slot].name}・強化 ${it.lv} / ${GEAR_MAX_LV}</div>
          <ul>${gearMods(it).map((m, i) => `<li class="${i ? '' : 'mainline'}">${esc(fmtMod(m))}</li>`).join('')}</ul>
          <div class="acts">
            <button class="btn small" data-act="${on ? 'gearUnequip' : 'gearEquip'}" data-uid="${it.uid}">${on ? '卸下' : '裝備'}</button>
            ${cost === null ? '<button class="btn small ghost" disabled>已滿級</button>' : `<button class="btn small" data-act="gearUpgrade" data-uid="${it.uid}" ${profile.oil < cost ? 'disabled' : ''}>強化（${num(cost)}）</button>`}
            <button class="btn small ghost" data-act="gearSalvage" data-uid="${it.uid}">分解（+${num(salvageValue(it))}）</button>
            <button class="btn small ghost" data-act="gearClose">關閉</button></div></div>`;
        sheet.classList.add('show');
      } else sheet.classList.remove('show');
      if ($('#gear').classList.contains('show')) return; // 已經開著就只重畫內容，不重新淡入
      show('gear');
    },

    levelUp(choices) { $('#levelup .cards').innerHTML = choices.map(card).join(''); show('levelup'); },
    chest(result) {
      $('#chest h2').textContent = result.type === 'evo' ? '共鳴覺醒！' : '燈核開啟';
      $('#chest .cards').innerHTML = result.items.map((o) => card(o)).join('');
      show('chest');
    },
    pause(s) { $('#pause .build').innerHTML = buildHtml(s.player); show('pause'); },
    result(s, summary, profile) {
      const win = s.phase === 'win';
      const r = $('#result');
      r.className = 'overlay scroll ' + (win ? 'win' : 'lose');
      r.querySelector('h1').textContent = win ? '燈塔重燃' : '燈火熄滅';
      r.querySelector('.sub').textContent = win ? `${s.chapter.name}的燈塔再次亮起。${summary.firstClear ? '（首次點亮！）' : ''}` : (s.quit ? '你提前撤離了。' : '菌潮吞沒了光……再試一次吧。');
      r.querySelector('.stats').innerHTML = [['存活', clock(s.t)], ['擊倒', s.kills], ['等級', s.player.level], ['共鳴', s.player.weapons.filter((w) => w.evo).length || '—']]
        .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      r.querySelector('.ledger').innerHTML = summary.oil.lines.map((l) => `<div><span>${esc(l.label)}</span><b>+${num(l.amount)}</b></div>`).join('')
        + `<div class="total"><span>本局燈油</span><b>+${num(summary.oil.total)}</b></div>`
        + (summary.autoSalvage ? `<div class="note"><span>背包已滿，新裝備自動分解</span><b>+${num(summary.autoSalvage)}</b></div>` : '')
        + `<div class="note"><span>目前持有</span><b>${num(profile.oil)}</b></div>`;
      r.querySelector('.drops').innerHTML = summary.drops.length
        ? `<div class="drops-title">獲得裝備</div>${summary.drops.map((it) => `<div class="drop" style="--c:${RARITIES[it.rarity].color}"><b>${esc(gearName(it))}</b><span>${esc(fmtMod(gearMods(it)[0]))}${it.salvaged ? '（已自動分解）' : ''}</span></div>`).join('')}`
        : '';
      show('result');
    },
  };
}
