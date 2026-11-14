/* ============================================================
   STOILA.JS — Логика раздела «Стойла»
   Транспорт, животные, упряжь
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   КОНСТАНТЫ
   ============================================================ */

const CATEGORIES = ['Животное', 'Транспорт', 'Упряжь'];
const CATEGORY_ORDER = { 'Животное': 0, 'Транспорт': 1, 'Упряжь': 2 };

/* ============================================================
   ОТРИСОВКА СПИСКА
   ============================================================ */

export function renderStoila() {
  const list = $('stoila-list');
  if (!list) return;

  const filter = $('stoila-filter').value;

  let items = state.stoila.slice();
  if (filter !== 'all') {
    items = items.filter(i => i.category === filter);
  }

  if (!items.length) {
    list.innerHTML = '<div class="empty">Пока никого нет</div>';
    return;
  }

  // Сортировка: Животное → Транспорт → Упряжь, внутри — по названию
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

    // Грузоподъёмность: для животных — стандартная / с упряжью (×5)
    let capacityStr = '';
    if (item.category === 'Животное' && item.capacity) {
      const std = item.capacity;
      const withHarness = std * 5;
      capacityStr = `${std} / ${withHarness} фунт.`;
    } else if (item.capacity) {
      capacityStr = `${item.capacity} фунт.`;
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
            ${item.speed ? `<span>Скорость: ${item.speed} фт.</span>` : ''}
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
            <label>Грузоподъёмность (фунт.)</label>
            <input type="number" data-field="capacity" data-id="${item.id}" value="${item.capacity || ''}" min="0" step="1">
          </div>
          <div class="field">
            <label>Скорость (фт.)</label>
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

  // ---------- Обработчики ----------

  // Раскрытие/сворачивание
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

  // Статус «Свободно» / «Занято»
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

  // Сохранение
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

  // Удаление
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
   ДОБАВЛЕНИЕ
   ============================================================ */

export function addStoila() {
  const errEl = $('stoila-error');
  if (errEl) errEl.textContent = '';

  const name = $('stoila-name').value.trim();
  const category = $('stoila-category').value;
  const gender = $('stoila-gender').value;
  const nickname = $('stoila-nickname').value.trim();
  const capacity = parseFloat($('stoila-capacity').value) || 0;
  const speed = parseFloat($('stoila-speed').value) || 0;
  const note = $('stoila-note').value;

  if (!name) { if (errEl) errEl.textContent = 'Введите название'; return; }

  state.stoila.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, category, gender, nickname, capacity, speed, note,
    busy: false,
    expanded: false
  });
  persist();

  // Очистка формы
  $('stoila-name').value = '';
  $('stoila-category').value = 'Животное';
  $('stoila-gender').value = '';
  $('stoila-nickname').value = '';
  $('stoila-capacity').value = '';
  $('stoila-speed').value = '';
  $('stoila-note').value = '';

  renderStoila();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initStoilaHandlers() {
  // Фильтр
  const filterSel = $('stoila-filter');
  CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    filterSel.appendChild(opt);
  });
  filterSel.addEventListener('change', renderStoila);

  // Кнопка «Добавить»
  $('btn-add-stoila').addEventListener('click', addStoila);
}
