/* ============================================================
   SOSTAV.JS — Логика раздела «Состав»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  ensureAccount, formatMoney,
  DND_CLASSES, DND_LEVELS,
  getMaxPlayerLevel
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

export function getPlayers() {
  return state.members.filter(m => m.type === 'Игрок' && !m.fired);
}

function getEffectiveLevel(m) {
  if (m.type === 'НИП') return getMaxPlayerLevel();
  return m.level || 1;
}

function buildMemberSubtitle(m) {
  const parts = [];
  const isNPC = m.type === 'НИП';

  if (isNPC && m.rank) parts.push(`Звание: ${m.rank}`);
  if (m.species) parts.push(m.species);
  if (!isNPC && m.classes && m.classes.length) {
    const cls = m.classes.filter(c => c && c.trim());
    if (cls.length) parts.push(cls.join('/'));
  }

  const lvl = getEffectiveLevel(m);
  if (lvl) parts.push(`${lvl} уровень`);

  if (m.position) parts.push(`Профессия: ${m.position}`);

  return parts.join('. ');
}

/* ============================================================
   ОТРИСОВКА СПИСКА
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
    const isNPC = m.type === 'НИП';

    const arrow = m.expanded ? '▲' : '▼';

    const c1 = (m.classes && m.classes[0]) ? m.classes[0] : '';
    const c2 = (m.classes && m.classes[1]) ? m.classes[1] : '';
    const hasSecond = Array.isArray(m.classes) && m.classes.length > 1;

    const classOptions1 = DND_CLASSES.map(c =>
      `<option value="${escapeAttr(c)}" ${c === c1 ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    const classOptions2 = DND_CLASSES.map(c =>
      `<option value="${escapeAttr(c)}" ${c === c2 ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');

    const effectiveLevel = getEffectiveLevel(m);
    const levelOptions = DND_LEVELS.map(l =>
      `<option value="${l}" ${l === effectiveLevel ? 'selected' : ''}>${l}</option>`
    ).join('');

    card.innerHTML = `
      <div class="mc-head" data-toggle="${m.id}">
        <div>
          <span class="mc-name">${escapeHtml(m.name)}</span>
          <span class="mc-role ${m.type === 'Игрок' ? 'player' : 'npc'}">${roleLabel}</span>
          ${subtitle ? `<div class="mc-titles"><span>${escapeHtml(subtitle)}</span></div>` : ''}
        </div>
        <span class="mc-arrow">${arrow}</span>
      </div>
      <div class="mc-body ${m.expanded ? 'open' : ''}" id="body-${m.id}">
        <div class="row">
          <div class="field">
            <label>Имя</label>
            <input type="text" data-field="name" data-id="${m.id}" value="${escapeAttr(m.name)}">
          </div>
          <div class="field">
            <label>Профессия</label>
            <input type="text" data-field="position" data-id="${m.id}" value="${escapeAttr(m.position)}" placeholder="Кузнец, алхимик...">
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Вид</label>
            <input type="text" data-field="species" data-id="${m.id}" value="${escapeAttr(m.species)}" placeholder="Человек, эльф, орк...">
          </div>
          ${isNPC ? `
          <div class="field">
            <label>Звание</label>
            <input type="text" data-field="rank" data-id="${m.id}" value="${escapeAttr(m.rank)}" placeholder="Например, Капитан">
          </div>
          ` : `
          <div class="field">
            <label>Уровень</label>
            <select data-field="level" data-id="${m.id}">
              ${levelOptions}
            </select>
          </div>
          `}
        </div>
        ${!isNPC ? `
        <div class="row">
          <div class="field" style="grid-column: span 2;">
            <label>Класс</label>
            <div class="class-row">
              <select data-field="class1" data-id="${m.id}">
                <option value="">—</option>
                ${classOptions1}
              </select>
              <button type="button" class="small class-toggle" data-add-class="${m.id}" title="Добавить второй класс" ${hasSecond ? 'style="display:none;"' : ''}>+</button>
            </div>
          </div>
          <div class="field class-second ${hasSecond ? '' : 'hidden'}" data-class2-wrapper="${m.id}" style="grid-column: span 2;">
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
        ` : ''}
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

  list.querySelectorAll('[data-add-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.addClass;
      const m = state.members.find(x => x.id === id);
      if (!m) return;
      saveMemberFieldsFromDOM(list, m, id);
      if (!Array.isArray(m.classes)) m.classes = [];
      if (m.classes.length < 2) m.classes[1] = '';
      persist();
      renderMembers();
    });
  });

  list.querySelectorAll('[data-remove-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.removeClass;
      const m = state.members.find(x => x.id === id);
      if (!m) return;
      saveMemberFieldsFromDOM(list, m, id);
      if (Array.isArray(m.classes) && m.classes.length > 1) {
        m.classes = [m.classes[0]];
      }
      persist();
      renderMembers();
    });
  });

  list.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.save;
      const m = state.members.find(x => x.id === id);
      if (!m) return;

      const nameEl = list.querySelector(`[data-field="name"][data-id="${cssEscape(id)}"]`);
      const newName = nameEl ? nameEl.value.trim() : m.name;

      if (!newName) {
        alert('Имя не может быть пустым');
        return;
      }

      if (newName !== m.name) {
        const dup = state.members.find(x => x.id !== id && x.name.toLowerCase() === newName.toLowerCase());
        if (dup) {
          alert('Персонаж с таким именем уже есть');
          return;
        }
        // Перенос счёта при смене имени Игрока
        if (m.type === 'Игрок') {
          if (state.accounts[m.name]) {
            state.accounts[newName] = state.accounts[m.name];
            delete state.accounts[m.name];
          } else {
            ensureAccount(newName);
          }
        }
        m.name = newName;
      }

      saveMemberFieldsFromDOM(list, m, id);

      persist();
      renderMembers();
      if (typeof window.__renderBank === 'function') window.__renderBank();
      if (typeof window.__renderHeader === 'function') window.__renderHeader();
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

function saveMemberFieldsFromDOM(list, m, id) {
  const rankEl = list.querySelector(`[data-field="rank"][data-id="${cssEscape(id)}"]`);
  const posEl = list.querySelector(`[data-field="position"][data-id="${cssEscape(id)}"]`);
  const speciesEl = list.querySelector(`[data-field="species"][data-id="${cssEscape(id)}"]`);
  const infoEl = list.querySelector(`[data-field="info"][data-id="${cssEscape(id)}"]`);
  const levelEl = list.querySelector(`[data-field="level"][data-id="${cssEscape(id)}"]`);
  const c1El = list.querySelector(`[data-field="class1"][data-id="${cssEscape(id)}"]`);
  const c2El = list.querySelector(`[data-field="class2"][data-id="${cssEscape(id)}"]`);

  if (rankEl) m.rank = rankEl.value.trim();
  if (posEl) m.position = posEl.value.trim();
  if (speciesEl) m.species = speciesEl.value.trim();
  if (infoEl) m.info = infoEl.value;

  if (m.type === 'Игрок') {
    if (levelEl) {
      const lvl = parseInt(levelEl.value, 10);
      m.level = isNaN(lvl) ? 1 : lvl;
    }
    if (!Array.isArray(m.classes)) m.classes = [];
    if (c1El) m.classes[0] = c1El.value || '';
    if (c2El) m.classes[1] = c2El.value || '';
  }
}

/* ============================================================
   ДОБАВЛЕНИЕ НИПА
   ============================================================ */

export function addNPC() {
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  state.members.push({
    id,
    name: 'Новый НИП',
    type: 'НИП', fired: false,
    rank: '', position: '', info: '', expanded: true,
    species: '',
    classes: [],
    level: getMaxPlayerLevel()
  });
  persist();
  renderMembers();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();
}

/* ============================================================
   УВОЛЬНЕНИЕ / ВОССТАНОВЛЕНИЕ / УДАЛЕНИЕ
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
  if (typeof window.__renderHeader === 'function') window.__renderHeader();
}

export function hireMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  m.fired = false;
  if (m.type === 'Игрок') ensureAccount(m.name);
  persist();
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();
}

export async function deleteMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  const ok = await showConfirm(`Удалить «${m.name}» навсегда? Это действие необратимо.`, 'Удалить', 'Отмена');
  if (!ok) return;

  state.members = state.members.filter(x => x.id !== id);
  persist();
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initSostavHandlers() {
  const btn = $('btn-add-npc');
  if (btn) btn.addEventListener('click', addNPC);
}
