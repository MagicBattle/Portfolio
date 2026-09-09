import { spriteGif, PROJECT_STOPS } from './data.js';

const BADGES = {
  trio:   ['#e35d5d', 'M12 3l7 12H5z'],
  basic:  ['#8b5cf6', 'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z'],
  insect: ['#3ddc84', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10z'],
  bolt:   ['#ffd23f', 'M13 2L4 14h6l-1 8 9-12h-6z'],
  quake:  ['#d28b4a', 'M4 4h16v16H4z'],
  jet:    ['#4fc3f7', 'M12 2l10 10-10 10L2 12z'],
  freeze: ['#c7ecff', 'M12 2l2.5 5.5L20 8l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z'],
  legend: ['#ff8ac2', 'M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z'],
  wave:   ['#7ad7ff', 'M3 12c3-4 6-4 9 0s6 4 9 0v6c-3 4-6 4-9 0s-6-4-9 0z'],
  toxic:  ['#b46cff', 'M12 2l9 5v10l-9 5-9-5V7z'],
};

export function createUI({ stops, music, goTo, season, phaseLabel, night }) {
  const $ = id => document.getElementById(id);
  const hero = $('hero'), hint = $('hint'), label = $('stop-label'), battle = $('battle'), league = $('league');
  const card = $('card'), badgesEl = $('badges'), count = $('tc-count'), clockEl = $('tc-clock');
  const dialog = $('dialog-line'), mvDemo = $('mv-demo'), mvCode = $('mv-code'), mvPrev = $('mv-prev'), mvNext = $('mv-next');
  const img = $('battle-sprite'), monName = $('battle-mon'), lv = $('battle-lv');
  const got = new Set();
  let moved = false, typing = 0, battleTimer = 0;

  // badges
  PROJECT_STOPS.forEach(s => {
    const [color, d] = BADGES[s.badge];
    const li = document.createElement('li'); li.dataset.id = s.id; li.title = s.project.name;
    li.innerHTML = `<svg viewBox="0 0 24 24"><path d="${d}" fill="${color}" stroke="#0b1024" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    badgesEl.appendChild(li);
  });

  // clock readout
  const moon = night >= 0.55 ? '🌙' : night > 0.2 ? '🌇' : '☀️';
  function tickClock() {
    const d = new Date();
    clockEl.textContent = `${season.toUpperCase()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${moon}`;
  }
  tickClock(); setInterval(tickClock, 30000);

  // sound
  const soundBtn = $('sound');
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', on); soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    music.setEnabled(on);
    try { localStorage.setItem('unova-sound', on ? '1' : '0'); } catch {}
  });
  // first gesture unlocks audio; restore preference
  const unlock = () => { music.unlock(); let pref = null; try { pref = localStorage.getItem('unova-sound'); } catch {} if (pref === '1') soundBtn.click(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock, { once: false }); addEventListener('keydown', unlock, { once: false });

  mvPrev.addEventListener('click', () => goTo(current - 1));
  mvNext.addEventListener('click', () => goTo(current + 1));
  $('restart').addEventListener('click', () => goTo(0));
  let current = 0;

  function type(text, speed = 18) {
    const id = ++typing;
    dialog.textContent = ''; dialog.classList.remove('done');
    let i = 0;
    const step = () => {
      if (id !== typing) return;
      dialog.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, text[i - 1] === '\n' ? 260 : speed);
      else dialog.classList.add('done');
    };
    step();
  }

  function enter(i) {
    current = i;
    const s = stops[i];
    music.play(s.track);
    label.textContent = s.name; label.classList.add('on');
    if (s.kind === 'start') { hero.classList.remove('gone'); return; }
    if (s.kind === 'end') { league.hidden = false; setTimeout(() => league.classList.add('on'), 30); return; }

    const p = s.project;
    clearTimeout(battleTimer);
    document.body.classList.add('in-battle');
    battle.hidden = false; battle.classList.remove('in', 'wipe');
    void battle.offsetWidth; battle.classList.add('wipe');
    img.src = spriteGif(s.mon); img.alt = s.monName;
    monName.textContent = p.name.toUpperCase();
    lv.textContent = String(10 + PROJECT_STOPS.indexOf(s) * 8);
    mvDemo.href = p.demo; mvCode.href = p.code || '#';
    mvCode.setAttribute('aria-disabled', p.code ? 'false' : 'true');
    mvPrev.disabled = i <= 1;
    battleTimer = setTimeout(() => {
      battle.classList.add('in');
      type(`${s.monName.toUpperCase()} guards ${p.name}!\n${p.blurb}`);
      if (!got.has(s.id)) {
        got.add(s.id);
        setTimeout(() => {
          const li = badgesEl.querySelector(`[data-id="${s.id}"]`); li.classList.add('got', 'pop');
          count.textContent = got.size; music.badge();
        }, 1400);
      }
    }, 650);
  }

  function leave(i) {
    const s = stops[i];
    label.classList.remove('on');
    if (s.kind === 'start') hero.classList.add('gone');
    else if (s.kind === 'end') { league.classList.remove('on'); }
    else { typing++; document.body.classList.remove('in-battle'); battle.classList.remove('in'); clearTimeout(battleTimer); battleTimer = setTimeout(() => { battle.hidden = true; battle.classList.remove('wipe'); }, 450); }
  }

  function tick(cur) {
    if (!moved && cur > 0.02) { moved = true; hint.classList.add('gone'); }
  }

  return { enter, leave, tick };
}
