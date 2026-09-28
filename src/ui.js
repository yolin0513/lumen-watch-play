// HTML 介面層：主選單、升級三選一、燈核、暫停、結算。只負責顯示與把點擊轉成 actions。
import { WEAPONS, PASSIVES, RESONANCES } from './content.js';
import { makeIcon } from './art.js';

const $ = (sel) => document.querySelector(sel);
const iconUrl = (id, color) => makeIcon(id, color, 104).toDataURL();
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI(actions) {
  let lockUntil = 0; // 面板剛出現時短暫鎖住點擊，避免移動中的手指誤點
  const lock = () => { lockUntil = performance.now() + 350; };
  document.getElementById('stage').addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || performance.now() < lockUntil) return;
    actions[el.dataset.act]?.(Number(el.dataset.i));
  });

  function show(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
    $('#pauseBtn').style.display = id === null ? 'block' : 'none';
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
  const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  return {
    hud() { show(null); },
    menu() { show('menu'); },
    levelUp(choices) { $('#levelup .cards').innerHTML = choices.map(card).join(''); show('levelup'); },
    chest(result) {
      $('#chest h2').textContent = result.type === 'evo' ? '共鳴覺醒！' : '燈核開啟';
      $('#chest .cards').innerHTML = result.items.map((o) => card(o)).join('');
      show('chest');
    },
    pause(s) { $('#pause .build').innerHTML = buildHtml(s.player); show('pause'); },
    result(s) {
      const win = s.phase === 'win';
      const r = $('#result');
      r.className = 'overlay ' + (win ? 'win' : 'lose');
      r.querySelector('h1').textContent = win ? '燈塔重燃' : '燈火熄滅';
      r.querySelector('.sub').textContent = win ? `${s.chapter.name}的燈塔再次亮起。` : '菌潮吞沒了光……再試一次吧。';
      r.querySelector('.stats').innerHTML = [['存活', clock(s.t)], ['擊倒', s.kills], ['等級', s.player.level], ['共鳴', s.player.weapons.filter((w) => w.evo).length || '—']]
        .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      r.querySelector('.build')?.remove();
      r.querySelector('.stats').insertAdjacentHTML('afterend', `<div class="build">${buildHtml(s.player)}</div>`);
      show('result');
    },
  };
}
