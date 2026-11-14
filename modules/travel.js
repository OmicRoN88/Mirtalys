/* ============================================================
   TRAVEL.JS — Логика путешествий (Вестмарш)
   ============================================================ */

import { $ } from './core.js';
import * as DATA from './travel-data.js';

/* ============================================================
   БРОСКИ КУБИКОВ
   ============================================================ */

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) total += rollDie(sides);
  return total;
}

export function rollFromExpression(expr) {
  const match = expr.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (!match) return 0;
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const bonus = match[3] ? parseInt(match[3]) : 0;
  return rollDice(count, sides) + bonus;
}

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ============================================================
   ГЕНЕРАЦИЯ СОБЫТИЙ
   ============================================================ */

export function generateEvent(tierMod, regionMod) {
  const roll = rollDie(12);
  const event = DATA.EVENTS.find(e => e.roll === roll);
  if (!event) return null;

  const baseDifficulty = DATA.CONFIG.BASE_DIFFICULTY + tierMod + regionMod;

  if (roll === 12) {
    return {
      roll,
      name: 'Двойной эффект',
      difficulty: 0,
      double: true,
      events: [
        generateSingleEvent(tierMod, regionMod, 1),
        generateSingleEvent(tierMod, regionMod, 1)
      ]
    };
  }

  if (roll === 3) {
    return {
      roll,
      name: 'Погода портится',
      difficulty: baseDifficulty + event.difficulty,
      weather: generateWeather(null)
    };
  }

  if (roll === 7) {
    return {
      roll,
      name: 'Природный катаклизм',
      difficulty: baseDifficulty + event.difficulty,
      cataclysm: generateCataclysm(null, null)
    };
  }

  if (roll === 9) {
    return {
      roll,
      name: 'Ловушка',
      difficulty: baseDifficulty + event.difficulty,
      trap: randomFrom(DATA.TRAPS)
    };
  }

  if (roll === 10) {
    return {
      roll,
      name: 'Странствующий торговец',
      difficulty: baseDifficulty + event.difficulty,
      vendor: randomVendor()
    };
  }

  if (roll === 2) {
    // Лут генерируется отдельно по тиру
    return {
      roll,
      name: event.name,
      difficulty: baseDifficulty + event.difficulty,
      treasure: generateTreasure(Math.min(DATA.CONFIG.TIER_MAX, Math.max(DATA.CONFIG.TIER_MIN, tierMod)))
    };
  }

  return {
    roll,
    name: event.name,
    difficulty: baseDifficulty + event.difficulty,
    short: event.short
  };
}

function generateSingleEvent(tierMod, regionMod, depth) {
  if (depth > DATA.CONFIG.MAX_DOUBLE_DEPTH) return { name: 'Слишком глубоко', difficulty: 0 };
  const roll = rollDie(12);
  const event = DATA.EVENTS.find(e => e.roll === roll);
  const baseDifficulty = DATA.CONFIG.BASE_DIFFICULTY + tierMod + regionMod;

  if (roll === 12) {
    return {
      roll,
      name: 'Двойной эффект',
      difficulty: 0,
      double: true,
      events: [
        generateSingleEvent(tierMod, regionMod, depth + 1),
        generateSingleEvent(tierMod, regionMod, depth + 1)
      ]
    };
  }

  if (roll === 3) {
    return {
      roll,
      name: 'Погода портится',
      difficulty: baseDifficulty + event.difficulty,
      weather: generateWeather(null)
    };
  }

  if (roll === 7) {
    return {
      roll,
      name: 'Природный катаклизм',
      difficulty: baseDifficulty + event.difficulty,
      cataclysm: generateCataclysm(null, null)
    };
  }

  if (roll === 9) {
    return {
      roll,
      name: 'Ловушка',
      difficulty: baseDifficulty + event.difficulty,
      trap: randomFrom(DATA.TRAPS)
    };
  }

  return {
    roll,
    name: event.name,
    difficulty: baseDifficulty + event.difficulty,
    short: event.short
  };
}

/* ============================================================
   ГЕНЕРАЦИЯ ПОГОДЫ
   ============================================================ */

function generateWeather(season) {
  const weatherRoll = rollDie(12);
  const weatherEvent = DATA.WEATHER_EVENTS.find(w => w.roll === weatherRoll);
  if (!weatherEvent) return null;

  if (weatherRoll >= 1 && weatherRoll <= 8) {
    const currentSeason = season || 'Весна';
    const transitions = DATA.SEASON_TRANSITIONS[currentSeason] || DATA.SEASON_TRANSITIONS['Весна'];
    const newSeason = randomFrom(transitions);
    const effect = DATA.SEASON_EFFECTS[newSeason];
    return {
      roll: weatherRoll,
      type: 'Сезонное изменение',
      fromSeason: currentSeason,
      toSeason: newSeason,
      effect,
      short: `Сезон: ${currentSeason} → ${newSeason} (${effect})`
    };
  }

  if (weatherRoll === 9) {
    const r = randomFrom(DATA.FAR_REALM);
    return { roll: 9, type: 'Дальний предел', effect: r.text, short: r.text };
  }
  if (weatherRoll === 10) {
    const r = randomFrom(DATA.INSECTS);
    return { roll: 10, type: 'Кишащая насекомыми область', effect: r.text, short: r.text };
  }
  if (weatherRoll === 11) {
    const r = randomFrom(DATA.MAGIC);
    return { roll: 11, type: 'Расплетённая магия', effect: r.text, short: r.text };
  }
  if (weatherRoll === 12) {
    const r = randomFrom(DATA.RESONANCE);
    return { roll: 12, type: 'Психический резонанс', effect: r.text, short: r.text };
  }

  return null;
}

/* ============================================================
   ГЕНЕРАЦИЯ КАТАКЛИЗМОВ
   ============================================================ */

function generateCataclysm(region, season) {
  const maxAttempts = 100;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const roll = rollDie(23);
    const c = DATA.CATACLYSMS.find(x => x.roll === roll);
    if (!c) continue;
    if (c.region && region && c.region !== region) continue;
    if (c.region && !region) continue;
    if (c.season && season && c.season !== season) continue;
    if (c.season && !season) continue;
    return c;
  }
  return DATA.CATACLYSMS[0];
}

/* ============================================================
   ГЕНЕРАЦИЯ ЛУТА
   ============================================================ */

function generateTreasure(tier) {
  const candidates = DATA.TREASURE_TABLE.filter(t => t.tier === tier);
  if (candidates.length === 0) return null;

  const entry = randomFrom(candidates);
  const items = [];

  let count = 1;
  if (typeof entry.count === 'string') {
    count = rollFromExpression(entry.count);
  } else {
    count = entry.count;
  }

  for (let i = 0; i < count; i++) {
    let item = null;
    switch (entry.table) {
      case 'gems1': item = randomFrom(DATA.GEMS1); break;
      case 'gems2': item = randomFrom(DATA.GEMS2); break;
      case 'gems3': item = randomFrom(DATA.GEMS3); break;
      case 'art1': item = randomFrom(DATA.ART1); break;
      case 'art2': item = randomFrom(DATA.ART2); break;
      case 'scrolls1': item = randomFrom(DATA.SCROLLS1); break;
      case 'scrolls2': item = randomFrom(DATA.SCROLLS2); break;
      case 'scrolls3': item = randomFrom(DATA.SCROLLS3); break;
      case 'coins1': item = randomFrom(DATA.COINS1); break;
      case 'coins2': item = randomFrom(DATA.COINS2); break;
      case 'equip': item = randomFrom(DATA.EQUIPMENT); break;
      case 'trinkets': item = randomFrom(DATA.TRINKETS); break;
      case 'magicCommon': item = randomFrom(DATA.MAGIC_ITEMS_COMMON); break;
      case 'magicUncommon': item = randomFrom(DATA.MAGIC_ITEMS_UNCOMMON); break;
      case 'magicRare': item = randomFrom(DATA.MAGIC_ITEMS_RARE); break;
      default: item = 'Неизвестный предмет';
    }
    items.push(item);
  }

  return {
    roll: entry.roll,
    tier: entry.tier,
    result: entry.result,
    description: entry.desc,
    table: entry.table,
    count,
    items
  };
}

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ
   ============================================================ */

function randomVendor() {
  const vendors = [
    'Манфрэд (бард Мамонт Локсодон)',
    'Ютан (Джин)',
    'Странствующий торговец',
    'Гном-купец',
    'Полурослик-торговец'
  ];
  return randomFrom(vendors);
}

/* ============================================================
   ИНТЕРФЕЙС (ОТРИСОВКА)
   ============================================================ */

export function renderTravel() {
  // При открытии вкладки заполняем селекты
  const regionSel = $('travel-region');
  const tierSel = $('travel-tier');
  if (!regionSel || !tierSel) return;

  // Если ещё не заполнены — заполняем
  if (regionSel.options.length === 0) {
    DATA.REGIONS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.difficulty;
      opt.textContent = r.name;
      regionSel.appendChild(opt);
    });
  }
  if (tierSel.options.length === 0) {
    DATA.TIERS.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.difficulty;
      opt.textContent = t.name;
      tierSel.appendChild(opt);
    });
  }
}

function formatEventHTML(event) {
  if (!event) return '';

  let html = '';

  if (event.double) {
    html += `<div class="mission-detail"><b>Двойной эффект!</b> Бросаем дважды:</div>`;
    event.events.forEach((e, i) => {
      html += `<div style="margin-left: 10px; margin-top: 6px; padding-left: 10px; border-left: 2px solid var(--border);">
        <div class="mission-detail"><b>${i+1}.</b> ${e.name}</div>
        ${e.weather ? `<div class="mission-detail" style="color: var(--warning);">${e.weather.short}</div>` : ''}
        ${e.cataclysm ? `<div class="mission-detail" style="color: var(--error);">${e.cataclysm.name}: ${e.cataclysm.short}</div>` : ''}
        ${e.trap ? `<div class="mission-detail" style="color: var(--error);">Ловушка: ${e.trap.name} (${e.trap.short})</div>` : ''}
        ${e.short && !e.weather && !e.cataclysm && !e.trap ? `<div class="mission-detail">${e.short}</div>` : ''}
      </div>`;
    });
    return html;
  }

  html += `<div class="mission-detail"><b>Событие:</b> ${event.name}</div>`;

  if (event.weather) {
    html += `<div class="mission-detail"><b>Погода:</b> ${event.weather.short}</div>`;
  }
  if (event.cataclysm) {
    html += `<div class="mission-detail"><b>Катаклизм:</b> ${event.cataclysm.name} — ${event.cataclysm.short}</div>`;
  }
  if (event.trap) {
    html += `<div class="mission-detail"><b>Ловушка:</b> ${event.trap.name} — ${event.trap.short}</div>`;
  }
  if (event.vendor) {
    html += `<div class="mission-detail"><b>Торговец:</b> ${event.vendor}</div>`;
  }
  if (event.short) {
    html += `<div class="mission-detail">${event.short}</div>`;
  }

  if (event.treasure) {
    html += `<div class="mission-detail" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
      <b>Сокровище:</b> ${event.treasure.result} ${event.treasure.description} (x${event.treasure.count})
    </div>`;
    event.treasure.items.forEach(it => {
      const label = typeof it === 'string' ? it : it.name;
      const extra = (typeof it === 'object' && it.prop) ? ` — ${it.prop}` : '';
      html += `<div class="mission-detail" style="color: var(--gold);">• ${label}${extra}</div>`;
    });
  }

  return html;
}

export function triggerTravelEvent() {
  const regionSel = $('travel-region');
  const tierSel = $('travel-tier');
  const resultEl = $('travel-result');
  if (!regionSel || !tierSel || !resultEl) return;

  const tierMod = parseInt(tierSel.value, 10) || 1;
  const regionMod = parseInt(regionSel.value, 10) || 1;

  const event = generateEvent(tierMod, regionMod);

  resultEl.style.display = 'block';
  resultEl.innerHTML = formatEventHTML(event);
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initTravelHandlers() {
  const btn = $('btn-trigger-travel');
  if (btn) btn.addEventListener('click', triggerTravelEvent);
}
