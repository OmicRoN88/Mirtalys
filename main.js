/* ============================================================
   MAIN.JS — Точка входа Мирталиса
   ============================================================ */

import { $, getGuildRank } from './modules/core.js';

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

import {
  renderMissions, checkOverdueMissions, initMissionsHandlers
} from './modules/missions.js';

import {
  renderStoila, initStoilaHandlers, chargeFeed
} from './modules/stoila.js';

/* ============================================================
   «МОСТИКИ»
   ============================================================ */

window.__renderBank = renderBank;
window.__renderExpenseInfo = renderExpenseInfo;
window.__renderMissions = renderMissions;
window.__checkOverdueMissions = checkOverdueMissions;
window.__chargeFeed = chargeFeed;

/* ============================================================
   ШАПКА: РАНГ ГИЛЬДИИ
   ============================================================ */

export function renderHeader() {
  const el = $('guild-title');
  if (!el) return;
  const rank = getGuildRank();
  el.innerHTML = `Гильдия <span class="guild-rank">${rank}-ранга</span> «Клинки зари»`;
}

window.__renderHeader = renderHeader;

/* ============================================================
   ОТКРЫТИЕ / ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН
   ============================================================ */

async function openModal(name) {
  const el = $('modal-' + name);
  if (!el) return;
  el.style.display = 'flex';

  if (name === 'members') renderMembers();
  if (name === 'bank') renderBank();
  if (name === 'date') { fillDateInputs(); updateDateDisplay(); }
  if (name === 'history') renderHistory();
  if (name === 'expenses') { renderExpenses(); showError('pay-error', ''); }
  if (name === 'warehouse') { renderWarehouse(); showError('wh-error', ''); }
  if (name === 'traders') { renderTraders(); showError('tr-error', ''); }
  if (name === 'missions') {
    renderMissions();
    await checkOverdueMissions();
  }
  if (name === 'stoila') { renderStoila(); showError('stoila-error', ''); }
}

function closeModal(el) {
  el.style.display = 'none';
}

function showError(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

/* ============================================================
   ОБРАБОТЧИКИ МЕНЮ
   ============================================================ */

document.querySelectorAll('.main-menu button').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.modal));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });
  overlay.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(overlay));
  });
});

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

initDateSelects();
initDateHandlers();
initSostavHandlers();
initBankHandlers();
initSkladHandlers();
initTorgovcyHandlers();
initMissionsHandlers();
initStoilaHandlers();

/* ============================================================
   ПЕРВИЧНАЯ ОТРИСОВКА
   ============================================================ */

updateDateDisplay();
renderHeader();
renderMembers();
renderBank();
