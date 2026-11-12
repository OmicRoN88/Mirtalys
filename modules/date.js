/* ============================================================
   DATE.JS — Логика даты и времени
   Все месяцы по 30 дней, 360 дней в году
   ============================================================ */

import {
  $, state, persist,
  MONTHS, WEEKDAYS, DAYS_IN_MONTH, CAMPAIGN_START
} from './core.js';

/* ============================================================
   ФОРМАТИРОВАНИЕ ДАТЫ
   ============================================================ */

export function formatDate(date) {
  const wd = WEEKDAYS[weekdayIndex(date)];
  const month = MONTHS[date.month - 1];
  const hh = String(date.hours).padStart(2, '0');
  const mm = String(date.minutes).padStart(2, '0');
  return `${wd}, ${date.day} ${month}, ${date.year} год. ${hh}:${mm}`;
}

export function weekdayIndex(date) {
  let y = date.year, m = date.month;
  const d = date.day;
  if (m < 3) { m += 12; y -= 1; }
  const K = y % 100;
  const J = Math.floor(y / 100);
  let h = (d + Math.floor(13 * (m + 1) / 5) + K + Math.floor(K / 4) +
           Math.floor(J / 4) + 5 * J) % 7;
  const map = {0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5};
  return map[h];
}

// Всегда 30 (для совместимости с bank.js, который вызывает daysInMonth)
export function daysInMonth(month) {
  return 30;
}

/* ============================================================
   ТОЧНЫЙ ПОДСЧЁТ ДНЕЙ (30-дневные месяцы)
   ============================================================ */

export function absoluteDay(d) {
  return (d.year - 1) * 360 + (d.month - 1) * 30 + (d.day - 1);
}

export function daysBetween(a, b) {
  return absoluteDay(b) - absoluteDay(a);
}

/* ============================================================
   ИЗМЕНЕНИЕ ДАТЫ
   ============================================================ */

export function addMinutes(date, minutes) {
  const d = { ...date };
  d.minutes += minutes;
  while (d.minutes >= 60) { d.minutes -= 60; d.hours += 1; }
  while (d.hours >= 24) { d.hours -= 24; d.day += 1; }
  while (d.day > 30) {
    d.day -= 30;
    d.month += 1;
    if (d.month > 12) { d.month = 1; d.year += 1; }
  }
  return d;
}

export function nextDayMorning(date) {
  const d = { ...date };
  d.day += 1;
  if (d.day > 30) {
    d.day = 1; d.month += 1;
    if (d.month > 12) { d.month = 1; d.year += 1; }
  }
  d.hours = 7; d.minutes = 0;
  return d;
}

/* ============================================================
   ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ В ШАПКЕ
   ============================================================ */

export function updateDateDisplay() {
  const formatted = formatDate(state.date);
  $('topbar-date').innerHTML = formatted;
  $('date-display-big').textContent = formatted;

  const startStr = `${CAMPAIGN_START.day} ${MONTHS[CAMPAIGN_START.month - 1]}, ${CAMPAIGN_START.year} года`;
  const passed = daysBetween(CAMPAIGN_START, state.date);
  const passedStr = passed >= 0 ? passed : 0;
  $('topbar-start').innerHTML = `Старт кампании: <strong>${startStr}</strong>. Прошло <strong>${passedStr}</strong> дн.`;
}

/* ============================================================
   ЗАПОЛНЕНИЕ ПОЛЕЙ ВВОДА ДАТЫ
   ============================================================ */

export function fillDateInputs() {
  $('set-year').value = state.date.year;
  $('set-month').value = state.date.month;
  $('set-day').value = state.date.day;
  const t = String(state.date.hours).padStart(2,'0') + ':' + String(state.date.minutes).padStart(2,'0');
  $('set-time').value = t;
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ВЫПАДАЮЩИХ СПИСКОВ
   ============================================================ */

export function initDateSelects() {
  const monthSel = $('set-month');
  if (!monthSel) return;
  monthSel.innerHTML = '';
  MONTHS.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m.charAt(0).toUpperCase() + m.slice(1);
    monthSel.appendChild(opt);
  });

  const timeSel = $('set-time');
  if (!timeSel) return;
  timeSel.innerHTML = '';
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const val = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      timeSel.appendChild(opt);
    }
  }
}

/* ============================================================
   ОБРАБОТЧИКИ КНОПОК ДАТЫ
   ============================================================ */

export function initDateHandlers() {
  // +1 час
  $('btn-plus-1h').addEventListener('click', () => {
    state.date = addMinutes(state.date, 60);
    persist();
    updateDateDisplay();
    fillDateInputs();
    if (typeof window.__renderExpenseInfo === 'function') window.__renderExpenseInfo();
  });

  // +2 часа
  $('btn-plus-2h').addEventListener('click', () => {
    state.date = addMinutes(state.date, 120);
    persist();
    updateDateDisplay();
    fillDateInputs();
    if (typeof window.__renderExpenseInfo === 'function') window.__renderExpenseInfo();
  });

  // +6 часов
  $('btn-plus-6h').addEventListener('click', () => {
    state.date = addMinutes(state.date, 360);
    persist();
    updateDateDisplay();
    fillDateInputs();
    if (typeof window.__renderExpenseInfo === 'function') window.__renderExpenseInfo();
  });

  // Следующий день (07:00)
  $('btn-next-day').addEventListener('click', () => {
    state.date = nextDayMorning(state.date);
    persist();
    updateDateDisplay();
    fillDateInputs();
    if (typeof window.__renderExpenseInfo === 'function') window.__renderExpenseInfo();
  });

  // Установить вручную
  $('btn-set-date').addEventListener('click', () => {
    const errEl = $('date-error');
    if (errEl) errEl.textContent = '';

    const year = parseInt($('set-year').value, 10);
    const month = parseInt($('set-month').value, 10);
    const day = parseInt($('set-day').value, 10);
    const time = $('set-time').value;
    const [hh, mm] = time.split(':').map(Number);

    if (!Number.isInteger(year) || year < 1) {
      if (errEl) errEl.textContent = 'Год должен быть ≥ 1';
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      if (errEl) errEl.textContent = 'Месяц от 1 до 12';
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 30) {
      if (errEl) errEl.textContent = 'День должен быть от 1 до 30';
      return;
    }
    state.date = { year, month, day, hours: hh, minutes: mm };
    persist();
    updateDateDisplay();
    fillDateInputs();
    if (typeof window.__renderExpenseInfo === 'function') window.__renderExpenseInfo();
  });
}
