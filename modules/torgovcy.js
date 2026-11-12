/* ============================================================
   TORGOVCY.JS — Логика раздела «Торговцы»
   Добавление, фильтры, репутация, удаление
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  TRADER_CATEGORIES
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   ПРОЦЕНТ СКИДКИ/НАДБАВКИ
   ============================================================ */

export function getTraderPercent(rep) {
  return Math.round(rep / 5);
}

/* ============================================================
   ОТРИСОВКА СПИСКА ТОРГОВЦЕВ
   ============================================================ */

export function renderTraders() {
  const filterCity = $('tr-filter-city').value;
  const filterCat = $('tr-filter-category').value;

  updateCityDatalist();

  let items = state.traders.slice();
  if (filterCity !== 'all') items = items.filter(t => t.city === filterCity);
  if (filterCat !== 'all') items = items.filter(t => t.category === filterCat);

  const list = $('tr-list');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = '<div class="empty">Нет торговцев</div>';
    return;
  }

  // Группировка по городам
  const byCity = {};
  items.forEach(t => {
    if (!byCity[t.city]) byCity[t.city] = [];
    byCity[t.city].push(t);
  });

  let html = '';
  Object.keys(byCity).sort().forEach(city => {
    html += `<div class="trader-city-title">${escapeHtml(city)}</div>`;
    byCity[city].sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category);
      if (catCmp !== 0) return catCmp;
      return a.name.localeCompare(b.name);
    });
    byCity[city].forEach(t => {
      const pct = getTraderPercent(t.reputation);
      let discountClass, discountLabel;
      if (pct > 0) { discountClass = 'tc-discount-positive'; discountLabel = `Скидка: −${pct}%`; }
      else if (pct < 0) { discountClass = 'tc-discount-negative'; discountLabel = `Надбавка: +${Math.abs(pct)}%`; }
      else { discountClass = 'tc-discount-zero'; discountLabel = 'Нейтрально'; }

      html += `
        <div class="trader-card">
          <div class="tc-head">
            <span class="tc-name">${escapeHtml(t.name)}<span class="tc-category">${escapeHtml(t.category)}</span></span>
          </div>
          <div class="tc-stats">
            <span>Репутация: <b>${t.reputation}</b></span>
            <span class="${discountClass}">${discountLabel}</span>
          </div>
          <div class="tc-controls">
            <input type="number" min="-100" max="100" step="1" value="${t.reputation}" data-tr-rep="${t.id}">
            <button class="small" data-tr-save="${t.id}">Сохранить</button>
            <button class="danger small" data-tr-delete="${t.id}">Удалить</button>
          </div>
        </div>
      `;
    });
  });

  list.innerHTML = html;

  // ---------- Обработчики ----------

  list.querySelectorAll('[data-tr-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.trSave;
      const input = list.querySelector(`[data-tr-rep="${cssEscape(id)}"]`);
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val < -100 || val > 100) {
        showError('tr-error', 'Репутация должна быть от −100 до +100');
        return;
      }
      const trader = state.traders.find(t => t.id === id);
      if (!trader) return;
      trader.reputation = val;
      persist();
      renderTraders();
      showError('tr-error', '');
    });
  });

  list.querySelectorAll('[data-tr-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.trDelete;
      const trader = state.traders.find(t => t.id === id);
      if (!trader) return;
      const ok = await showConfirm(`Удалить торговца «${trader.name}» (${trader.city})?`, 'Удалить', 'Отмена');
      if (!ok) return;
      state.traders = state.traders.filter(t => t.id !== id);
      persist();
      renderTraders();
      showError('tr-error', '');
    });
  });
}

/* ============================================================
   ОБНОВЛЕНИЕ DATALIST И ФИЛЬТРА ГОРОДОВ
   ============================================================ */

export function updateCityDatalist() {
  const cities = new Set(state.traders.map(t => t.city));

  // Datalist для автодополнения в форме
  const datalist = $('tr-cities-list');
  if (datalist) {
    datalist.innerHTML = Array.from(cities).sort().map(c =>
      `<option value="${escapeAttr(c)}"></option>`
    ).join('');
  }

  // Фильтр городов
  const filterCity = $('tr-filter-city');
  if (filterCity) {
    const current = filterCity.value;
    filterCity.innerHTML = '<option value="all">Все города</option>';
    Array.from(cities).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      filterCity.appendChild(opt);
    });
    if (Array.from(cities).includes(current)) filterCity.value = current;
  }
}

/* ============================================================
   ДОБАВЛЕНИЕ ТОРГОВЦА
   ============================================================ */

export function addTrader() {
  showError('tr-error', '');
  const city = $('tr-city').value.trim();
  const name = $('tr-name').value.trim();
  const category = $('tr-category').value;
  const rep = parseInt($('tr-reputation').value, 10);

  if (!city) { showError('tr-error', 'Введите город'); return; }
  if (!name) { showError('tr-error', 'Введите имя'); return; }
  if (isNaN(rep) || rep < -100 || rep > 100) {
    showError('tr-error', 'Репутация должна быть от −100 до +100');
    return;
  }

  // Проверка на дубликат (город + имя)
  const existing = state.traders.find(t =>
    t.city.toLowerCase() === city.toLowerCase() &&
    t.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    showError('tr-error', 'Торговец с таким именем уже есть в этом городе');
    return;
  }

  state.traders.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    city, name, category, reputation: rep
  });
  persist();
  $('tr-city').value = '';
  $('tr-name').value = '';
  $('tr-reputation').value = '0';
  renderTraders();
}

/* ============================================================
   ВСПОМОГАТЕЛЬНОЕ
   ============================================================ */

function showError(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ВЫПАДАЮЩИХ СПИСКОВ И ОБРАБОТЧИКОВ
   ============================================================ */

export function initTorgovcyHandlers() {
  // Категории в форме добавления
  const catSel = $('tr-category');
  TRADER_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });

  // Категории в фильтре
  const filterCat = $('tr-filter-category');
  TRADER_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    filterCat.appendChild(opt);
  });

  // Обработчики фильтров
  $('tr-filter-city').addEventListener('change', renderTraders);
  $('tr-filter-category').addEventListener('change', renderTraders);

  // Обработчик кнопки «Добавить»
  $('btn-add-trader').addEventListener('click', addTrader);
}
