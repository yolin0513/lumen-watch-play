// HTML 介面層：主選單、章節、天賦、裝備、升級三選一、燈核、暫停、結算、提示。
// 只負責顯示，並把點擊轉成 actions[act](dataset)；不直接改遊戲資料。
import { WEAPONS, PASSIVES, RESONANCES, CHAPTERS, TALENTS, RARITIES, GEAR_SLOTS, GEAR_MAX_LV, STAT_NAMES, SHOP, GACHA, WEAPON_GACHA, DAILY, START_WEAPON, gearUpgradeCost } from './content.js';
import { makeIcon } from './art.js';
import { talentCost, gearMods, salvageValue, chapterUnlocked, profileMods } from './meta.js';
import { aggregate } from './stats.js';
import { gachaOdds, fmtPct, gachaCost, gachaPay, canBuy, canClaimDaily, EXCLUSIVES } from './shop.js';

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
  const wallet = (p) => `<div class="wallet"><span>燈油 <b>${num(p.oil)}</b></span><span>星砂 <b>${num(p.stardust)}</b></span><span>祈燈券 <b>${num(p.tickets)}</b></span></div>`;
  const CUR = { stardust: '星砂', oil: '燈油', tickets: '祈燈券' };
  const priceText = (price) => Object.entries(price).map(([k, v]) => `${num(v)} ${CUR[k]}`).join('＋');
  const givesText = (g) => [g.oil && `燈油 ×${num(g.oil)}`, g.stardust && `星砂 ×${num(g.stardust)}`, g.tickets && `祈燈券 ×${g.tickets}`].filter(Boolean).join('、');
  function gearLine(it) {
    return `<div class="drop" style="--c:${RARITIES[it.rarity].color}"><b>${esc(gearName(it))}</b><span>${esc(fmtMod(gearMods(it)[0]))}${it.salvaged ? `（背包已滿，分解 +${num(it.salvaged)} 燈油）` : ''}</span></div>`;
  }
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

    menu(profile, dailyReady = false) {
      $('#menu .oil-slot').innerHTML = wallet(profile);
      $('#menu .shop-dot').style.display = dailyReady ? 'inline-block' : 'none';
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
      { // 起始武器欄：抽到（擁有）的專屬武器要在這裡裝上才會成為開局武器
        const eq = profile.weapons.equipped, owned = profile.weapons.owned;
        const cur = eq ?? START_WEAPON;
        $('#gear .weapon-slot').innerHTML = `<div class="sec-title">起始武器</div>
          <div class="wslot"><img src="${iconUrl(cur, WEAPONS[cur].color)}" alt=""><div><b style="color:${WEAPONS[cur].color}">${esc(WEAPONS[cur].name)}</b>${eq ? '<span class="lim">專屬</span>' : '<span class="lim">預設</span>'}<div class="d">${esc(WEAPONS[cur].desc[0])}</div></div>
          ${eq ? '<button class="buy" data-act="weaponUnequip">卸下</button>' : ''}</div>
          ${EXCLUSIVES.map((id) => { const own = owned.includes(id), on = eq === id;
            return `<div class="wslot ${own ? '' : 'locked'}"><img src="${iconUrl(id, WEAPONS[id].color)}" alt=""><div><b style="color:${own ? WEAPONS[id].color : 'var(--dim)'}">${esc(WEAPONS[id].name)}</b><div class="d">${own ? esc(WEAPONS[id].desc[0]) : '尚未擁有（從商城的「武器祈燈」取得）'}</div></div>
            ${own && !on ? `<button class="buy" data-act="weaponEquip" data-id="${id}">裝備</button>` : on ? '<span class="max">裝備中</span>' : ''}</div>`; }).join('')}`;
      }
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

    // ---- 商城 ----
    // 機率表的每個數字都由 gachaOdds(GACHA) 算出，這裡不准手寫任何百分比（tools/shop-test.mjs 會拿畫面數字和實抽分布比對）。
    shop(profile, now) {
      $('#shop .wallet-slot').innerHTML = wallet(profile);
      const ready = canClaimDaily(profile, now);
      $('#shop .daily').innerHTML = `<div class="sec-title">每日補給</div>
        <div class="shop-row"><div><b>今日補給</b><div class="d">${esc(givesText(DAILY))}（每天一次，免費）</div></div>
        ${ready ? '<button class="buy" data-act="claimDaily">領取</button>' : '<span class="max">今天已領，明天再來</span>'}</div>`;
      const o = gachaOdds(GACHA), top = RARITIES[o.top].name, left = o.pity - profile.gacha.pity;
      const btn = (n) => {
        const pay = gachaPay(profile, n), c = gachaCost(n);
        const label = pay === 'tickets' ? `用 ${c.tickets} 張祈燈券` : `花 ${num(c.stardust)} 星砂`;
        return `<button class="btn small" data-act="gachaAsk" data-n="${n}" ${pay ? '' : 'disabled'}>模擬抽獎 ×${n}<br><small>${pay ? label : `需要 ${num(c.stardust)} 星砂或 ${c.tickets} 張券`}</small></button>`;
      };
      $('#shop .gacha').innerHTML = `<div class="sec-title">祈燈（抽裝備）</div>
        <table class="odds"><tr><th>稀有度</th><th>單抽機率</th><th>含保底綜合機率</th></tr>
        ${RARITIES.map((r, i) => `<tr data-rarity="${i}"><td style="color:${r.color}">${r.name}</td><td class="odds-base">${fmtPct(o.base[i])}</td><td class="odds-comp">${fmtPct(o.composite[i])}</td></tr>`).join('')}</table>
        <div class="pity">保底：第 <b>${o.pity}</b> 抽必得「${top}」。目前已累積 <b>${profile.gacha.pity}</b> 抽，再 <b>${left}</b> 抽必得。抽到「${top}」後重新計算。</div>
        <div class="d small">機率由遊戲內的機率表直接計算；「綜合機率」是把保底算進去後，長期每一抽的實際機率。</div>
        <div class="gacha-btns">${btn(1)}${btn(10)}</div>`;
      { // 武器祈燈：機率一樣由 gachaOdds(WEAPON_GACHA) 算出，不准手寫
        const w = gachaOdds(WEAPON_GACHA), left = w.pity - profile.gacha.wpity;
        const wbtn = (n) => {
          const pay = gachaPay(profile, n, WEAPON_GACHA), c = gachaCost(n, WEAPON_GACHA);
          const label = pay === 'tickets' ? `用 ${c.tickets} 張祈燈券` : `花 ${num(c.stardust)} 星砂`;
          return `<button class="btn small" data-act="wgachaAsk" data-n="${n}" ${pay ? '' : 'disabled'}>模擬抽獎 ×${n}<br><small>${pay ? label : `需要 ${num(c.stardust)} 星砂或 ${c.tickets} 張券`}</small></button>`;
        };
        const owned = profile.weapons.owned.length;
        $('#shop .wgacha').innerHTML = `<div class="sec-title">武器祈燈（專屬起始武器）</div>
          <table class="odds"><tr><th>獎項</th><th>單抽機率</th><th>含保底綜合機率</th></tr>
          ${WEAPON_GACHA.outcomes.map((o, i) => `<tr data-rarity="${i}"><td${i === w.top ? ' style="color:#ffc85a"' : ''}>${esc(o.name)}</td><td class="odds-base">${fmtPct(w.base[i])}</td><td class="odds-comp">${fmtPct(w.composite[i])}</td></tr>`).join('')}</table>
          <div class="pity">保底：第 <b>${w.pity}</b> 抽必得專屬武器。目前已累積 <b>${profile.gacha.wpity}</b> 抽，再 <b>${left}</b> 抽必得。</div>
          <div class="d small">抽中「專屬武器」時，從你還沒有的專屬武器中平均選一把（目前擁有 ${owned} / ${EXCLUSIVES.length}）；全部都有了就改給 ${num(WEAPON_GACHA.dupRefund.stardust)} 星砂。抽到後要到「裝備」畫面裝上才會生效。抽獎用的星砂與祈燈券都能靠遊玩取得。</div>
          <div class="gacha-btns">${wbtn(1)}${wbtn(10)}</div>`;
      }
      const packRow = (it) => {
        const chk = canBuy(profile, it.id), bought = profile.shop.bought[it.id] || 0;
        const tag = it.kind === 'sim' ? `模擬 ${num(it.simPoints)} 點` : priceText(it.price);
        const soldOut = chk.reason === 'limit';
        return `<div class="shop-row"><div><b>${esc(it.name)}</b>${it.limit ? `<span class="lim">限購 ${it.limit}（已買 ${bought}）</span>` : ''}<div class="d">${esc(it.desc)}</div></div>
          ${soldOut ? '<span class="max">已購買</span>' : `<button class="buy" data-act="buyAsk" data-id="${it.id}" ${chk.ok ? '' : 'disabled'}>${it.kind === 'sim' ? '模擬購買' : '購買'}<br><small>${esc(tag)}</small></button>`}</div>`;
      };
      $('#shop .packs').innerHTML = `<div class="sec-title">禮包（用遊戲內貨幣）</div>${SHOP.filter((x) => x.kind === 'game').map(packRow).join('')}`;
      $('#shop .simbuy').innerHTML = `<div class="sec-title">星砂（模擬購買）</div>
        <div class="d small">「模擬 N 點」是虛構的標示，不對應任何真實貨幣；按下只會跑一次模擬流程，不會產生任何費用。星砂也能靠通關與每日補給取得。</div>
        ${SHOP.filter((x) => x.kind === 'sim').map(packRow).join('')}`;
      if (!$('#shop').classList.contains('show')) show('shop');
    },
    // m：null / {type:'confirm', title, lines[], act, data} / {type:'processing'} / {type:'done', lines[], gear[]} / {type:'gacha', results} / {type:'history', entries}
    shopModal(m) {
      const box = $('#shop .modal');
      if (!m) { box.classList.remove('show'); box.innerHTML = ''; return; }
      let html = '';
      if (m.type === 'confirm') html = `<h3>${esc(m.title)}</h3>${m.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        <div class="acts"><button class="btn small" data-act="${m.act}" ${Object.entries(m.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(m.ok)}</button><button class="btn small ghost" data-act="shopClose">取消</button></div>`;
      else if (m.type === 'processing') html = `<h3>處理中（模擬）…</h3><p>沒有連到任何地方，也不會產生任何費用。</p>`;
      else if (m.type === 'done') html = `<h3>完成</h3><p class="sim-note">這是模擬交易，沒有實際付款。</p>${m.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${(m.gear || []).map(gearLine).join('')}
        <div class="acts"><button class="btn small" data-act="shopClose">好</button></div>`;
      else if (m.type === 'gacha') {
        const pityHit = m.results.some((r) => r.pity);
        html = `<h3>祈燈結果</h3><div class="gacha-grid">${m.results.map((r) => `<div class="gcard r${r.rarity}" style="--c:${RARITIES[r.rarity].color}">
          <span class="rn">${RARITIES[r.rarity].name}${r.pity ? '・保底' : ''}</span><b>${esc(gearName(r.item))}</b><span>${esc(fmtMod(gearMods(r.item)[0]))}</span>${r.salvaged ? `<span class="sv">背包滿，分解 +${num(r.salvaged)} 燈油</span>` : ''}</div>`).join('')}</div>
          ${pityHit ? `<p>觸發保底，已重新計算。</p>` : ''}
          <p class="sim-note">這是模擬交易，沒有實際付款（使用的是遊戲內的星砂或祈燈券）。</p>
          <div class="acts"><button class="btn small" data-act="shopClose">收下</button></div>`;
      } else if (m.type === 'wgacha') {
        const txt = (r) => r.weapon ? `專屬武器「${WEAPONS[r.weapon].name}」` : r.refund ? `專屬武器（已全部擁有，改給 ${num(r.refund.stardust)} 星砂）` : WEAPON_GACHA.outcomes[r.idx].name;
        const got = m.results.filter((r) => r.weapon);
        html = `<h3>武器祈燈結果</h3><div class="gacha-grid">${m.results.map((r) => `<div class="gcard ${r.weapon || r.refund ? 'r4' : 'r0'}" style="--c:${r.weapon ? WEAPONS[r.weapon].color : r.refund ? '#ffc85a' : '#c9cfe6'}"><span class="rn">${r.pity ? '保底' : ''}</span><b>${esc(txt(r))}</b></div>`).join('')}</div>
          ${got.length ? `<p>抽到的專屬武器已放進收藏，<b>到「裝備」畫面裝上才會成為開局武器</b>。</p>` : ''}
          <p class="sim-note">這是模擬交易，沒有實際付款（使用的是遊戲內的星砂或祈燈券）。</p>
          <div class="acts"><button class="btn small" data-act="shopClose">收下</button></div>`;
      } else if (m.type === 'history') html = `<h3>交易紀錄</h3><p class="sim-note">所有交易皆為模擬，沒有實際付款。</p>
        ${m.entries.length ? `<ul class="hist">${m.entries.slice().reverse().map((h) => `<li><span>${new Date(h.t).toLocaleString('zh-Hant')}</span><b>${esc(SHOP.find((x) => x.id === h.id)?.name ?? h.id)}</b>${SHOP.find((x) => x.id === h.id)?.kind === 'sim' ? '<i>模擬購買</i>' : ''}</li>`).join('')}</ul>` : '<p>還沒有任何交易。</p>'}
        <div class="acts"><button class="btn small" data-act="shopClose">關閉</button></div>`;
      box.innerHTML = `<div class="modal-card">${html}</div>`;
      box.classList.add('show');
      lock();
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
        + (summary.stardust ? `<div class="total"><span>星砂${summary.firstClear ? '（含首次通關）' : ''}</span><b>+${num(summary.stardust)}</b></div>` : '')
        + (summary.autoSalvage ? `<div class="note"><span>背包已滿，新裝備自動分解</span><b>+${num(summary.autoSalvage)}</b></div>` : '')
        + `<div class="note"><span>目前持有</span><b>${num(profile.oil)}</b></div>`;
      r.querySelector('.drops').innerHTML = summary.drops.length
        ? `<div class="drops-title">獲得裝備</div>${summary.drops.map((it) => `<div class="drop" style="--c:${RARITIES[it.rarity].color}"><b>${esc(gearName(it))}</b><span>${esc(fmtMod(gearMods(it)[0]))}${it.salvaged ? '（已自動分解）' : ''}</span></div>`).join('')}`
        : '';
      show('result');
    },
  };
}
