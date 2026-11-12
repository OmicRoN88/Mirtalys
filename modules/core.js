/* ============================================================
   CORE.JS — Фундамент Мирталиса
   Состояние, хранилище, утилиты, экранирование
   ============================================================ */

const STORAGE_KEY = 'mirtalis_state_v1';

// ---------- УТИЛИТЫ ДЛЯ DOM ----------
export const $ = id => document.getElementById(id);

// ---------- ОКРУГЛЕНИЕ ----------
export function floorTenths(x) { return Math.floor(x * 10) / 10; }
export function ceilTenths(x) { return Math.ceil(x * 10) / 10; }
export function roundTenths(x) { return Math.round(x * 10) / 10; }

// ---------- ФОРМАТИРОВАНИЕ ----------
export function formatMoney(n) {
  const r = roundTenths(n);
  if (Number.isInteger(r)) return r + ' ЗМ';
  return r.toFixed(1) + ' ЗМ';
}

export function formatQty(n) {
  const r = roundTenths(n);
  if (Number.isInteger(r)) return r.toString();
  return r.toFixed(1);
}

// ---------- ЭКРАНИРОВАНИЕ ----------
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

export function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

// ---------- СОСТОЯНИЕ ----------
function defaultState() {
  return {
    date: { year: 2926, month: 2, day: 19, hours: 12, minutes: 0 },
    members: [],
    accounts: {},
    unallocatedFunds: 0,
    totals: { commonIncome: 0, commonExpense: 0 },
    history: [],
    expenses: [],
    expensesLastPaidMonth: null,
    expensesLastPaidAmount: 0,
    warehouse: [],
    traders: []
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s.date || !Array.isArray(s.members)) return defaultState();
    if (!s.accounts) s.accounts = {};
    if (typeof s.unallocatedFunds !== 'number') s.unallocatedFunds = 0;
    if (!s.totals) s.totals = { commonIncome: 0, commonExpense: 0 };
    if (!Array.isArray(s.history)) s.history = [];
    if (!Array.isArray(s.expenses)) s.expenses = [];
    if (!s.expensesLastPaidMonth) s.expensesLastPaidMonth = null;
    if (typeof s.expensesLastPaidAmount !== 'number') s.expensesLastPaidAmount = 0;
    if (!Array.isArray(s.warehouse)) s.warehouse = [];
    if (!Array.isArray(s.traders)) s.traders = [];
    s.members.forEach(m => {
      if (typeof m.fired !== 'boolean') m.fired = false;
      if (!m.type) m.type = 'Игрок';
      if (!m.rank) m.rank = '';
      if (!m.position) m.position = '';
      if (!m.status) m.status = '';
      if (!m.statusDate) m.statusDate = null;
      if (!m.info) m.info = '';
      if (!m.expanded) m.expanded = false;
      if (!Array.isArray(m.classes)) m.classes = [];
      if (typeof m.level !== 'number') m.level = 1;
      if (!m.species) m.species = '';
    });
    return s;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ----------
export let state = loadState();

export function persist() {
  saveState(state);
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ АККАУНТОВ ----------
export function ensureAccount(name) {
  if (!state.accounts[name]) {
    state.accounts[name] = { personalIn: 0, personalOut: 0, commonShare: 0, commonExpenseShare: 0 };
  }
  return state.accounts[name];
}

// ---------- КОНСТАНТЫ ----------
export const MONTHS = ['января','февраля','марта','апреля','мая','июня',
                       'июля','августа','сентября','октября','ноября','декабря'];
export const WEEKDAYS = ['Воскресенье','Понедельник','Вторник','Среда',
                         'Четверг','Пятница','Суббота'];
export const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

export const WAREHOUSE_CATEGORIES = ['Оружие', 'Броня', 'Снаряжение', 'Инструменты',
                                    'Ресурсы', 'Пища', 'Расходники', 'Маг. предмет'];
export const WAREHOUSE_UNITS = ['шт.', 'кг', 'л', 'м'];

export const TRADER_CATEGORIES = ['Оружейник', 'Бронник', 'Лекарь', 'Травник', 'Кузнец',
                                  'Ювелир', 'Алхимик', 'Торговец едой', 'Торговец снаряжением',
                                  'Магический торговец', 'Прочее'];

export const CAMPAIGN_START = { year: 2926, month: 2, day: 19 };

export const DND_CLASSES = ['Артефактор', 'Бард', 'Варвар', 'Воин', 'Волшебник',
                            'Друид', 'Жрец', 'Колдун', 'Монах', 'Паладин', 'Плут',
                            'Следопыт', 'Чародей'];

export const DND_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
