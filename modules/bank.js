/* ============================================================
   BANK.JS — Логика раздела «Банк»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  ensureAccount, formatMoney, roundTenths, floorTenths, ceilTenths,
  MONTHS
} from './core.js';

import { daysInMonth } from './date.js';

import { showConfirm, showPrompt } from './dialogi.js';

import { getPlayers } from './sostav.js';

/* ============================================================
   БАЛАНСЫ
   ============================================================ */

export function getAccountBalance(name) {
  const a = state.accounts[name];
  if (!a) return 0;
  return a.personalIn - a.personalOut + a.commonShare - a.commonExpenseShare;
}

export function getTotalAccounts() {
  let sum = 0;
  for (const name in state.accounts) sum += getAccountBalance(name);
  return sum;
}

export function getBankTotal() {
  return roundTenths(getTotalAccounts() + (state.unallocatedFunds || 0));
}

export function getPositiveTotal() {
  let sum = 0;
  for (const name in state.accounts) {
    const b = getAccountBalance(name);
    if (b > 0) sum += b;
  }
  return sum;
}

/* ============================================================
   ОТРИСОВКА БАНКА
   ============================================================ */

export function renderBank() {
  const total = getBankTotal();
  $('bank-total').textContent = formatMoney(total);
  $('bank-sub').innerHTML =
    `Общих доходов: <span>${formatMoney(state.totals.commonIncome)}</span> · ` +
    `Общих трат: <span>${formatMoney(state.totals.commonExpense)}</span>`;

  renderExpenseInfo();

  const names = new Set();
  state.members.forEach(m => { if (m.type === 'Игрок') names.add(m.name); });
  Object.keys(state.accounts).forEach(n => names.add(n));

  const container = $('bank-players');
  if (!names.size) {
    container.innerHTML = '<div class="empty">Нет игроков в составе</div>';
    return;
  }

  const positiveTotal = getPositiveTotal();

  const arr = Array.from(names).map(name => {
    const member = state.members.find(m => m.name === name);
    const fired = member ? member.fired : true;
    return { name, fired, member };
  });
  arr.sort((a, b) => {
    if (a.fired !== b.fired) return a.fired ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  container.innerHTML = '';
  arr.forEach(({ name, fired }) => {
    const balance = getAccountBalance(name);
    const share = (balance > 0 && positiveTotal > 0) ? (balance / positiveTotal * 100) : 0;
    const limit = Math.max(0, Math.min(balance, total));

    let balanceClass, balanceLabel;
    if (balance > 0) { balanceClass = 'balance-positive'; balanceLabel = 'Счёт'; }
    else if (balance < 0) { balanceClass = 'balance-negative'; balanceLabel = 'Долг'; }
    else { balanceClass = 'balance-zero'; balanceLabel = 'Счёт'; }

    const div = document.createElement('div');
    div.className = 'bank-player' + (fired ? ' fired' : '');
    const statsClass = 'bp-stats ' + balanceClass;

    const controls = !fired
      ? `<div class="bp-controls">
           <input type="number" min="0" step="1" placeholder="Сумма" data-amount="${escapeAttr(name)}">
           <button class="small" data-deposit="${escapeAttr(name)}">Вложить</button>
           <button class="small secondary" data-withdraw="${escapeAttr(name)}">Снять</button>
         </div>`
      : `<div class="bp-controls">
           <button class="danger small" data-remove-account="${escapeAttr(name)}">Убрать</button>
         </div>`;

    div.innerHTML = `
      <div class="bp-head">
        <span class="bp-name">${escapeHtml(name)}${fired ? ' (не в составе)' : ''}</span>
      </div>
      <div class="${statsClass}">
        <span>${balanceLabel}: <b>${formatMoney(balance)}</b></span>
        <span>Доля: <b>${share.toFixed(1)}%</b></span>
        <span>Лимит: <b>${formatMoney(limit)}</b></span>
      </div>
      ${controls}
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('[data-deposit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.deposit;
      const input = container.querySelector(`[data-amount="${cssEscape(name)}"]`);
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) { showError('bank-error', 'Введите сумму больше 0'); return; }
      deposit(name, val);
      input.value = '';
    });
  });

  container.querySelectorAll('[data-withdraw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.withdraw;
      const input = container.querySelector(`[data-amount="${cssEscape(name)}"]`);
      const val = parseFloat(input.value);
      if (isNaN(val) || val <= 0) { showError('bank-error', 'Введите сумму больше 0'); return; }
      withdraw(name, val);
      input.value = '';
    });
  });

  container.querySelectorAll('[data-remove-account]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.removeAccount;
      delete state.accounts[name];
      persist();
      renderBank();
      showError('bank-error', '');
    });
  });
}

/* ============================================================
   ВКЛАД И СНЯТИЕ
   ============================================================ */

export function deposit(name, amount) {
  showError('bank-error', '');
  const acc = ensureAccount(name);
  acc.personalIn = roundTenths(acc.personalIn + amount);
  logHistory(`Игрок ${name} сделал личный вклад ${formatMoney(amount)}`);
  persist();
  renderBank();
}

export async function withdraw(name, amount) {
  showError('bank-error', '');
  const acc = ensureAccount(name);
  const balance = getAccountBalance(name);
  const bank = getBankTotal();
  const limit = Math.max(0, Math.min(balance, bank));

  if (amount > bank) { showError('bank-error',
