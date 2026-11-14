/* ============================================================
   STOILA.JS — Логика раздела «Стойла»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm } from './dialogi.js';

import { absoluteDay } from './date.js';

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

// Вес транспорта
const TRANSPORT_PRESETS = {
  'Карета': { weight: 100 },
  'Коляска': { weight: 600 },
  'Сани': { weight: 300 },
  'Телега': { weight: 200 },
  'Фургон': { weight: 400 }
};

const FEED_PRICE_COPPER = 5;

/* ============================================================
   КОРМ
   ============================================================ */

function getFreeAnimalsCount() {
  return state.stoila.filter(i => i.category === 'Животное' && !i.busy).length;
}

function getFeedDaysLeft() {
  const animals = getFreeAnimalsCount();
  if (animals === 0) return null;
  if (state.feed <= 0) return 0;
  return Math.floor(state.feed / animals);
}

export function chargeFeed() {
  const freeAnimals = getFreeAnimalsCount();
  if (freeAnimals === 0) return;

  const last = state.feedLastChargedDay;
  const now = state.date;

  if (!last) {
    // Первый запуск — запоминаем день, не списываем
    state.feedLastChargedDay = { year: now.year, month: now.month, day: now.day };
    persist();
    return;
  }

  const diffDays = absoluteDay({ year: now.year, month: now.month, day: now.day }) -
                   absoluteDay({ year: last.year, month: last.month, day: last.day });
  if (diffDays <= 0) return;

  const needed = freeAnimals * diffDays;
  state.feed = Math.max(0, state.feed - needed);
  state.feedLastChargedDay = { year: now.year, month: now.month, day: now.day };
  persist();
}

/* ============================================================
   ОТРИСОВКА КОРМА
   ============================================================ */

function renderFeedBlock() {
  const info = $('stoila-feed-info');
  if (!info) return;

  const free = getFreeAnimalsCount();
  const days = getFeedDaysLeft();
  const feed = state.feed || 0;

  let status = '';
  let statusClass = '';
  if (free === 0) {
    status = 'Не расходуется';
    statusClass = 'feed-idle';
  } else if (feed <= 0) {
    status = 'Корм закончился!';
    statusClass = 'feed-empty';
  } else {
    status = `Хватит на ${days} дн.`;
    statusClass = 'feed-ok';
  }

  info.innerHTML = `
    <div class="feed-row">
      <span>Корм: <b>${feed}</b> ед.</span>
      <span>Свободных животных: <b>${free}</b></span>
      <span class="${statusClass}">${status}</span>
    </div>
    <div class="feed-row" style="margin-top: 6px; gap: 10px;">
      <input type="number" id="stoila-feed-add" min="1" step="1" placeholder="Сколько добавить" style="width: 140px;">
      <button class="small" id="btn-add-feed">Добавить корм</button>
      <span class="hint">1 ед. = 5 медных монет</span>
    </div>
    <div class="error" id="stoila-feed-error"></div>
  `;

  // Обработчик кнопки добавления корма
  const btn = $('btn-add-feed');
  if (btn) {
    btn.addEventListener('click', () => {
      const errEl = $('stoila-feed-error');
      if (errEl) errEl.textContent = '';
      const input = $('stoila-feed-add');
      const val = parseInt(input.value, 10);
      if (isNaN(val) || val <= 0) {
        if (errEl) errEl.textContent = 'Введите количество больше 0';
        return;
      }
      state.feed = (state.feed || 0) + val;
      persist();
      input.value = '';
      renderFeedBlock();
    });
  }
}

/* ============================================================
   ОТРИСОВКА СПИСКА
   ============================================================ */

export function renderStoila() {
  renderFeedBlock();
  renderList();
  renderEquipBlock();
}

function renderList() {
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

    const statusLabel = item.busy ? 'Занято' : 'Свободно';
    const statusClass = item.busy ? 'busy' : 'free';

    let extraStr = '';
    if (item.category === 'Животное') {
      if (item.capacity) extraStr += `<span>Грузоподъёмность: ${item.capacity}</span>`;
      if (item.speed) extraStr += `<span>Скорость: ${item.speed}</span>`;
    }

    const arrow = item.expanded ? '▲' : '▼';

    card.innerHTML = `
      <div class="mc-head" data-stoila-toggle="${item.id}">
        <div>
          <span class="stoila-name">${escapeHtml(item.name)}</span>
          <span class="stoila-category">${escapeHtml(item.category)}</span>
          ${item.nickname ? `<span class="stoila-nickname">«${escapeHtml(item.nickname)}»</span>` : ''}
          <div class="stoila-sub">
            <span class="stoila-status ${statusClass}">${statusLabel}</span>
            ${extraStr}
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
          ${item.category === 'Животное' ? `
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
          ` : `
          <div class="field">
            <label>Вес</label>
            <input type="number" data-field="weight" data-id="${item.id}" value="${item.weight || ''}" min="0" step="1">
          </div>
          `}
        </div>
        <div class="field" style="margin-top: 10px;">
          <label>Примечание</label>
          <textarea data-field="note" data-id="${item.id}" placeholder="...">${escapeHtml(item.note)}</textarea>
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

  // Обработчики
  list.querySelectorAll('[data-stoila-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const item = state.stoila.find(x => x.id === el.dataset.stoilaToggle);
      if (!item) return;
      item.expanded = !item.expanded;
      persist();
      renderList();
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
      const noteEl = list.querySelector(`[data-field="note"][data-id="${cssEscape(id)}"]`);

      if (nameEl) item.name = nameEl.value.trim();
      if (catEl) item.category = catEl.value;
      if (noteEl) item.note = noteEl.value;

      if (item.category === 'Животное') {
        const genderEl = list.querySelector(`[data-field="gender"][data-id="${cssEscape(id)}"]`);
        const nickEl = list.querySelector(`[data-field="nickname"][data-id="${cssEscape(id)}"]`);
        const capEl = list.querySelector(`[data-field="capacity"][data-id="${cssEscape(id)}"]`);
        const spdEl = list.querySelector(`[data-field="speed"][data-id="${cssEscape(id)}"]`);
        if (genderEl) item.gender = genderEl.value;
        if (nickEl) item.nickname = nickEl.value.trim();
        if (capEl) item.capacity = parseFloat(capEl.value) || 0;
        if (spdEl) item.speed = parseFloat(spdEl.value) || 0;
      } else {
        const wEl = list.querySelector(`[data-field="weight"][data-id="${cssEscape(id)}"]`);
        if (wEl) item.weight = parseFloat(wEl.value) || 0;
      }

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

  // Показать/скрыть поля в зависимости от категории
  const animalOnly = document.querySelectorAll('.stoila-animal-only');
  animalOnly.forEach(el => {
    el.style.display = category === 'Животное' ? 'flex' : 'none';
  });
  const transportOnly = document.querySelectorAll('.stoila-transport-only');
  transportOnly.forEach(el => {
    el.style.display = category === 'Транспорт' ? 'flex' : 'none';
  });

  applyPreset();
}

function applyPreset() {
  const catEl = $('stoila-category');
  const nameSel = $('stoila-name-select');
  const capEl = $('stoila-capacity');
  const spdEl = $('stoila-speed');
  const weightEl = $('stoila-weight');
  if (!catEl || !nameSel) return;

  const category = catEl.value;
  const name = nameSel.value;

  if (category === 'Животное' && ANIMAL_PRESETS[name]) {
    if (capEl) capEl.value = ANIMAL_PRESETS[name].capacity;
    if (spdEl) spdEl.value = ANIMAL_PRESETS[name].speed;
    if (weightEl) weightEl.value = '';
  } else if (category === 'Транспорт' && TRANSPORT_PRESETS[name]) {
    if (weightEl) weightEl.value = TRANSPORT_PRESETS[name].weight;
    if (capEl) capEl.value = '';
    if (spdEl) spdEl.value = '';
  } else {
    if (capEl) capEl.value = '';
    if (spdEl) spdEl.value = '';
    if (weightEl) weightEl.value = '';
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
  if (!catEl || !nameSelEl) return;

  const category = catEl.value;
  const nameSel = nameSelEl.value;
  const nameManual = nameManualEl ? nameManualEl.value.trim() : '';

  let name = nameSel;
  if (nameSel === 'Другое') name = nameManual;

  if (!name) { if (errEl) errEl.textContent = 'Введите название'; return; }

  const base = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, category,
    note: $('stoila-note') ? $('stoila-note').value : '',
    busy: false,
    expanded: false
  };

  if (category === 'Животное') {
    base.gender = $('stoila-gender') ? $('stoila-gender').value : '';
    base.nickname = $('stoila-nickname') ? $('stoila-nickname').value.trim() : '';
    base.capacity = $('stoila-capacity') ? (parseFloat($('stoila-capacity').value) || 0) : 0;
    base.speed = $('stoila-speed') ? (parseFloat($('stoila-speed').value) || 0) : 0;
  } else {
    base.weight = $('stoila-weight') ? (parseFloat($('stoila-weight').value) || 0) : 0;
  }

  state.stoila.push(base);
  persist();

  // Очистка
  catEl.value = 'Животное';
  updateNameOptions();
  if ($('stoila-gender')) $('stoila-gender').value = '';
  if ($('stoila-nickname')) $('stoila-nickname').value = '';
  if ($('stoila-capacity')) $('stoila-capacity').value = '';
  if ($('stoila-speed')) $('stoila-speed').value = '';
  if ($('stoila-weight')) $('stoila-weight').value = '';
  if ($('stoila-note')) $('stoila-note').value = '';
  if (nameManualEl) nameManualEl.value = '';

  renderStoila();
}

/* ============================================================
   СНАРЯДИТЬ
   ============================================================ */

function renderEquipBlock() {
  const animalSel = $('equip-animal');
  const transportSel = $('equip-transport');
  if (!animalSel || !transportSel) return;

  const freeAnimals = state.stoila.filter(i => i.category === 'Животное' && !i.busy);
  const freeTransport = state.stoila.filter(i => i.category === 'Транспорт' && !i.busy);

  // Сохраняем текущий выбор
  const curAnimal = animalSel.value;
  const curTransport = transportSel.value;

  animalSel.innerHTML = '<option value="">—</option>';
  freeAnimals.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nickname ? `${a.name} «${a.nickname}»` : a.name;
    animalSel.appendChild(opt);
  });

  transportSel.innerHTML = '<option value="">—</option>';
  freeTransport.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    transportSel.appendChild(opt);
  });

  if (freeAnimals.find(a => a.id === curAnimal)) animalSel.value = curAnimal;
  if (freeTransport.find(t => t.id === curTransport)) transportSel.value = curTransport;

  updateFreeWeight();
}

function updateFreeWeight() {
  const info = $('equip-info');
  if (!info) return;

  const animalSel = $('equip-animal');
  const transportSel = $('equip-transport');
  const extraWeightEl = $('equip-extra-weight');
  if (!animalSel || !transportSel) return;

  const animal = state.stoila.find(a => a.id === animalSel.value);
  const transport = state.stoila.find(t => t.id === transportSel.value);

  if (!animal && !transport) {
    info.style.display = 'none';
    return;
  }

  info.style.display = 'block';
  const extraWeight = extraWeightEl ? (parseFloat(extraWeightEl.value) || 0) : 0;

  let totalCapacity = 0;
  if (animal && animal.capacity) totalCapacity = animal.capacity * 5;

  let transportWeight = 0;
  if (transport && transport.weight) transportWeight = transport.weight;

  const freeWeight = totalCapacity - transportWeight - extraWeight;

  info.innerHTML = `
    <div class="mission-detail"><b>Грузоподъёмность (с упряжью):</b> ${totalCapacity} фунт.</div>
    ${transport ? `<div class="mission-detail"><b>Вес транспорта:</b> ${transportWeight} фунт.</div>` : ''}
    ${extraWeight ? `<div class="mission-detail"><b>Доп. вес:</b> ${extraWeight} фунт.</div>` : ''}
    <div class="mission-detail"><b>Свободный вес:</b> <span style="color: ${freeWeight >= 0 ? 'var(--success)' : 'var(--error)'};">${freeWeight} фунт.</span></div>
  `;
}

function equipSelected() {
  const animalSel = $('equip-animal');
  const transportSel = $('equip-transport');
  if (!animalSel || !transportSel) return;

  const animal = state.stoila.find(a => a.id === animalSel.value);
  const transport = state.stoila.find(t => t.id === transportSel.value);

  if (!animal && !transport) return;

  if (animal) animal.busy = true;
  if (transport) transport.busy = true;

  persist();
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

  // Кнопка «Добавить»
  const btnAdd = $('btn-add-stoila');
  if (btnAdd) btnAdd.addEventListener('click', addStoila);

  // Сворачиваемая секция «Добавить»
  const formHeader = $('stoila-form-header');
  const formBody = $('stoila-form-body');
  const formArrow = $('stoila-form-arrow');
  if (formHeader && formBody && formArrow) {
    formBody.style.display = 'none';
    formArrow.textContent = '▼';
    formHeader.addEventListener('click', () => {
      const isOpen = formBody.style.display !== 'none';
      formBody.style.display = isOpen ? 'none' : 'flex';
      formArrow.textContent = isOpen ? '▼' : '▲';
    });
  }

  // Сворачиваемая секция «Снарядить»
  const equipHeader = $('stoila-equip-header');
  const equipBody = $('stoila-equip-body');
  const equipArrow = $('stoila-equip-arrow');
  if (equipHeader && equipBody && equipArrow) {
    equipBody.style.display = 'none';
    equipArrow.textContent = '▼';
    equipHeader.addEventListener('click', () => {
      const isOpen = equipBody.style.display !== 'none';
      equipBody.style.display = isOpen ? 'none' : 'flex';
      equipArrow.textContent = isOpen ? '▼' : '▲';
    });
  }

  // Снарядить: обновление свободного веса при изменении
  const animalSel = $('equip-animal');
  const transportSel = $('equip-transport');
  const extraWeightEl = $('equip-extra-weight');
  if (animalSel) animalSel.addEventListener('change', updateFreeWeight);
  if (transportSel) transportSel.addEventListener('change', updateFreeWeight);
  if (extraWeightEl) extraWeightEl.addEventListener('input', updateFreeWeight);

  const btnEquip = $('btn-equip');
  if (btnEquip) btnEquip.addEventListener('click', equipSelected);

  // Первичное заполнение
  if (catEl && nameSel) updateNameOptions();
}
