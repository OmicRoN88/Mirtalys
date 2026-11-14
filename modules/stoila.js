/* ============================================================
   STOILA.JS — Логика раздела «Стойла»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   КОНСТАНТЫ
   ============================================================ */

const CATEGORIES = ['Животное', 'Транспорт'];
const CATEGORY_ORDER = { 'Животное': 0, 'Транспорт': 1 };

const ANIMAL_NAMES = ['Лошадь тягловая', 'Лошадь ездовая', 'Мул', 'Боевой конь',
                      'Верблюд', 'Слон', 'Пони', 'Топороклюв', 'Другое'];
const TRANSPORT_NAMES = ['Телега', 'Фургон', 'Коляска', 'Карета', 'Сани', 'Другое'];

const ANIMAL_PRESETS = {
  'Боевой конь': { speed: 60, capacity: 540 },
  'Верблюд': { speed: 50, capacity: 480 },
  'Лошадь ездовая': { speed: 60, capacity: 480 },
  'Лошадь тягловая': { speed: 40, capacity: 540 },
  'Мул': { speed: 40, capacity: 420 },
  'Пони': { speed: 40, capacity: 225 },
  'Слон': { speed: 40, capacity: 1320 },
  'Топороклюв': { speed: 50, capacity: 420 }
};

const TRANSPORT_PRESETS = {
  'Карета': { capacity: 100 },
  'Коляска': { capacity: 600 },
  'Сани': { capacity: 300 },
  'Телега': { capacity: 200 },
  'Фургон': { capacity: 400 }
};

/* ============================================================
   ОТРИСОВКА СПИСКА
   ============================================================ */

export function renderStoila() {
  const list = $('stoila-list');
  if (!list) return;

  const filterEl = $('stoila-filter');
  const filter = filterEl ? filterEl.value : 'all';

  let items = state.stoila.slice();
  if (filter !== 'all') {
    items = items.filter(i => i.category === filter);
  }

  if (!items.length) {
    list.innerHTML = '<div class="empty">Пока никого нет</div>';
    return;
  }

  items.sort((a, b) => {
    const oa = CATEGORY_ORDER[a.category] ?? 9;
    const ob = CATEGORY_ORDER[b.category] ?? 9;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  list.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'stoila-card' + (item.busy ? ' busy' : '');

    let capacityStr = '';
    if (item.category === 'Животное' && item.capacity) {
      const std = item.capacity;
      const withHarness = std * 5;
      capacityStr = `${std} / ${withHarness}`;
    } else if (item.capacity) {
      capacityStr = `${item.capacity}`;
    }

    const statusLabel = item.busy ? 'Занято' : 'Свободно';
    const statusClass = item.busy ? 'busy' : 'free';

    const arrow = item.expanded ? '▲' : '▼';

    card.innerHTML = `
      <div class="mc-head" data-stoila-toggle="${item.id}">
        <div>
          <span class="stoila-name">${escapeHtml(item.name)}</span>
          <span class="stoila-category">${escapeHtml(item.category)}</span>
          ${item.nickname ? `<span class="stoila-nickname">«${escapeHtml(item.nickname)}»</span>` : ''}
          <div class="stoila-sub">
            <span class="stoila-status ${statusClass}">${statusLabel}</span>
            ${capacityStr ? `<span>Грузоподъёмность: ${capacityStr}</span>` : ''}
            ${item.speed ? `<span>Скорость: ${item.speed}</span>` : ''}
          </div>
        </div>
        <span class="mc-arrow">${arrow}</span>
      </div>
      <div class="mc-body ${item.expanded ? 'open' : ''}">
        <div class="row">
          <div class="field">
            <label>Название</label>
            <input type="text" data-field="name" data-id="${item.id}" value="${escapeAttr(item.name)}">
          </div>
          <div class="field">
            <label>Категория</label>
            <select data-field="category" data-id="${item.id}">
              ${CATEGORIES.map(c => `<option value="${escapeAttr(c)}" ${c === item.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Пол</label>
            <select data-field="gender" data-id="${item.id}">
              <option value="">—</option>
              <option value="Мужской" ${item.gender === 'Мужской' ? 'selected' : ''}>Мужской</option>
              <option value="Женский" ${item.gender === 'Женский' ? 'selected' : ''}>Женский</option>
            </select>
          </div>
          <div class="field">
            <label>Кличка</label>
            <input type="text" data-field="nickname" data-id="${item.id}" value="${escapeAttr(item.nickname)}" placeholder="Ветерок">
          </div>
          <div class="field">
            <label>Грузоподъёмность</label>
            <input type="number" data-field="capacity" data-id="${item.id}" value="${item.capacity || ''}" min="0" step="1">
          </div>
          <div class="field">
            <label>Скорость</label>
            <input type="number" data-field="speed" data-id="${item.id}" value="${item.speed || ''}" min="0" step="1">
          </div>
        </div>
        <div class="field" style="margin-top: 10px;">
          <label>Примечание</label>
          <textarea data-field="note" data-id="${item.id}" placeholder="Нашли её в поле. Сильно голодала...">${escapeHtml(item.note)}</textarea>
        </div>
        <div class="stoila-actions">
          <button class="success-btn small" data-set-free="${item.id}">Свободно</button>
          <button class="warn small" data-set-busy="${item.id}">Занято</button>
          <button class="small" data-save="${item.id}">Сохранить</button>
          <button class="danger small" data-delete="${item.id}">Удалить</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-stoila-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const item = state.stoila.find(x => x.id === el.dataset.stoilaToggle);
      if (!item) return;
      item.expanded = !item.expanded;
      persist();
      renderStoila();
    });
  });

  list.querySelectorAll('[data-set-free]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.stoila.find(x => x.id === btn.dataset.setFree);
      if (!item) return;
      item.busy = false;
      persist();
      renderStoila();
    });
  });
  list.querySelectorAll('[data-set-busy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.stoila.find(x => x.id === btn.dataset.setBusy);
      if (!item) return;
      item.busy = true;
      persist();
      renderStoila();
    });
  });

  list.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.save;
      const item = state.stoila.find(x => x.id === id);
      if (!item) return;

      const nameEl = list.querySelector(`[data-field="name"][data-id="${cssEscape(id)}"]`);
      const catEl = list.querySelector(`[data-field="category"][data-id="${cssEscape(id)}"]`);
      const genderEl = list.querySelector(`[data-field="gender"][data-id="${cssEscape(id)}"]`);
      const nickEl = list.querySelector(`[data-field="nickname"][data-id="${cssEscape(id)}"]`);
      const capEl = list.querySelector(`[data-field="capacity"][data-id="${cssEscape(id)}"]`);
      const spdEl = list.querySelector(`[data-field="speed"][data-id="${cssEscape(id)}"]`);
      const noteEl = list.querySelector(`[data-field="note"][data-id="${cssEscape(id)}"]`);

      if (nameEl) item.name = nameEl.value.trim();
      if (catEl) item.category = catEl.value;
      if (genderEl) item.gender = genderEl.value;
      if (nickEl) item.nickname = nickEl.value.trim();
      if (capEl) item.capacity = parseFloat(capEl.value) || 0;
      if (spdEl) item.speed = parseFloat(spdEl.value) || 0;
      if (noteEl) item.note = noteEl.value;

      persist();
      renderStoila();
    });
  });

  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete;
      const item = state.stoila.find(x => x.id === id);
      if (!item) return;
      const ok = await showConfirm(`Удалить «${item.name}${item.nickname ? ' (' + item.nickname + ')' : ''}»?`, 'Удалить', 'Отмена');
      if (!ok) return;
      state.stoila = state.stoila.filter(x => x.id !== id);
      persist();
      renderStoila();
    });
  });
}

/* ============================================================
   ФОРМА
   ============================================================ */

function updateNameOptions() {
  const catEl = $('stoila-category');
  const nameSel = $('stoila-name-select');
  const nameManual = $('stoila-name-manual');
  const nameManualWrapper = $('stoila-name-manual-wrapper');
  if (!catEl || !nameSel) return;

  const category = catEl.value;
  let names = [];
  if (category === 'Животное') names = ANIMAL_NAMES;
  else if (category === 'Транспорт') names = TRANSPORT_NAMES;

  nameSel.innerHTML = '';
  names.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    nameSel.appendChild(opt);
  });

  if (nameManualWrapper && nameManual) {
    if (names.includes('Другое')) {
      const isOther = nameSel.value === 'Другое';
      nameManualWrapper.style.display = isOther ? 'flex' : 'none';
      if (!isOther) nameManual.value = '';
    } else {
      nameManualWrapper.style.display = 'none';
      nameManual.value = '';
    }
  }

  applyPreset();
}

function applyPreset() {
  const catEl = $('stoila-category');
  const nameSel = $('stoila-name-select');
  const capEl = $('stoila-capacity');
  const spdEl = $('stoila-speed');
  if (!catEl || !nameSel || !capEl || !spdEl) return;

  const category = catEl.value;
  const name = nameSel.value;

  if (category === 'Животное' && ANIMAL_PRESETS[name]) {
    capEl.value = ANIMAL_PRESETS[name].capacity;
    spdEl.value = ANIMAL_PRESETS[name].speed;
  } else if (category === 'Транспорт' && TRANSPORT_PRESETS[name]) {
    capEl.value = TRANSPORT_PRESETS[name].capacity;
    spdEl.value = '';
  } else {
    capEl.value = '';
    spdEl.value = '';
  }
}

/* ============================================================
   ДОБАВЛЕНИЕ
   ============================================================ */

export function addStoila() {
  const errEl = $('stoila-error');
  if (errEl) errEl.textContent = '';

  const catEl = $('stoila-category');
  const nameSelEl = $('stoila-name-select');
  const nameManualEl = $('stoila-name-manual');
  const genderEl = $('stoila-gender');
  const nickEl = $('stoila-nickname');
  const capEl = $('stoila-capacity');
  const spdEl = $('stoila-speed');
  const noteEl = $('stoila-note');

  if (!catEl || !nameSelEl) return;

  const category = catEl.value;
  const nameSel = nameSelEl.value;
  const nameManual = nameManualEl ? nameManualEl.value.trim() : '';

  let name = nameSel;
  if (nameSel === 'Другое') name = nameManual;

  const gender = genderEl ? genderEl.value : '';
  const nickname = nickEl ? nickEl.value.trim() : '';
  const capacity = capEl ? (parseFloat(capEl.value) || 0) : 0;
  const speed = spdEl ? (parseFloat(spdEl.value) || 0) : 0;
  const note = noteEl ? noteEl.value : '';

  if (!name) { if (errEl) errEl.textContent = 'Введите название'; return; }

  state.stoila.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, category, gender, nickname, capacity, speed, note,
    busy: false,
    expanded: false
  });
  persist();

  // Очистка формы
  catEl.value = 'Животное';
  updateNameOptions();
  if (genderEl) genderEl.value = '';
  if (nickEl) nickEl.value = '';
  if (capEl) capEl.value = '';
  if (spdEl) spdEl.value = '';
  if (noteEl) noteEl.value = '';
  if (nameManualEl) nameManualEl.value = '';

  renderStoila();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initStoilaHandlers() {
  // Фильтр
  const filterSel = $('stoila-filter');
  if (filterSel) {
    CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      filterSel.appendChild(opt);
    });
    filterSel.addEventListener('change', renderStoila);
  }

  // Категория → список названий
  const catEl = $('stoila-category');
  if (catEl) catEl.addEventListener('change', updateNameOptions);

  // Список названий → пресет
  const nameSel = $('stoila-name-select');
  if (nameSel) {
    nameSel.addEventListener('change', () => {
      const wrapper = $('stoila-name-manual-wrapper');
      const manual = $('stoila-name-manual');
      if (wrapper) {
        if (nameSel.value === 'Другое') {
          wrapper.style.display = 'flex';
        } else {
          wrapper.style.display = 'none';
          if (manual) manual.value = '';
        }
      }
      applyPreset();
    });
  }

  // Кнопка «Добавить» (внутри формы)
  const btnAdd = $('btn-add-stoila');
  if (btnAdd) btnAdd.addEventListener('click', addStoila);

  // Сворачиваемая секция «Добавить»
  const formHeader = $('stoila-form-header');
  const formBody = $('stoila-form-body');
  const formArrow = $('stoila-form-arrow');
  if (formHeader && formBody && formArrow) {
    // По умолчанию свёрнута
    formBody.style.display = 'none';
    formArrow.textContent = '▼';

    formHeader.addEventListener('click', () => {
      const isOpen = formBody.style.display !== 'none';
      formBody.style.display = isOpen ? 'none' : 'flex';
      formArrow.textContent = isOpen ? '▼' : '▲';
    });
  }

  // Первичное заполнение (только если элементы есть)
  if (catEl && nameSel) updateNameOptions();
}
