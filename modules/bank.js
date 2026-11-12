/* ============================================================
   BANK.JS — Логика раздела «Банк»
   Вкладчики, общие доходы/траты, история, регулярные расходы
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  ensureAccount, formatMoney, roundTenths, floorTenths, ceilTenths
} from './core.js';

import {
  daysInMonth, MONTHS
} from './date.js';

import { showConfirm, showPrompt } from './dialogi.js';

import { getPlayers } from './sostav.js';

/* ============================================================
   БАЛАНСЫ И СУММЫ
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

  // Список вкладчиков: все игроки из состава + все, у кого есть счёт
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

  // ---------- Обработчики вкладчиков ----------

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

  if (amount > bank) { showError('bank-error', 'В банке недостаточно средств'); return; }

  if (amount > limit) {
    const ok = await showConfirm(`Сумма превышает лимит (${formatMoney(limit)}). Согласовано с игроками?`);
    if (!ok) return;
  }

  acc.personalOut = roundTenths(acc.personalOut + amount);
  logHistory(`Игрок ${name} снял ${formatMoney(amount)}`);
  persist();
  renderBank();
}

/* ============================================================
   ОБЩИЙ ДОХОД
   ============================================================ */

export function commonIncome(amount) {
  showError('bank-error', '');
  const players = getPlayers();
  if (!players.length) { showError('bank-error', 'Нет игроков'); return; }
  if (amount <= 0) { showError('bank-error', 'Сумма должна быть > 0'); return; }

  const per = floorTenths(amount / players.length);
  const distributed = roundTenths(per * players.length);
  const remainder = roundTenths(amount - distributed);

  players.forEach(p => {
    const acc = ensureAccount(p.name);
    acc.commonShare = roundTenths(acc.commonShare + per);
  });
  // Остаток идёт в «нераспределённые средства», чтобы банк вырос на полную сумму
  state.unallocatedFunds = roundTenths((state.unallocatedFunds || 0) + remainder);
  state.totals.commonIncome = roundTenths(state.totals.commonIncome + amount);
  logHistory(`Гильдия пополнила счёт на ${formatMoney(amount)}`);
  persist();
  renderBank();
}

/* ============================================================
   ОБЩАЯ ТРАТА
   ============================================================ */

export function commonExpense(amount) {
  showError('bank-error', '');
  const players = getPlayers();
  if (!players.length) { showError('bank-error', 'Нет игроков'); return; }
  if (amount <= 0) { showError('bank-error', 'Сумма должна быть > 0'); return; }
  const bank = getBankTotal();
  if (amount > bank) { showError('bank-error', 'В банке недостаточно средств'); return; }

  // Округление ВВЕРХ — вкладчики платят чуть больше
  const per = ceilTenths(amount / players.length);
  const charged = roundTenths(per * players.length);
  const excess = roundTenths(charged - amount);

  players.forEach(p => {
    const acc = ensureAccount(p.name);
    acc.commonExpenseShare = roundTenths(acc.commonExpenseShare + per);
  });
  // Компенсация: банк должен уменьшиться ровно на amount
  state.unallocatedFunds = roundTenths((state.unallocatedFunds || 0) + excess);
  state.totals.commonExpense = roundTenths(state.totals.commonExpense + amount);
  logHistory(`Гильдия потратила со счёта ${formatMoney(amount)}`);
  persist();
  renderBank();
}

/* ============================================================
   СБРОС БАНКА
   ============================================================ */

export async function resetBank() {
  const ok = await showConfirm('Сбросить банк полностью? Все счета, долги, общие суммы и история операций будут стёрты. Состав гильдии останется.');
  if (!ok) return;
  state.accounts = {};
  state.unallocatedFunds = 0;
  getPlayers().forEach(p => ensureAccount(p.name));
  state.totals = { commonIncome: 0, commonExpense: 0 };
  state.history = [];
  state.expensesLastPaidMonth = null;
  state.expensesLastPaidAmount = 0;
  persist();
  renderBank();
  showError('bank-error', '');
}

/* ============================================================
   РЕГУЛЯРНЫЕ РАСХОДЫ
   ============================================================ */

export function getMonthlyExpensesTotal() {
  let total = 0;
  state.expenses.forEach(e => {
    total += e.period === 'daily' ? e.amount * 30 : e.amount;
  });
  return roundTenths(total);
}

export function getUnpaidMonths() {
  const d = state.date;
  const p = state.expensesLastPaidMonth;
  if (!p) return 1;
  const diff = (d.year - p.year) * 12 + (d.month - p.month);
  return Math.max(0, diff);
}

export function daysUntilNextMonth() {
  const d = state.date;
  return daysInMonth(d.month) - d.day + 1;
}

export function renderExpenseInfo() {
  const info = $('bank-expense-info');
  if (!info) return;
  const total = getMonthlyExpensesTotal();
  if (total <= 0) {
    info.style.display = 'none';
    info.textContent = '';
    return;
  }
  info.style.display = 'block';

  const unpaid = getUnpaidMonths();
  const daysLeft = daysUntilNextMonth();

  if (unpaid === 0) {
    const remainder = roundTenths(total - (state.expensesLastPaidAmount || 0));
    if (remainder > 0.001) {
      info.className = 'bank-expense-info';
      info.innerHTML = `Необходимо внести <b>${formatMoney(remainder)}</b> на расходы Гильдии в течение <b>${daysLeft}</b> дн.`;
    } else {
      const d = state.date;
      let m = d.month + 1, y = d.year;
      if (m > 12) { m = 1; y += 1; }
      info.className = 'bank-expense-info paid';
      info.innerHTML = `Расходы оплачены до: <span style="color: var(--text); font-weight: 600;">1 ${MONTHS[m - 1]}</span>`;
    }
  } else {
    const debt = roundTenths(total * unpaid);
    info.className = 'bank-expense-info';
    info.innerHTML = `Необходимо внести <b>${formatMoney(debt)}</b> на расходы Гильдии в течение <b>${daysLeft}</b> дн.`;
  }
}

export function renderExpenses() {
  const list = $('expenses-list');
  if (!list) return;
  if (!state.expenses.length) {
    list.innerHTML = '<div class="empty">Нет расходов</div>';
    $('expenses-total').textContent = '0 ЗМ';
    return;
  }
  let total = 0;
  list.innerHTML = state.expenses.map((e, i) => {
    const monthly = e.period === 'daily' ? e.amount * 30 : e.amount;
    total += monthly;
    return `<div class="member-row">
      <div>
        <span class="member-name">${escapeHtml(e.name)}</span>
        <span style="font-size: 0.8rem; color: var(--text-dim); margin-left: 8px;">
          ${formatMoney(e.amount)} ${e.period === 'daily' ? 'в сутки' : 'в месяц'}
        </span>
      </div>
      <button class="danger small" data-del-expense="${i}">Удалить</button>
    </div>`;
  }).join('');
  $('expenses-total').textContent = formatMoney(roundTenths(total));
  list.querySelectorAll('[data-del-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.expenses.splice(parseInt(btn.dataset.delExpense, 10), 1);
      persist();
      renderExpenses();
      renderBank();
    });
  });
}

export function addExpense() {
  showError('expenses-error', '');
  const name = $('expense-name').value.trim();
  const amount = parseFloat($('expense-amount').value);
  const period = $('expense-period').value;
  if (!name) { showError('expenses-error', 'Введите направление'); return; }
  if (isNaN(amount) || amount <= 0) { showError('expenses-error', 'Сумма должна быть > 0'); return; }
  state.expenses.push({ name, amount, period });
  persist();
  $('expense-name').value = '';
  $('expense-amount').value = '';
  renderExpenses();
  renderBank();
}

export async function payExpenses() {
  showError('pay-error', '');
  const total = getMonthlyExpensesTotal();
  if (total <= 0) { showError('pay-error', 'Нет расходов для оплаты'); return; }

  const unpaid = getUnpaidMonths();
  let amountToPay;
  if (unpaid === 0) {
    amountToPay = roundTenths(total - (state.expensesLastPaidAmount || 0));
    if (amountToPay <= 0.001) { showError('pay-error', 'Все расходы уже оплачены'); return; }
  } else {
    amountToPay = roundTenths(total * unpaid);
  }

  const bank = getBankTotal();
  if (amountToPay > bank) { showError('pay-error', 'В банке недостаточно средств'); return; }

  const players = getPlayers();
  if (!players.length) { showError('pay-error', 'Нет игроков для распределения траты'); return; }
  const per = ceilTenths(amountToPay / players.length);
  const charged = roundTenths(per * players.length);
  const excess = roundTenths(charged - amountToPay);

  players.forEach(p => {
    const acc = ensureAccount(p.name);
    acc.commonExpenseShare = roundTenths(acc.commonExpenseShare + per);
  });
  state.unallocatedFunds = roundTenths((state.unallocatedFunds || 0) + excess);
  state.totals.commonExpense = roundTenths(state.totals.commonExpense + amountToPay);

  if (unpaid === 0) {
    state.expensesLastPaidAmount = total;
  } else {
    state.expensesLastPaidMonth = { year: state.date.year, month: state.date.month };
    state.expensesLastPaidAmount = total;
  }

  logHistory(`Гильдия оплатила расходы: ${formatMoney(amountToPay)}`);
  persist();
  renderBank();
  renderExpenses();
  renderExpenseInfo();
}

/* ============================================================
   ИСТОРИЯ
   ============================================================ */

export function logHistory(text) {
  const d = state.date;
  const dateStr = `${d.day} ${MONTHS[d.month - 1]}`;
  state.history.unshift({ date: dateStr, text });
  if (state.history.length > 300) state.history.pop();
  persist();
}

export function renderHistory() {
  const list = $('history-list');
  if (!list) return;
  if (!state.history.length) {
    list.innerHTML = '<div class="empty">История пуста</div>';
    return;
  }
  list.innerHTML = state.history.map(h =>
    `<div class="history-item"><span class="hist-date">${escapeHtml(h.date)}.</span> ${escapeHtml(h.text)}</div>`
  ).join('');
}

/* ============================================================
   ВСПОМОГАТЕЛЬНОЕ
   ============================================================ */

function showError(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || '';
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ
   ============================================================ */

export function initBankHandlers() {
  $('btn-common-income').addEventListener('click', async () => {
    const val = await showPrompt('Сумма общего дохода (ЗМ):');
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    commonIncome(num);
  });

  $('btn-common-expense').addEventListener('click', async () => {
    const val = await showPrompt('Сумма общей траты (ЗМ):');
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    commonExpense(num);
  });

  $('btn-history').addEventListener('click', () => {
    renderHistory();
    $('modal-history').style.display = 'flex';
  });

  $('btn-expenses').addEventListener('click', () => {
    renderExpenses();
    showError('pay-error', '');
    $('modal-expenses').style.display = 'flex';
  });

  $('btn-reset-bank').addEventListener('click', resetBank);
  $('btn-add-expense').addEventListener('click', addExpense);
  $('btn-pay-expenses').addEventListener('click', payExpenses);
}
