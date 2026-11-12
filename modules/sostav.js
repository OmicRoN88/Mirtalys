/* ============================================================
   SOSTAV.JS — Логика раздела «Состав»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  ensureAccount, formatMoney,
  MONTHS
} from './core.js';

import {
  daysBetween, daysInMonth
} from './date.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

export function getPlayers() {
  return state.members.filter(m => m.type === 'Игрок' && !m.fired);
}

/* ============================================================
   ОТРИСОВКА СПИСКА УЧАСТНИКОВ
   ============================================================ */

export function renderMembers() {
  const list = $('members-list');
  if (!list) return;

  if (!state.members.length) {
    list.innerHTML = '<div class="empty">Пока никого нет</div>';
    return;
  }

  const sorted = [...state.members].sort((a, b) => {
    const groupA = (a.fired ? 2 : 0) + (a.type === 'Игрок' ? 0 : 1);
    const groupB = (b.fired ? 2 : 0) + (b.type === 'Игрок' ? 0 : 1);
    if (groupA !== groupB) return groupA - groupB;
    return a.name.localeCompare(b.name);
  });

  list.innerHTML = '';
  sorted.forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-card' + (m.fired ? ' fired' : '');

    const roleLabel = m.fired ? 'Уволен' : m.type;
    const titles = [];
    if (m.rank) titles.push(`<span>Звание: ${escapeHtml(m.rank)}</span>`);
    if (m.position) titles.push(`<span>Профессия: ${escapeHtml(m.position)}</span>`);

    let statusHtml = '';
    if (m.status && m.statusDate) {
      const diff = daysBetween(m.statusDate, state.date);
      const diffAbs = Math.abs(diff);
      if (diff >= 0) {
        statusHtml = `<div class="mc-status past">${escapeHtml(m.status)} — ${diffAbs} дн. назад</div>`;
      } else {
        statusHtml = `<div class="mc-status future">${escapeHtml(m.status)} — через ${diffAbs} дн.</div>`;
      }
    } else if (m.status) {
      statusHtml = `<div class="mc-status">${escapeHtml(m.status)}</div>`;
    }

    const arrow = m.expanded ? '▲' : '▼';

    card.innerHTML = `
      <div class="mc-head" data-toggle="${m.id}">
        <div>
          <span class="mc-name">${escapeHtml(m.name)}</span>
          <span class="mc-role ${m.type === 'Игрок' ? 'player' : 'npc'}">${roleLabel}</span>
          ${titles.length ? `<div class="mc-titles">${titles.join('')}</div>` : ''}
          ${statusHtml}
        </div>
        <span class="mc-arrow">${arrow}</span>
      </div>
      <div class="mc-body ${m.expanded ? 'open' : ''}" id="body-${m.id}">
        <div class="row">
          <div class="field">
            <label>Звание</label>
            <input type="text" data-field="rank" data-id="${m.id}" value="${escapeAttr(m.rank)}" placeholder="Например, Капитан">
          </div>
          <div class="field">
            <label>Профессия</label>
            <input type="text" data-field="position" data-id="${m.id}" value="${escapeAttr(m.position)}" placeholder="Например, Управляющий">
          </div>
        </div>
        <div class="row">
          <div class="field" style="grid-column: span 2;">
            <label>Статус</label>
            <input type="text" data-field="status" data-id="${m.id}" value="${escapeAttr(m.status)}" placeholder="Например, Пропал">
          </div>
          <div class="field">
            <label>Год</label>
            <input type="number" data-field="statusYear" data-id="${m.id}" value="${m.statusDate ? m.statusDate.year : ''}" min="1" placeholder="2926">
          </div>
          <div class="field">
            <label>Месяц</label>
            <select data-field="statusMonth" data-id="${m.id}">
              <option value="">—</option>
              ${MONTHS.map((mn, i) => `<option value="${i+1}" ${m.statusDate && m.statusDate.month === i+1 ? 'selected' : ''}>${mn}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>День</label>
            <input type="number" data-field="statusDay" data-id="${m.id}" value="${m.statusDate ? m.statusDate.day : ''}" min="1" max="31" placeholder="19">
          </div>
        </div>
        <div class="field" style="margin-top: 10px;">
          <label>Краткая информация</label>
          <textarea data-field="info" data-id="${m.id}" placeholder="Возраст, происхождение, особенности...">${escapeHtml(m.info)}</textarea>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="small" data-save="${m.id}">Сохранить</button>
          ${m.fired
            ? `<button class="success-btn small" data-hire="${m.id}">Нанять</button>
               <button class="danger small" data-delete="${m.id}">Удалить</button>`
            : `<button class="danger small" data-fire="${m.id}">Уволить</button>`}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const m = state.members.find(x => x.id === el.dataset.toggle);
      if (!m) return;
      m.expanded = !m.expanded;
      persist();
      renderMembers();
    });
  });

  list.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.save;
      const m = state.members.find(x => x.id === id);
      if (!m) return;
      m.rank = list.querySelector(`[data-field="rank"][data-id="${cssEscape(id)}"]`).value.trim();
      m.position = list.querySelector(`[data-field="position"][data-id="${cssEscape(id)}"]`).value.trim();
      m.status = list.querySelector(`[data-field="status"][data-id="${cssEscape(id)}"]`).value.trim();
      m.info = list.querySelector(`[data-field="info"][data-id="${cssEscape(id)}"]`).value;
      const y = parseInt(list.querySelector(`[data-field="statusYear"][data-id="${cssEscape(id)}"]`).value, 10);
      const mo = parseInt(list.querySelector(`[data-field="statusMonth"][data-id="${cssEscape(id)}"]`).value, 10);
      const d = parseInt(list.querySelector(`[data-field="statusDay"][data-id="${cssEscape(id)}"]`).value, 10);
      if (y && mo && d) {
        m.statusDate = { year: y, month: mo, day: d };
      } else {
        m.statusDate = null;
      }
      persist();
      renderMembers();
    });
  });

  list.querySelectorAll('[data-fire]').forEach(btn => {
    btn.addEventListener('click', () => fireMember(btn.dataset.fire));
  });
  list.querySelectorAll('[data-hire]').forEach(btn => {
    btn.addEventListener('click', () => hireMember(btn.dataset.hire));
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteMember(btn.dataset.delete));
  });
}

/* ============================================================
   ДОБАВЛЕНИЕ УЧАСТНИКА
   ============================================================ */

export function addMember(name, type) {
  const errEl = $('members-error');
  if (errEl) errEl.textContent = '';

  name = name.trim();
  if (!name) {
    if (errEl) errEl.textContent = 'Введите имя';
    return;
  }

  const existing = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (existing.fired) {
      existing.fired = false;
      existing.type = type;
      persist();
      $('member-name').value = '';
      renderMembers();
      if (typeof window.__renderBank === 'function') window.__renderBank();
      return;
    }
    if (errEl) errEl.textContent = 'Персонаж с таким именем уже есть';
    return;
  }

  state.members.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, type, fired: false,
    rank: '', position: '', status: '', statusDate: null, info: '', expanded: false
  });
  if (type === 'Игрок') ensureAccount(name);
  persist();
  $('member-name').value = '';
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
}

/* ============================================================
   УВОЛЬНЕНИЕ
   ============================================================ */

export async function fireMember(id) {
  const idx = state.members.findIndex(m => m.id === id);
  if (idx === -1) return;
  const m = state.members[idx];

  let balance = 0;
  if (state.accounts[m.name]) {
    const a = state.accounts[m.name];
    balance = a.personalIn - a.personalOut + a.commonShare - a.commonExpenseShare;
  }

  const ok = await showConfirm(`Уволить сотрудника «${m.name}»?`);
  if (!ok) return;

  if (m.type === 'Игрок' && balance !== 0) {
    const give = await showConfirm(`У сотрудника вклад в банке: ${formatMoney(balance)}. Выдать?`);
    if (give) {
      ensureAccount(m.name).personalIn -= balance;
    }
  }

  m.fired = true;
  persist();
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
}

/* ============================================================
   ВОССТАНОВЛЕНИЕ
   ============================================================ */

export function hireMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  m.fired = false;
  if (m.type === 'Игрок') ensureAccount(m.name);
  persist();
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
}

/* ============================================================
   ОКОНЧАТЕЛЬНОЕ УДАЛЕНИЕ
   ============================================================ */

export async function deleteMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  const ok = await showConfirm(`Удалить «${m.name}» навсегда? Это действие необратимо.`, 'Удалить', 'Отмена');
  if (!ok) return;

  state.members = state.members.filter(x => x.id !== id);
  persist();
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ
   ============================================================ */

export function initSostavHandlers() {
  $('btn-add-member').addEventListener('click', () => {
    addMember($('member-name').value, $('member-type').value);
  });

  $('member-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-add-member').click();
  });
}
