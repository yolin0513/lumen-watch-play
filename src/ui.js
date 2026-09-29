// HTML 介面層：主選單、章節、天賦、裝備、商城、升級三選一、燈核、暫停、結算、提示。
// 只負責顯示，並把點擊轉成 actions[act](dataset)；不直接改遊戲資料。
// 按鈕回饋只用 transform／opacity 的 CSS 動畫（不觸發重排，不增加遊戲畫布的繪製成本）。
import { WEAPONS, PASSIVES, RESONANCES, CHAPTERS, TALENTS, RARITIES, GEAR_SLOTS, GEAR_MAX_LV, STAT_NAMES, SHOP, GACHA, WEAPON_GACHA, DAILY, START_WEAPON, AUTO_SALVAGE_MAX, GEAR_ASCEND, WEAPON_ASCEND, STAGES, gearUpgradeCost } from './content.js';
import { makeIcon } from './art.js';
import { talentCost, gearMods, baseGearMods, ascendPerks, ascendCost, weaponAscendCost, crystalValue, salvageValue, ecoUnlocked, stageUnlocked, stageCleared, ecoProgress, unlockText, profileMods, gearSpace, autoSalvageLevel, startWeaponOf } from './meta.js';
import { aggregate } from './stats.js';
import { gachaOdds, fmtPct, gachaCost, gachaPay, canBuy, canClaimDaily, EXCLUSIVES } from './shop.js';
import { MAX_ITEMS, PENDING_MAX } from './save.js';

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
export const PAY_NOTE = '所有道具都只用遊戲內的燈油、星砂、祈燈券取得，這些全部靠遊玩獲得，不涉及任何付款。';
export const gearName = (it) => `${RARITIES[it.rarity].name}${GEAR_SLOTS[it.slot].name}${it.lv > 1 ? ` +${it.lv - 1}` : ''}`;
// 自動分解門檻的文字：-1 關閉；0 常見；1 精良以下；2 稀有以下
export const autoSalvageText = (lv) => lv < 0 ? '關閉' : lv === 0 ? RARITIES[0].name : `${RARITIES[lv].name}以下`;
// 裝備這次放到哪裡（storeGear 的回傳）→ 給玩家看的說明
export function whereText(it) {
  if (it.where === 'pending') return '背包已滿，放進暫存區';
  const got = `+${num(it.salvaged)} 燈油${it.crystals ? `、+${it.crystals} 結晶` : ''}`;
  if (it.where === 'auto') return `依你的設定自動分解 ${got}`;
  if (it.where === 'overflow' || (!it.where && it.salvaged)) return `背包與暫存區都滿，已分解 ${got}`;
  return '';
}

export function createUI(actions) {
  let lockUntil = 0; // 面板剛出現時短暫鎖住點擊，避免移動中的手指誤點
  const lock = () => { lockUntil = performance.now() + 350; };
  document.getElementById('stage').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || performance.now() < lockUntil) return;
    actions[el.dataset.act]?.(el.dataset);
  });

  let current = null;
  function show(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
    $('#pauseBtn').style.display = id === null ? 'flex' : 'none';
    $('#speedBtn').style.display = id === null ? 'flex' : 'none';
    if (id && id !== current) lock(); // 只有換面板時才鎖；同一頁重畫（例如連按升級）不鎖，否則連點會被吃掉
    current = id;
  }
  // 升級卡。o.reso（sim 的 describe 從共鳴資料算出）：partners＝能跟這張卡共鳴的對象、held＝其中玩家身上已有的。
  // 身上已有對應的就亮「可共鳴」標記；data-reso-* 讓測試直接比對畫面提示與實際共鳴規則。
  function card(o, i) {
    const r = o.reso, ready = !!r?.held.length;
    return `<button class="card${ready ? ' reso-ready' : ''}" ${i === undefined ? '' : `data-act="choose" data-i="${i}"`}${r ? ` data-reso-partners="${r.partners.join(',')}" data-reso-held="${r.held.join(',')}"${r.ready ? ` data-reso-ready="${r.ready.join(',')}" data-reso-done="${r.done.join(',')}"` : ''}` : ''} style="--c:${o.color}">
      <img src="${iconUrl(o.icon, o.color)}" alt="">
      <div><div><span class="t">${esc(o.name)}</span><span class="l">${esc(o.label)}</span>${ready ? '<span class="rb">可共鳴</span>' : ''}</div>
      <div class="d">${esc(o.desc)}</div>${o.hint ? `<div class="h">${esc(o.hint)}</div>` : ''}</div></button>`;
  }
  function buildHtml(p) {
    const w = p.weapons.map((x) => `<span><img src="${iconUrl(x.id, WEAPONS[x.id].color)}" alt="">${esc(x.evo ? RESONANCES[x.id].name : WEAPONS[x.id].name)}<br>${x.evo ? '★共鳴' : 'Lv ' + x.lv}</span>`);
    const ps = Object.entries(p.passives).map(([id, lv]) => `<span><img src="${iconUrl(id, PASSIVES[id].color)}" alt="">${esc(PASSIVES[id].name)}<br>Lv ${lv}</span>`);
    return w.concat(ps).join('');
  }
  // 數值變化回饋：和上次畫出來的數字不同，就讓數字跳一下，並飄出差額
  const lastVal = {};
  function money(key, v) {
    const d = lastVal[key] === undefined ? 0 : v - lastVal[key];
    lastVal[key] = v;
    return `<span class="money"><b${d ? ' class="fx-bump"' : ''}>${num(v)}</b>${d ? `<i class="fx-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${num(Math.abs(d))}</i>` : ''}</span>`;
  }
  const oilTag = (profile) => `<div class="oil">燈油 ${money('oil', profile.oil)}</div>`;
  const wallet = (p) => `<div class="wallet"><span>燈油 ${money('oil', p.oil)}</span><span>星砂 ${money('stardust', p.stardust)}</span><span>祈燈券 ${money('tickets', p.tickets)}</span></div>`;
  const CUR = { stardust: '星砂', oil: '燈油', tickets: '祈燈券' };
  const priceText = (price) => Object.entries(price).map(([k, v]) => `${num(v)} ${CUR[k]}`).join('＋');
  const givesText = (g) => [g.oil && `燈油 ×${num(g.oil)}`, g.stardust && `星砂 ×${num(g.stardust)}`, g.tickets && `祈燈券 ×${g.tickets}`].filter(Boolean).join('、');
  function gearLine(it) {
    const w = whereText(it);
    return `<div class="drop" data-rar="${it.rarity}" style="--c:${RARITIES[it.rarity].color}"><b>${esc(gearName(it))}</b><span>${esc(fmtMod(gearMods(it)[0]))}${w ? `（${esc(w)}）` : ''}</span></div>`;
  }
  // 裝備格子。sel：批量分解模式（null＝一般模式；Set＝已勾選的 uid）
  function gearTile(it, equipped, sel = null, fx = false) {
    const c = RARITIES[it.rarity].color;
    if (sel) {
      if (equipped) return `<button class="gear locked" disabled data-uid="${it.uid}" data-rar="${it.rarity}" style="--c:${c}"><span class="slot">${GEAR_SLOTS[it.slot].name}</span><b>${esc(gearName(it))}</b><span class="main">裝備中，不能批量分解</span></button>`;
      const on = sel.has(it.uid);
      return `<button class="gear pick${on ? ' sel' : ''}" data-act="gearPick" data-uid="${it.uid}" data-rar="${it.rarity}" style="--c:${c}"><span class="slot">${GEAR_SLOTS[it.slot].name}</span><b>${esc(gearName(it))}</b>
        <span class="main">${esc(fmtMod(gearMods(it)[0]))}</span><span class="tick">${on ? '✓' : ''}</span></button>`;
    }
    return `<button class="gear${fx ? ' fx-flash' : ''}" data-act="gearOpen" data-uid="${it.uid}" data-rar="${it.rarity}" style="--c:${c}">
      <span class="slot">${GEAR_SLOTS[it.slot].name}${it.star ? ` <span class="stars">${'★'.repeat(it.star)}</span>` : ''}</span><b>${esc(gearName(it))}</b>
      <span class="main">${esc(fmtMod(gearMods(it)[0]))}</span>${equipped ? '<span class="eq">裝備中</span>' : ''}</button>`;
  }

  // 裝備的能力區塊（M8）：擁有者第二次看不懂這一頁——滿級傳說只有主屬性是亮色，四條詞條是白字、下面突破又全是 🔒，看起來像詞條沒生效。
  // 實際上主屬性與詞條「裝備中就全部生效」（meta 的 profileMods；shop-test 用裝上／卸下的合計差額比對）。所以每一行都標狀態，
  // 區塊標題直接寫「全部生效中」或「裝備後生效」，和下面「突破才解鎖的額外能力」分開。
  function statBlock(it, on) {
    return `<div class="stat-block ${on ? 'on' : 'idle'}"><div class="sb-title">${on ? '✓ 全部生效中（已裝備）' : '裝備後全部生效（目前沒有裝備）'}</div>
      <ul class="stat-lines">${baseGearMods(it).map((m, i) => `<li class="${i ? 'affix' : 'mainline'}" data-line="${i ? 'affix' : 'main'}">${on ? '✓' : '・'} ${esc(fmtMod(m))}<span class="tag">${i ? '詞條' : `主屬性・隨強化成長`}</span></li>`).join('')}</ul></div>`;
  }
  // 突破區塊：全部五項能力都列出來（已解鎖 ✓、未解鎖 🔒），再寫下一階要什麼材料、現在有多少——擁有者的抱怨是「看不出還有什麼、也不知道怎麼拿到」
  function ascendSection(it, profile, fx) {
    const star = it.star || 0, all = ascendPerks(it, true), c = ascendCost(it);
    const need = it.lv < GEAR_MAX_LV ? `強化到 ${GEAR_MAX_LV} 級後可以突破（目前 ${it.lv} 級）`
      : c ? `下一階（★${c.star}）需要結晶 ×${c.crystals}（你有 ${profile.crystals || 0}）＋燈油 ×${num(c.oil)}` : '已經突破到最高階';
    const can = it.lv >= GEAR_MAX_LV && c && (profile.crystals || 0) >= c.crystals && profile.oil >= c.oil;
    return `<div class="ascend${fx ? ' fx-flash' : ''}"><div class="asc-title">突破 <span class="stars">${'★'.repeat(star)}${'☆'.repeat(GEAR_ASCEND.max - star)}</span><span class="asc-sub">額外能力：突破一階解鎖一項（🔒＝還沒突破，和上面的能力無關）</span></div>
      <ul class="perks">${all.map((m, i) => `<li class="${i < star ? 'on' : 'off'}" data-perk="${i + 1}">${i < star ? '✓' : '🔒'} ★${i + 1}　${esc(fmtMod(m))}</li>`).join('')}</ul>
      <div class="asc-need">${need}</div>
      ${it.lv >= GEAR_MAX_LV && c ? `<button class="btn small" data-act="gearAscend" data-uid="${it.uid}" ${can ? '' : 'disabled'}>突破</button>` : ''}
      <div class="asc-hint">結晶從分解裝備得到（重複的裝備、自動分解都會給）。</div></div>`;
  }

  // 祈燈結果：先亮一盞燈（顏色＝這次最高的稀有度），再一張張翻開；可跳過
  let revealTimer = 0;
  function revealDone() {
    clearTimeout(revealTimer);
    const r = $('#shop .modal .reveal');
    if (r) r.classList.add('skip');
    $('#shop .modal').classList.add('revealed');
  }
  // cards：已經組好的卡片 HTML，翻卡順序（--i）要由呼叫端寫進卡片自己唯一的 style 裡。
  // ⚠ 不可以事後再往卡片塞第二個 style 屬性：瀏覽器只認第一個，後面的 --c（稀有度顏色）會整個消失——M5 的祈燈邊框回歸就是這樣來的。
  function reveal(cards, tier, color, skip) {
    const t0 = tier >= 4 ? 1.1 : tier >= 3 ? 0.8 : 0.6; // 越稀有，開燈越久
    const total = t0 + cards.length * 0.12 + 0.35;
    clearTimeout(revealTimer);
    if (!skip) revealTimer = setTimeout(revealDone, total * 1000);
    return { html: `<div class="reveal tier${tier}${skip ? ' skip' : ''}" style="--t0:${t0}s;--oc:${color}"><div class="orb"></div>
      <div class="gacha-grid">${cards.join('')}</div></div>`, skip };
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
      $('#menu [data-act="openShop"] .shop-dot').style.display = dailyReady ? 'inline-block' : 'none';
      $('#menu .gear-dot').style.display = profile.gear.pending.length ? 'inline-block' : 'none'; // 暫存區有東西等玩家處理
      const cleared = CHAPTERS.reduce((a, c) => a + ecoProgress(profile, c.id).cleared.length, 0);
      $('#menu .progress').textContent = cleared ? `已點亮 ${cleared} / ${CHAPTERS.length * STAGES.count} 座燈塔` : '尚未點亮任何燈塔';
      show('menu');
    },
    // 選關（M8 第二輪）：兩層。eco＝null 時列 6 個生態系（進度、最深那關的最快紀錄、解鎖條件）；給了 eco 就列那個生態系的 10 關。
    // 子頁面的返回鍵在左上角：關卡那一層的返回回到生態系列表。
    chapters(profile, eco = null) {
      const back = $('#chapters .back'), title = $('#chapters h2');
      if (eco === null) {
        back.dataset.act = 'menu'; title.textContent = '選擇燈塔';
        $('#chapters .list').innerHTML = CHAPTERS.map((c) => {
          const open = ecoUnlocked(profile, c.id), pr = ecoProgress(profile, c.id), deep = pr.cleared.length, best = deep ? pr.best[deep] : null;
          return `<button class="chapter ch${c.id}" data-ch="${c.id}" ${open ? `data-act="openEco" data-id="${c.id}"` : 'disabled'}>
            <b>${esc(c.name)}</b><span class="done">${deep} / ${STAGES.count}</span>
            <div>${open ? esc(c.tagline) : `${esc(unlockText(profile, c.id))}後解鎖`}</div>
            ${best ? `<div class="best">第 ${deep} 關最快 ${clock(best.t)}</div>` : ''}</button>`;
        }).join('');
      } else {
        const c = CHAPTERS.find((x) => x.id === eco), pr = ecoProgress(profile, eco);
        back.dataset.act = 'ecoBack'; title.textContent = c.name;
        $('#chapters .list').innerHTML = `<div class="stage-note">${esc(c.tagline)}<br>通關第 ${STAGES.unlockNext} 關會開放下一個生態系；越後面的關卡越難。</div>
          <div class="stages">${Array.from({ length: STAGES.count }, (_, i) => i + 1).map((n) => {
            const open = stageUnlocked(profile, eco, n), done = stageCleared(profile, eco, n), best = pr.best[n];
            return `<button class="stage${done ? ' done' : ''}" data-stage="${n}" ${open ? `data-act="startChapter" data-id="${eco}" data-stage="${n}"` : 'disabled'}>
              <b>${n}</b><span>${done ? `✓ ${best ? clock(best.t) : ''}` : open ? '可挑戰' : `🔒 ${esc(unlockText(profile, eco, n))}`}</span></button>`;
          }).join('')}</div>`;
      }
      show('chapters');
    },
    // fxId：剛升級成功的天賦（那一行閃一下、等級數字跳一下）
    talents(profile, fxId = null) {
      $('#talents .oil-slot').innerHTML = oilTag(profile);
      $('#talents .list').innerHTML = Object.entries(TALENTS).map(([id, t]) => {
        const lv = profile.talents[id] || 0, max = t.cost.length, cost = talentCost(profile, id), fx = id === fxId;
        const total = t.mods.map((m) => fmtMod({ stat: m.stat, flat: (m.flat || 0) * lv, pct: (m.pct || 0) * lv })).join('、');
        return `<div class="row${fx ? ' fx-flash' : ''}"><div class="info"><b>${esc(t.name)}</b> <span class="lv${fx ? ' fx-bump' : ''}">${lv} / ${max}</span>
          <div class="d">${esc(t.desc)}${lv ? `（目前 ${esc(total)}）` : ''}</div></div>
          ${cost === null ? '<span class="max">已滿</span>' : `<button class="buy" data-act="buyTalent" data-id="${id}" ${profile.oil < cost ? 'disabled' : ''}>升級<br><small>${num(cost)}</small></button>`}</div>`;
      }).join('');
      show('talents');
    },
    // v：{ open: 打開詳細頁的 uid, sel: 批量分解模式的勾選（Set）或 null, sheet: 'auto' | 'batch' | null, fx: { uid, kind } }
    gear(profile, v = {}) {
      const { open = null, sel = null, sheet: sheetKind = null, fx = null, wid = null } = v;
      $('#gear .oil-slot').innerHTML = `${oilTag(profile)}<div class="oil">結晶 ${money('crystals', profile.crystals || 0)}</div>`;
      { // 起始武器欄：抽到（擁有）的專屬武器要在這裡裝上才會成為開局武器
        const eq = profile.weapons.equipped, owned = profile.weapons.owned;
        // 清單固定是「預設武器 ＋ 全部專屬武器」，每把只出現一次、順序不隨裝備改變；「裝備中」只影響那一列的標示與按鈕。
        // M4～M6 的錯誤：第一列畫的是「目前裝備的武器」，裝了專屬武器後它出現兩次、預設武器從清單消失。
        const cur = startWeaponOf(profile);
        $('#gear .weapon-slot').innerHTML = `<div class="sec-title">起始武器</div>
          ${[START_WEAPON, ...EXCLUSIVES].map((id) => { const def = id === START_WEAPON, own = def || owned.includes(id), on = cur === id;
            const star = def ? 0 : profile.weapons.stars?.[id] || 0, shards = def ? 0 : profile.weapons.shards?.[id] || 0;
            return `<div class="wslot${own ? '' : ' locked'}${(on && fx?.kind === 'weapon') || (fx?.kind === 'wstar' && fx.id === id) ? ' fx-flash' : ''}" data-wid="${id}"><img src="${iconUrl(id, WEAPONS[id].color)}" alt=""><div><b style="color:${own ? WEAPONS[id].color : 'var(--dim)'}">${esc(WEAPONS[id].name)}</b><span class="lim">${def ? '預設' : '專屬'}</span>${def ? '' : `<span class="stars">${'★'.repeat(star)}${'☆'.repeat(WEAPON_ASCEND.max - star)}</span>`}<div class="d">${own ? esc(WEAPONS[id].desc[0]) : '尚未擁有（從商城的「武器祈燈」取得）'}${!def && (own || shards) ? `<br>星核 ${shards}` : ''}</div></div>
            <div class="wbtns">${on ? '<span class="max">裝備中</span>' : !own ? '' : def ? '<button class="buy" data-act="weaponUnequip">裝備</button>' : `<button class="buy" data-act="weaponEquip" data-id="${id}">裝備</button>`}${!def && own ? `<button class="buy ghostbuy" data-act="wstarOpen" data-id="${id}">進階</button>` : ''}</div></div>`; }).join('')}`;
      }
      const eq = profile.gear.equipped, items = profile.gear.items, pending = profile.gear.pending;
      const isEq = (it) => eq[it.slot] === it.uid;
      $('#gear .equipped').innerHTML = Object.keys(GEAR_SLOTS).map((slot) => {
        const it = items.find((i) => i.uid === eq[slot]);
        return it ? gearTile(it, true, null, fx?.uid === it.uid) : `<div class="gear empty"><span class="slot">${GEAR_SLOTS[slot].name}</span><b>未裝備</b></div>`;
      }).join('');
      const agg = aggregate(profileMods(profile));
      const lines = Object.entries(agg).filter(([, a]) => a.flat || a.pct).map(([stat, a]) => fmtMod({ stat, flat: a.flat, pct: a.pct }));
      $('#gear .summary').textContent = lines.length ? `天賦＋裝備合計：${lines.join('、')}` : '還沒有任何局外加成';
      const auto = autoSalvageLevel(profile);
      $('#gear .autosalv').innerHTML = `<div class="shop-row${fx?.kind === 'auto' ? ' fx-flash' : ''}"><div><b>新裝備自動分解</b><span class="lim">${esc(autoSalvageText(auto))}</span>
        <div class="d">${auto < 0 ? '目前關閉：所有新裝備都會留下，背包滿了就放暫存區。' : `新得到的「${esc(autoSalvageText(auto))}」裝備會直接分解成燈油＋結晶（進階材料），不進背包。`}</div></div>
        <button class="buy" data-act="autoSalvOpen">設定</button></div>`;
      const sorted = (list) => [...list].sort((a, b) => b.rarity - a.rarity || b.lv - a.lv || a.uid - b.uid);
      const space = gearSpace(profile);
      $('#gear .pending').innerHTML = pending.length ? `<div class="sec-title">暫存區 ${pending.length} / ${PENDING_MAX}</div>
        <div class="d">背包滿時，新得到的裝備會先放在這裡，不會被分解。要留哪些、分解哪些，由你決定。</div>
        ${sel ? '' : `<button class="btn small" data-act="pendingClaimAll" ${space.bag ? '' : 'disabled'}>${space.bag ? `收進背包（放得下 ${Math.min(space.bag, pending.length)} 件）` : '背包已滿：先分解一些再收進來'}</button>`}
        <div class="bag">${sorted(pending).map((it) => gearTile(it, false, sel, fx?.uid === it.uid)).join('')}</div>` : '';
      $('#gear .bag-head').innerHTML = sel
        ? `<div class="bag-title">批量分解：點裝備勾選，或依稀有度一次選取</div>
           <div class="pick-tiers">${[0, 1, 2, 3].map((r) => `<button class="chip" data-act="gearPickTier" data-r="${r}" style="--c:${RARITIES[r].color}">${r ? `${RARITIES[r].name}以下` : `只選${RARITIES[0].name}`}</button>`).join('')}<button class="chip" data-act="gearPickTier" data-r="-1">全不選</button><button class="chip" data-act="gearBatchCancel">結束批量</button></div>`
        : `<div class="bag-title">背包 ${items.length} / ${MAX_ITEMS}</div>${items.length || pending.length ? '<button class="chip" data-act="gearBatch">批量分解</button>' : ''}`;
      $('#gear .bag-list').innerHTML = sorted(items).map((it) => gearTile(it, isEq(it), sel, fx?.uid === it.uid)).join('') || '<div class="empty-bag">還沒有裝備。打完一章（或撐過 4 分鐘）會掉落。</div>';
      // 底部的批量列：勾了至少一件才出現（沒勾時不佔位；「結束批量」在上面的選取列）；出現時整頁底部讓出空間，不會蓋住最後一排
      const picked = sel ? [...items, ...pending].filter((it) => sel.has(it.uid) && !isEq(it)) : [];
      $('#gear').classList.toggle('batching', picked.length > 0);
      if (picked.length) {
        const oil = picked.reduce((a, it) => a + salvageValue(it), 0), cry = picked.reduce((a, it) => a + crystalValue(it), 0);
        $('#gear .batch-bar').innerHTML = `<div class="batch-card"><span>已選 <b>${picked.length}</b> 件・燈油 <b>+${num(oil)}</b>・結晶 <b>+${cry}</b></span>
          <button class="btn small" data-act="gearBatchAsk" ${picked.length ? '' : 'disabled'}>分解</button><button class="btn small ghost" data-act="gearBatchCancel">取消</button></div>`;
        $('#gear .batch-bar').classList.add('show');
      } else { $('#gear .batch-bar').innerHTML = ''; $('#gear .batch-bar').classList.remove('show'); }

      const sheet = $('#gear .sheet');
      const bagIt = items.find((i) => i.uid === open), penIt = pending.find((i) => i.uid === open);
      if (sheetKind === 'wstar' && wid && WEAPONS[wid]?.exclusive) {
        const star = profile.weapons.stars?.[wid] || 0, shards = profile.weapons.shards?.[wid] || 0, c = weaponAscendCost(profile, wid);
        sheet.innerHTML = `<div class="sheet-card" style="--c:${WEAPONS[wid].color}"><b class="name">${esc(WEAPONS[wid].name)} 進階 ${star} / ${WEAPON_ASCEND.max}</b>
          <p class="sheet-p">材料：武器祈燈抽到已擁有的專屬武器，會變成那把的「星核」。進階的能力只有<b>裝備這把當起始武器時</b>才生效。</p>
          <ul class="perks">${WEAPON_ASCEND.perks.map((pk, i) => `<li class="${i < star ? 'on' : 'off'}" data-perk="${i + 1}">${i < star ? '✓' : '🔒'} ★${i + 1}　${esc(pk.text)}</li>`).join('')}</ul>
          <p class="sheet-p">${c ? `下一階（★${c.star}）需要星核 ×${c.shards}（你有 ${shards}）` : '已經是最高階'}</p>
          <div class="acts">${c ? `<button class="btn small" data-act="wstarGo" data-id="${wid}" ${shards >= c.shards ? '' : 'disabled'}>進階</button>` : ''}<button class="btn small ghost" data-act="gearClose">關閉</button></div></div>`;
        sheet.classList.add('show');
      } else if (sheetKind === 'auto') {
        sheet.innerHTML = `<div class="sheet-card" style="--c:var(--gold)"><b class="name">新裝備自動分解</b>
          <p class="sheet-p">開啟後，之後新得到的裝備（關卡掉落、祈燈、禮包都算）只要在門檻以下，就直接分解，不進背包也不進暫存區。</p>
          <p class="sheet-p">分解一定會給<b>燈油＋燈芯結晶</b>；結晶是裝備突破的材料，所以自動分解不會浪費進階材料。</p>
          <p class="sheet-p">已經在背包裡的裝備不受影響。<b>史詩與傳說永遠不會被自動分解。</b>預設是關閉。</p>
          <div class="opts">${[-1, ...Array.from({ length: AUTO_SALVAGE_MAX + 1 }, (_, i) => i)].map((lv) => `<button class="opt${lv === auto ? ' on' : ''}" data-act="autoSalvSet" data-r="${lv}">${esc(autoSalvageText(lv))}${lv === -1 ? '（預設）' : ''}${lv === auto ? '<span>目前</span>' : ''}</button>`).join('')}</div>
          <div class="acts"><button class="btn small ghost" data-act="gearClose">關閉</button></div></div>`;
        sheet.classList.add('show');
      } else if (sheetKind === 'batch' && sel) {
        const picked = [...items, ...pending].filter((it) => sel.has(it.uid) && !isEq(it));
        const byR = RARITIES.map((r, i) => [r, picked.filter((it) => it.rarity === i).length]).filter(([, n]) => n);
        const oil = picked.reduce((a, it) => a + salvageValue(it), 0), cry = picked.reduce((a, it) => a + crystalValue(it), 0), high = picked.some((it) => it.rarity >= 3);
        sheet.innerHTML = `<div class="sheet-card" style="--c:${high ? RARITIES[4].color : 'var(--gold)'}"><b class="name">分解 ${picked.length} 件裝備？</b>
          <p class="sheet-p">${byR.map(([r, n]) => `<span style="color:${r.color}">${r.name} ${n}</span>`).join('・')}　→ 燈油 +${num(oil)}、結晶 +${cry}</p>
          ${high ? '<p class="sheet-p warn">包含史詩或傳說裝備，分解後無法復原。</p>' : '<p class="sheet-p">分解後無法復原。裝備中的不會被分解。</p>'}
          <div class="acts"><button class="btn small" data-act="gearBatchGo">確定分解</button><button class="btn small ghost" data-act="gearBatchBack">再想想</button></div></div>`;
        sheet.classList.add('show');
      } else if (bagIt) {
        const it = bagIt, on = isEq(it), cost = it.lv < GEAR_MAX_LV ? gearUpgradeCost(it.rarity, it.lv) : null, f = fx?.uid === it.uid;
        sheet.innerHTML = `<div class="sheet-card${f ? ' fx-flash' : ''}" data-rar="${it.rarity}" style="--c:${RARITIES[it.rarity].color}">
          <b class="name${f && fx.kind === 'up' ? ' fx-bump' : ''}">${esc(gearName(it))}</b><div class="rar">${RARITIES[it.rarity].name}・${GEAR_SLOTS[it.slot].name}・強化 ${it.lv} / ${GEAR_MAX_LV}</div>
          ${statBlock(it, on)}
          ${ascendSection(it, profile, f && fx.kind === 'star')}
          <div class="acts">
            <button class="btn small" data-act="${on ? 'gearUnequip' : 'gearEquip'}" data-uid="${it.uid}">${on ? '卸下' : '裝備'}</button>
            ${cost === null ? '' : `<button class="btn small" data-act="gearUpgrade" data-uid="${it.uid}" ${profile.oil < cost ? 'disabled' : ''}>強化（${num(cost)}）</button>`}
            <button class="btn small ghost" data-act="gearSalvage" data-uid="${it.uid}">分解（+${num(salvageValue(it))} 燈油、+${crystalValue(it)} 結晶）</button>
            <button class="btn small ghost" data-act="gearClose">關閉</button></div></div>`;
        sheet.classList.add('show');
      } else if (penIt) {
        const it = penIt;
        sheet.innerHTML = `<div class="sheet-card" data-rar="${it.rarity}" style="--c:${RARITIES[it.rarity].color}">
          <b class="name">${esc(gearName(it))}</b><div class="rar">${RARITIES[it.rarity].name}・${GEAR_SLOTS[it.slot].name}・在暫存區</div>
          ${statBlock(it, false)}
          <div class="acts">
            <button class="btn small" data-act="pendingClaim" data-uid="${it.uid}" ${space.bag ? '' : 'disabled'}>${space.bag ? '收進背包' : '背包已滿'}</button>
            <button class="btn small ghost" data-act="gearSalvage" data-uid="${it.uid}">分解（+${num(salvageValue(it))} 燈油、+${crystalValue(it)} 結晶）</button>
            <button class="btn small ghost" data-act="gearClose">關閉</button></div></div>`;
        sheet.classList.add('show');
      } else sheet.classList.remove('show');
      if ($('#gear').classList.contains('show')) return; // 已經開著就只重畫內容，不重新淡入
      show('gear');
    },

    // ---- 商城 ----
    // 機率表的每個數字都由 gachaOdds(GACHA) 算出，這裡不准手寫任何百分比（tools/shop-test.mjs 會拿畫面數字和實抽分布比對）。
    // fxId：剛買成功的商品或 'daily'（那一行閃一下）
    shop(profile, now, fxId = null) {
      $('#shop .wallet-slot').innerHTML = wallet(profile);
      const ready = canClaimDaily(profile, now);
      $('#shop .daily').innerHTML = `<div class="sec-title">每日補給</div>
        <div class="shop-row${fxId === 'daily' ? ' fx-flash' : ''}"><div><b>今日補給</b><div class="d">${esc(givesText(DAILY))}（每天一次，免費）</div></div>
        ${ready ? '<button class="buy" data-act="claimDaily">領取</button>' : '<span class="max">今天已領，明天再來</span>'}</div>`;
      const o = gachaOdds(GACHA), top = RARITIES[o.top].name, left = o.pity - profile.gacha.pity;
      const space = gearSpace(profile), auto = autoSalvageLevel(profile);
      const btn = (n) => {
        const pay = gachaPay(profile, n), c = gachaCost(n), fits = space.total >= n;
        const label = pay === 'tickets' ? `用 ${c.tickets} 張祈燈券` : `花 ${num(c.stardust)} 星砂`;
        return `<button class="btn small" data-act="gachaAsk" data-n="${n}" ${pay && fits ? '' : 'disabled'}>${n === 1 ? '祈燈 ×1' : '十連祈燈'}<br><small>${!fits ? '背包與暫存區不夠放' : pay ? label : `需要 ${num(c.stardust)} 星砂或 ${c.tickets} 張券`}</small></button>`;
      };
      // 抽之前就看得到背包空間：背包放不下的會進暫存區（不會分解）；連暫存區都不夠就不能抽
      const spaceLine = `<div class="space${space.bag < 10 ? ' warn' : ''}">背包 ${MAX_ITEMS - space.bag} / ${MAX_ITEMS}・暫存區 ${PENDING_MAX - space.pending} / ${PENDING_MAX}${auto >= 0 ? `・自動分解：${esc(autoSalvageText(auto))}` : ''}
        ${space.total < 10 ? '<br>背包和暫存區快滿了：先到「裝備」畫面整理，才能十連。' : space.bag < 10 ? `<br>背包只剩 ${space.bag} 格：放不下的會先放進暫存區，不會被分解。` : ''}</div>`;
      $('#shop .gacha').innerHTML = `<div class="sec-title">祈燈（抽裝備）</div>
        <table class="odds"><tr><th>稀有度</th><th>單抽機率</th><th>含保底綜合機率</th></tr>
        ${RARITIES.map((r, i) => `<tr data-rarity="${i}"><td style="color:${r.color}">${r.name}</td><td class="odds-base">${fmtPct(o.base[i])}</td><td class="odds-comp">${fmtPct(o.composite[i])}</td></tr>`).join('')}</table>
        <div class="pity">保底：第 <b>${o.pity}</b> 抽必得「${top}」。目前已累積 <b>${profile.gacha.pity}</b> 抽，再 <b>${left}</b> 抽必得。抽到「${top}」後重新計算。</div>
        <div class="d small">機率由遊戲內的機率表直接計算；「綜合機率」是把保底算進去後，長期每一抽的實際機率。</div>
        ${spaceLine}
        <div class="gacha-btns">${btn(1)}${btn(10)}</div>
        <button class="linkish" data-act="toggleSkipAnim">抽獎動畫：${profile.settings.skipAnim ? '略過（點一下改為播放）' : '播放（點一下改為略過）'}</button>`;
      { // 武器祈燈：機率一樣由 gachaOdds(WEAPON_GACHA) 算出，不准手寫
        const w = gachaOdds(WEAPON_GACHA), left = w.pity - profile.gacha.wpity;
        const wbtn = (n) => {
          const pay = gachaPay(profile, n, WEAPON_GACHA), c = gachaCost(n, WEAPON_GACHA);
          const label = pay === 'tickets' ? `用 ${c.tickets} 張祈燈券` : `花 ${num(c.stardust)} 星砂`;
          return `<button class="btn small" data-act="wgachaAsk" data-n="${n}" ${pay ? '' : 'disabled'}>${n === 1 ? '武器祈燈 ×1' : '十連武器祈燈'}<br><small>${pay ? label : `需要 ${num(c.stardust)} 星砂或 ${c.tickets} 張券`}</small></button>`;
        };
        const owned = profile.weapons.owned.length;
        $('#shop .wgacha').innerHTML = `<div class="sec-title">武器祈燈（專屬起始武器）</div>
          <table class="odds"><tr><th>獎項</th><th>單抽機率</th><th>含保底綜合機率</th></tr>
          ${WEAPON_GACHA.outcomes.map((o, i) => `<tr data-rarity="${i}"><td${i === w.top ? ' style="color:#ffc85a"' : ''}>${esc(o.name)}</td><td class="odds-base">${fmtPct(w.base[i])}</td><td class="odds-comp">${fmtPct(w.composite[i])}</td></tr>`).join('')}</table>
          <div class="pity">保底：第 <b>${w.pity}</b> 抽必得專屬武器。目前已累積 <b>${profile.gacha.wpity}</b> 抽，再 <b>${left}</b> 抽必得。</div>
          <div class="d small">抽中「專屬武器」時，從你還沒有的專屬武器中平均選一把（目前擁有 ${owned} / ${EXCLUSIVES.length}）；全部都有了就從三把中平均選一把，變成那把的「星核」（專屬武器的進階材料）。抽到後要到「裝備」畫面裝上才會生效。武器祈燈不會給裝備，不佔背包。</div>
          <div class="gacha-btns">${wbtn(1)}${wbtn(10)}</div>`;
      }
      const packRow = (it) => {
        const chk = canBuy(profile, it.id), bought = profile.shop.bought[it.id] || 0;
        const soldOut = chk.reason === 'limit';
        return `<div class="shop-row${fxId === it.id ? ' fx-flash' : ''}"><div><b>${esc(it.name)}</b>${it.limit ? `<span class="lim">限購 ${it.limit}（已買 ${bought}）</span>` : ''}<div class="d">${esc(it.desc)}${chk.reason === 'space' ? '（背包與暫存區已滿，先整理再買）' : ''}</div></div>
          ${soldOut ? '<span class="max">已購買</span>' : `<button class="buy" data-act="buyAsk" data-id="${it.id}" ${chk.ok ? '' : 'disabled'}>購買<br><small>${esc(priceText(it.price))}</small></button>`}</div>`;
      };
      // 星砂補給：免費、沒有標價、按了直接入帳（沒有確認或結帳步驟）——刻意不做成「一排價位」的儲值商店樣子
      const freeRow = (it) => `<div class="shop-row free${fxId === it.id ? ' fx-flash' : ''}"><div><b>${esc(it.name)}</b><div class="d">${esc(it.desc)}</div></div>
          <button class="buy" data-act="claimFree" data-id="${it.id}">領取<br><small>免費</small></button></div>`;
      $('#shop .packs').innerHTML = `<div class="sec-title">星砂補給</div><div class="d small">隨時可以領，不需要任何東西。</div>${SHOP.filter((x) => x.free).map(freeRow).join('')}
        <div class="sec-title">禮包與兌換</div>${SHOP.filter((x) => !x.free).map(packRow).join('')}`;
      $('#shop .shop-foot').textContent = PAY_NOTE; // 全商城唯一一處說明（擁有者指示：標語拿掉，只留一處不擋路的小字）
      if (!$('#shop').classList.contains('show')) show('shop');
    },
    // m：null / {type:'confirm', title, lines[], act, data, ok} / {type:'done', lines[], gear[]} / {type:'gacha'|'wgacha', results, skip} / {type:'history', entries}
    // confirm 的 lines 可以是字串，或 { text, warn: true }（醒目的警告）
    shopModal(m) {
      const box = $('#shop .modal');
      clearTimeout(revealTimer);
      box.classList.remove('revealed');
      if (!m) { box.classList.remove('show'); box.innerHTML = ''; return; }
      let html = '';
      if (m.type === 'confirm') html = `<h3>${esc(m.title)}</h3>${m.lines.map((l) => typeof l === 'string' ? `<p>${esc(l)}</p>` : `<p class="${l.warn ? 'warn' : ''}">${esc(l.text)}</p>`).join('')}
        <div class="acts"><button class="btn small" data-act="${m.act}" ${Object.entries(m.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(m.ok)}</button><button class="btn small ghost" data-act="shopClose">取消</button></div>`;
      else if (m.type === 'done') html = `<h3>完成</h3>${m.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${(m.gear || []).map(gearLine).join('')}
        <div class="acts"><button class="btn small" data-act="shopClose">好</button></div>`;
      else if (m.type === 'gacha') {
        const pityHit = m.results.some((r) => r.pity), tier = Math.max(0, ...m.results.map((r) => r.rarity));
        const toPending = m.results.filter((r) => r.where === 'pending').length, auto = m.results.filter((r) => r.where === 'auto');
        const cards = m.results.map((r, i) => { const w = whereText({ ...r.item, where: r.where, salvaged: r.salvaged });
          return `<div class="gcard r${r.rarity}" data-rar="${r.rarity}" style="--c:${RARITIES[r.rarity].color};--i:${i}">
          <span class="rn">${RARITIES[r.rarity].name}${r.pity ? '・保底' : ''}</span><b>${esc(gearName(r.item))}</b><span>${esc(fmtMod(gearMods(r.item)[0]))}</span>${w ? `<span class="sv${r.where === 'pending' ? ' pend' : ''}">${esc(w)}</span>` : ''}</div>`; });
        const rv = reveal(cards, tier, RARITIES[tier].color, m.skip);
        html = `<h3>祈燈結果</h3>${rv.html}
          ${pityHit ? '<p>觸發保底，已重新計算。</p>' : ''}
          ${toPending ? `<p class="warn">背包已滿，有 ${toPending} 件放進了暫存區（沒有被分解）。到「裝備」畫面決定要留哪些。</p>` : ''}
          ${auto.length ? `<p>依你的自動分解設定，${auto.length} 件變成燈油 +${num(auto.reduce((a, r) => a + r.salvaged, 0))}。</p>` : ''}
          <div class="acts"><button class="btn small ghost reveal-skip" data-act="revealSkip">跳過動畫</button>${toPending ? '<button class="btn small ghost after-reveal" data-act="gotoGear">前往裝備</button>' : ''}<button class="btn small after-reveal" data-act="shopClose">收下</button></div>`;
      } else if (m.type === 'wgacha') {
        const txt = (r) => r.weapon ? `專屬武器「${WEAPONS[r.weapon].name}」` : r.shard ? `「${WEAPONS[r.shard].name}」星核 +1（已擁有，變成進階材料）` : WEAPON_GACHA.outcomes[r.idx].name;
        const got = m.results.filter((r) => r.weapon), hit = m.results.find((r) => r.weapon || r.shard), col = (r) => WEAPONS[r.weapon || r.shard]?.color;
        const cards = m.results.map((r, i) => `<div class="gcard ${r.weapon || r.shard ? 'r4' : 'r0'}" style="--c:${col(r) ?? '#c9cfe6'};--i:${i}"><span class="rn">${r.pity ? '保底' : ''}</span><b>${esc(txt(r))}</b></div>`);
        const rv = reveal(cards, hit ? 4 : 0, hit ? col(hit) : '#c9cfe6', m.skip);
        html = `<h3>武器祈燈結果</h3>${rv.html}
          ${got.length ? '<p>抽到的專屬武器已放進收藏，<b>到「裝備」畫面裝上才會成為開局武器</b>。</p>' : ''}
          <div class="acts"><button class="btn small ghost reveal-skip" data-act="revealSkip">跳過動畫</button>${got.length ? '<button class="btn small ghost after-reveal" data-act="gotoGear">前往裝備</button>' : ''}<button class="btn small after-reveal" data-act="shopClose">收下</button></div>`;
      } else if (m.type === 'history') html = `<h3>交易紀錄</h3>
        ${m.entries.length ? `<ul class="hist">${m.entries.slice().reverse().map((h) => `<li><span>${new Date(h.t).toLocaleString('zh-Hant')}</span><b>${esc(SHOP.find((x) => x.id === h.id)?.name ?? h.id)}</b></li>`).join('')}</ul>` : '<p>還沒有任何交易。</p>'}
        <div class="acts"><button class="btn small" data-act="shopClose">關閉</button></div>`;
      box.innerHTML = `<div class="modal-card">${html}</div>`;
      box.classList.add('show');
      if ((m.type === 'gacha' || m.type === 'wgacha') && m.skip) box.classList.add('revealed');
      lock();
    },
    revealDone,

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
      r.querySelector('.sub').textContent = win ? `${s.chapter.name}第 ${s.chapter.stage ?? 3} 關的燈塔再次亮起。${summary.firstClear ? '（首次點亮！）' : ''}` : (s.quit ? '你提前撤離了。' : '菌潮吞沒了光……再試一次吧。');
      // 燈核：出現幾顆（精英掉的＋共鳴燈核，不含多出來被收回的）、撿到幾顆——燈核指引有沒有用，自動玩家量不出來，只能看真人玩的這個數字
      const cn = s.counters || {}, shown = (cn.chestsDropped || 0) - (cn.chestsWithdrawn || 0);
      r.querySelector('.stats').innerHTML = [['存活', clock(s.t)], ['擊倒', s.kills], ['等級', s.player.level], ['共鳴', s.player.weapons.filter((w) => w.evo).length || '—'], ['燈核', shown ? `撿到 ${cn.chestsOpened || 0} / 出現 ${shown}` : '—']]
        .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      const pend = summary.drops.filter((it) => it.where === 'pending').length;
      r.querySelector('.ledger').innerHTML = summary.oil.lines.map((l) => `<div><span>${esc(l.label)}</span><b>+${num(l.amount)}</b></div>`).join('')
        + `<div class="total"><span>本局燈油</span><b>+${num(summary.oil.total)}</b></div>`
        + (summary.stardust ? `<div class="total"><span>星砂${summary.firstClear ? '（含首次通關）' : ''}</span><b>+${num(summary.stardust)}</b></div>` : '')
        + (summary.autoSalvage ? `<div class="note"><span>新裝備分解成燈油</span><b>+${num(summary.autoSalvage)}</b></div>` : '')
        + `<div class="note"><span>目前持有</span><b>${num(profile.oil)}</b></div>`;
      r.querySelector('.drops').innerHTML = summary.drops.length
        ? `<div class="drops-title">獲得裝備${pend ? `（背包已滿，${pend} 件放進暫存區，回「裝備」畫面處理）` : ''}</div>${summary.drops.map(gearLine).join('')}`
        : '';
      show('result');
    },
  };
}
