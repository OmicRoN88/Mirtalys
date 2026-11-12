/* ============================================================
   MAIN.JS — Точка входа Мирталиса
   Импортирует модули, инициализирует, вешает обработчики меню
   ============================================================ */

import { $, state, persist } from './modules/core.js';

import {
  updateDateDisplay, fillDateInputs, initDateSelects, initDateHandlers
} from './modules/date.js';

import {
  renderMembers, initSostavHandlers
} from './modules/sostav.js';

import {
  renderBank, renderExpenseInfo, renderExpenses, renderHistory,
  initBankHandlers
} from './modules/bank.js';

import {
  renderWarehouse, initSkladHandlers
} from './modules/sklad.js';

import {
  renderTraders, initTorgovcyHandlers
} from './modules/torgovcy.js';

/* ============================================================
   «МОСТИКИ» ДЛЯ РАЗРЫВА ЦИКЛИЧЕСКИХ ЗАВИСИМОСТЕЙ
   ============================================================ */

// sostav.js вызывает window.__renderBank() после изменений состава
window.__renderBank = renderBank;

// date.js вызывает window.__renderExpenseInfo() после изменения даты
window.__renderExpenseInfo = renderExpenseInfo;

/* ============================================================
   ОТКРЫТИЕ / ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН
   ============================================================ */

function openModal(name) {
  const el = $('modal-' + name);
  if (!el) return;
  el.style.display = 'flex';

  // При открытии вкладки — отрисовываем её содержимое
  if (name === 'members') renderMembers();
  if (name === 'bank') renderBank();
  if (name === 'date') { fillDateInputs(); updateDateDisplay(); }
  if (name === 'history') renderHistory();
  if (name === 'expenses') { renderExpenses(); showError('pay-error', ''); }
  if (name === 'warehouse') { renderWarehouse(); showError('wh-error', ''); }
  if (name === 'traders') { renderTraders(); showError('tr-error', ''); }
}

function closeModal(el) {
  el.style.display = 'none';
}

function showError(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

/* ============================================================
   ОБРАБОТЧИКИ ГЛАВНОГО МЕНЮ
   ============================================================ */

document.querySelectorAll('.main-menu button').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.modal));
});

// Закрытие модальных окон: клик по фону или по крестику
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });
  overlay.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(overlay));
  });
});

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ВСЕХ МОДУЛЕЙ
   ============================================================ */

// Дата
initDateSelects();
initDateHandlers();

// Состав
initSostavHandlers();

// Банк
initBankHandlers();

// Склад
initSkladHandlers();

// Торговцы
initTorgovcyHandlers();

/* ============================================================
   ПЕРВИЧНАЯ ОТРИСОВКА
   ============================================================ */

updateDateDisplay();
renderMembers();
renderBank();
