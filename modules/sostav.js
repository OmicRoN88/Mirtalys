/* ============================================================
   SOSTAV.JS — Логика раздела «Состав»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  ensureAccount, formatMoney,
  MONTHS, DND_CLASSES, DND_LEVELS
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

// Формирование строки «Звание: X. Вид. Класс(ы). N уровень. Профессия: Y»
function buildMemberSubtitle(m) {
  const parts = [];

  if (m.rank) parts.push(`Звание: ${m.rank}`);

  if (m.species) parts.push(m.species);

  if (m.classes && m.classes.length) {
    parts.push(m.classes.join('/'));
  }

  if (m.level) {
    parts.push(`${m.level} уровень`);
  }

  if (m.position) parts.push(`Профессия: ${m.position}`);

  return parts.join('. ');
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
    const subtitle = buildMemberSubtitle(m);

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

    // Классы для раскрытой карточки
    const c1 = (m.classes && m.classes[0]) ? m.classes[0] : '';
    const c2 = (m.classes && m.classes[1]) ? m.classes[1] : '';

    // Опции для селектов классов
    const classOptions = DND_CLASSES.map(c =>
      `<option value="${escapeAttr(c)}" ${c === c1 ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    const classOptions2 = DND_CLASSES.map(c =>
      `<option value="${escapeAttr(c)}" ${c === c2 ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    const levelOptions = DND_LEVELS.map(l =>
      `<option value="${l}" ${l === m.level ? 'selected' : ''}>${l}</option>`
    ).join('');

    card.innerHTML = `
      <div class="mc-head" data-toggle="${m.id}">
        <div>
          <span class="mc-name">${escapeHtml(m.name)}</span>
          <span class="mc-role ${m.type === 'Игрок' ? 'player' : 'npc'}">${roleLabel}</span>
          ${subtitle ? `<div class="mc-titles"><span>${escapeHtml(subtitle)}</span></div>` : ''}
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
          <div class="field">
            <label>Вид</label>
            <input type="text" data-field="species" data-id="${m.id}" value="${escapeAttr(m.species)}" placeholder="Человек, эльф, орк...">
          </div>
          <div class="field">
            <label>Уровень</label>
            <select data-field="level" data-id="${m.id}">
              ${levelOptions}
            </select>
          </div>
        </div>
        <div class="row">
          <div class="field" style="grid-column: span 2;">
            <label>Класс</label>
            <div class="class-row">
              <select data-field="class1" data-id="${m.id}">
                <option value="">—</option>
                ${classOptions}
              </select>
              <button type="button" class="small class-toggle" data-add-class="${m.id}" title="Добавить второй класс">+</button>
            </div>
          </div>
          <div class="field class-second ${c2 ? '' : 'hidden'}" data-class2-wrapper="${m.id}" style="grid-column: span 2;">
            <label>Второй класс</label>
            <div class="class-row">
              <select data-field="class2" data-id="${m.id}">
                <option value="">—</option>
                ${classOptions2}
              </select>
              <button type="button" class="small danger class-toggle" data-remove-class="${m.id}" title="Убрать второй класс">−</button>
            </div>
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

  // ---------- Обработчики ----------

  // Раскрытие/сворачивание
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

  // Кнопка «+» — добавить второй класс
  list.querySelectorAll('[data-add-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.addClass;
      const m = state.members.find(x => x.id === id);
      if (!m) return;
      if (!Array.isArray(m.classes)) m.classes = [];
      if (m.classes.length < 2) {
        // Добавляем пустой второй класс (пользователь выберет)
        m.classes[1] = '';
        persist();
        renderMembers();
      }
    });
  });

  // Кнопка «−» — убрать второй класс
  list.querySelectorAll('[data-remove-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.removeClass;
      const m = state.members.find(x => x.id === id);
      if (!m) return;
      if (Array.isArray(m.classes) && m.classes.length > 1) {
        m.classes = [m.classes[0]];
        persist();
        renderMembers();
      }
    });
  });

  // Сохранение
  list.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.save;
      const m = state.members.find(x => x.id === id);
      if (!m) return;

      m.rank = list.querySelector(`[data-field="rank"][data-id="${cssEscape(id)}"]`).value.trim();
      m.position = list.querySelector(`[data-field="position"][data-id="${cssEscape(id)}"]`).value.trim();
      m.species = list.querySelector(`[data-field="species"][data-id="${cssEscape(id)}"]`).value.trim();
      m.status = list.querySelector(`[data-field="status"][data-id="${cssEscape(id)}"]`).value.trim();
      m.info = list.querySelector(`[data-field="info"][data-id="${cssEscape(id)}"]`).value;

      // Уровень
      const lvl = parseInt(list.querySelector(`[data-field="level"][data-id="${cssEscape(id)}"]`).value, 10);
      m.level = isNaN(lvl) ? 1 : lvl;

      // Классы
      const c1El = list.querySelector(`[data-field="class1"][data-id="${cssEscape(id)}"]`);
      const c2El = list.querySelector(`[data-field="class2"][data-id="${cssEscape(id)}"]`);
      const c1 = c1El ? c1El.value : '';
      const c2 = c2El ? c2El.value : '';
      m.classes = [];
      if (c1) m.classes.push(c1);
      if (c2 && c2 !== c1) m.classes.push(c2);

      // Статус-дата
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

  // Кнопки
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

export function addMember(name, type, species, class1, class2, level) {
  const errEl = $('members-error');
  if (errEl) errEl.textContent = '';

  name = (name || '').trim();
  if (!name) {
    if (errEl) errEl.textContent = 'Введите имя';
    return;
  }

  const existing = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (existing.fired) {
      existing.fired = false;
      existing.type = type;
      existing.species = species || '';
      existing.classes = [class1, class2].filter(Boolean);
      existing.level = level || 1;
      persist();
      $('member-name').value = '';
      renderMembers();
      if (typeof window.__renderBank === 'function') window.__renderBank();
      return;
    }
    if (errEl) errEl.textContent = 'Персонаж с таким именем уже есть';
    return;
  }

  const classes = [];
  if (class1) classes.push(class1);
  if (class2 && class2 !== class1) classes.push(class2);

  state.members.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, type, fired: false,
    rank: '', position: '', status: '', statusDate: null, info: '', expanded: false,
    species: species || '',
    classes,
    level: level || 1
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
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initSostavHandlers() {
  // Заполняем селект классов
  const classSel = $('member-class');
  DND_CLASSES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    classSel.appendChild(opt);
  });

  // Заполняем селект второго класса (скрыт)
  const classSel2 = $('member-class-2');
  DND_CLASSES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    classSel2.appendChild(opt);
  });

  // Заполняем селект уровней
  const levelSel = $('member-level');
  DND_LEVELS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l;
    opt.textContent = l;
    levelSel.appendChild(opt);
  });
  levelSel.value = '1';

  // Кнопка «+» — показать второй класс
  $('btn-add-class').addEventListener('click', () => {
    $('member-class-2-wrapper').style.display = 'flex';
    $('btn-add-class').style.display = 'none';
  });

  // Кнопка «−» — скрыть второй класс
  $('btn-remove-class').addEventListener('click', () => {
    $('member-class-2-wrapper').style.display = 'none';
    $('btn-add-class').style.display = 'inline-flex';
    $('member-class-2').value = $('member-class').value;
  });

  // Добавление участника
  $('btn-add-member').addEventListener('click', () => {
    const name = $('member-name').value;
    const type = $('member-type').value;
    const species = $('member-species').value.trim();
    const class1 = $('member-class').value;
    const class2Visible = $('member-class-2-wrapper').style.display !== 'none';
    const class2 = class2Visible ? $('member-class-2').value : '';
    const level = parseInt($('member-level').value, 10) || 1;

    addMember(name, type, species, class1, class2, level);

    // Сбрасываем форму
    $('member-species').value = '';
    $('member-class').selectedIndex = 0;
    $('member-class-2').selectedIndex = 0;
    $('member-level').value = '1';
    $('member-class-2-wrapper').style.display = 'none';
    $('btn-add-class').style.display = 'inline-flex';
  });

  $('member-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-add-member').click();
  });
}
