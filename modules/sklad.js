/* ============================================================
   SKLAD.JS — Логика раздела «Склад»
   Добавление предметов, фильтр, +/-/удаление
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  formatQty, roundTenths,
  WAREHOUSE_CATEGORIES, WAREHOUSE_UNITS
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   ОТРИСОВКА СКЛАДА
   ============================================================ */

export function renderWarehouse() {
  const filter = $('wh-filter').value;
  const list = $('wh-list');
  if (!list) return;

  let items = state.warehouse.slice();
  if (filter !== 'all') {
    items = items.filter(i => i.category === filter);
  }

  if (!items.length) {
    list.innerHTML = '<div class="empty">Склад пуст</div>';
    return;
  }

  // Группировка по категориям
  const byCategory = {};
  items.forEach(i => {
    if (!byCategory[i.category]) byCategory[i.category] = [];
    byCategory[i.category].push(i);
  });

  let html = '';
  WAREHOUSE_CATEGORIES.forEach(cat => {
    if (!byCategory[cat]) return;
    html += `<div class="wh-category-title">${escapeHtml(cat)}</div>`;
    byCategory[cat].sort((a, b) => a.name.localeCompare(b.name));
    byCategory[cat].forEach(item => {
      const id = item.id;
      html += `
        <div class="wh-item">
          <div>
            <span class="wh-name">${escapeHtml(item.name)}</span>
            <span class="wh-qty">${formatQty(item.quantity)} ${escapeHtml(item.unit)}</span>
          </div>
          <div class="wh-controls">
            <input type="number" min="0" step="0.1" placeholder="Кол-во" data-wh-amount="${id}">
            <button class="success-btn small" data-wh-add="${id}">+</button>
            <button class="danger small" data-wh-remove="${id}">−</button>
            <button class="secondary small" data-wh-delete="${id}">🗑</button>
          </div>
        </div>
      `;
    });
  });

  list.innerHTML = html;

  // ---------- Обработчики ----------

  list.querySelectorAll('[data-wh-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.whAdd;
      const input = list.querySelector(`[data-wh-amount="${cssEscape(id)}"]`);
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) { showError('wh-error', 'Введите количество больше 0'); return; }
      addToWarehouse(id, val);
      input.value = '';
    });
  });

  list.querySelectorAll('[data-wh-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.whRemove;
      const input = list.querySelector(`[data-wh-amount="${cssEscape(id)}"]`);
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) { showError('wh-error', 'Введите количество больше 0'); return; }
      removeFromWarehouse(id, val);
      input.value = '';
    });
  });

  list.querySelectorAll('[data-wh-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.whDelete;
      const item = state.warehouse.find(i => i.id === id);
      if (!item) return;
      const ok = await showConfirm(`Удалить «${item.name}» со склада полностью?`, 'Удалить', 'Отмена');
      if (!ok) return;
      state.warehouse = state.warehouse.filter(i => i.id !== id);
      persist();
      renderWarehouse();
      showError('wh-error', '');
    });
  });
}

/* ============================================================
   ДОБАВЛЕНИЕ НА СКЛАД (кнопка «+»)
   ============================================================ */

export function addToWarehouse(id, amount) {
  const item = state.warehouse.find(i => i.id === id);
  if (!item) return;
  item.quantity = roundTenths(item.quantity + amount);
  persist();
  renderWarehouse();
  showError('wh-error', '');
}

/* ============================================================
   СНЯТИЕ СО СКЛАДА (кнопка «−»)
   ============================================================ */

export async function removeFromWarehouse(id, amount) {
  const item = state.warehouse.find(i => i.id === id);
  if (!item) return;
  const ok = await showConfirm(`Уверены, что хотите взять «${item.name}»?`);
  if (!ok) return;
  if (amount > item.quantity) {
    showError('wh-error', 'На складе недостаточно этого предмета');
    return;
  }
  item.quantity = roundTenths(item.quantity - amount);
  if (item.quantity <= 0.001) {
    state.warehouse = state.warehouse.filter(i => i.id !== id);
  }
  persist();
  renderWarehouse();
  showError('wh-error', '');
}

/* ============================================================
   ДОБАВЛЕНИЕ НОВОГО ПРЕДМЕТА (форма)
   ============================================================ */

export function addNewItem() {
  showError('wh-error', '');
  const name = $('wh-name').value.trim();
  const qty = parseFloat($('wh-qty').value);
  const unit = $('wh-unit').value;
  const category = $('wh-category').value;

  if (!name) { showError('wh-error', 'Введите название'); return; }
  if (isNaN(qty) || qty <= 0) { showError('wh-error', 'Количество должно быть > 0'); return; }

  // Для шт. и м — только целые
  if ((unit === 'шт.' || unit === 'м') && !Number.isInteger(qty)) {
    showError('wh-error', 'Для этой единицы измерения количество должно быть целым');
    return;
  }

  // Если предмет с таким названием и единицей уже есть — суммируем
  const existing = state.warehouse.find(i =>
    i.name.toLowerCase() === name.toLowerCase() && i.unit === unit
  );
  if (existing) {
    existing.quantity = roundTenths(existing.quantity + qty);
  } else {
    state.warehouse.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name, quantity: qty, unit, category
    });
  }
  persist();
  $('wh-name').value = '';
  $('wh-qty').value = '';
  renderWarehouse();
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

export function initSkladHandlers() {
  // Заполняем выпадающие списки категорий
  const catSel = $('wh-category');
  WAREHOUSE_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });

  const filterSel = $('wh-filter');
  WAREHOUSE_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    filterSel.appendChild(opt);
  });

  // Обработчик фильтра
  filterSel.addEventListener('change', renderWarehouse);

  // Обработчик кнопки «Добавить»
  $('btn-add-item').addEventListener('click', addNewItem);
}
