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
   ВСПОМОГАТЕЛЬНЫЕ
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

    const expandedPart = m.expanded ? `
      <div class="field" style="margin-top: 10px;">
        <label>Краткая информация</label>
        <textarea disabled style="opacity: 0.8; cursor: default;">${escapeHtml(m.info)}</textarea>
      </div>
      <div class="actions" style="margin-top: 12px;">
        <button class="small success-btn" data-open-card="${m.id}">Карточка</button>
        ${m.fired
          ? `<button class="success-btn small" data-hire="${m.id}">Нанять</button>
             <button class="danger small" data-delete="${m.id}">Удалить</button>`
          : `<button class="danger small" data-fire="${m.id}">Уволить</button>`}
      </div>
    ` : '';

    card.innerHTML = `
      <div class="mc-head" data-toggle="${m.id}">
        <div>
          <span class="mc-name">${escapeHtml(m.name)}</span>
          <span class="mc-role ${m.type === 'Игрок' ? 'player' : 'npc'}">${roleLabel}</span>
          ${subtitle ? `<div class="mc-titles"><span>${escapeHtml(subtitle)}</span></div>` : ''}
        </div>
        <span class="mc-arrow">${arrow}</span>
      </div>
      <div class="mc-body ${m.expanded ? 'open' : ''}">
        ${expandedPart}
      </div>
    `;
    list.appendChild(card);
  });

  // Раскрытие
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

  // Открыть карточку
  list.querySelectorAll('[data-open-card]').forEach(el => {
    el.addEventListener('click', () => openCharacterCard(el.dataset.openCard));
  });

  // Уволить/Нанять/Удалить
  list.querySelectorAll('[data-fire]').forEach(el => {
    el.addEventListener('click', () => fireMember(el.dataset.fire));
  });
  list.querySelectorAll('[data-hire]').forEach(el => {
    el.addEventListener('click', () => hireMember(el.dataset.hire));
  });
  list.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', () => deleteMember(el.dataset.delete));
  });
}

/* ============================================================
   КАРТОЧКА ПЕРСОНАЖА (модалка)
   ============================================================ */

function openCharacterCard(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;

  const modal = $('modal-character-card');
  if (!modal) return;

  // Заполняем селекты классов и уровней, если пусты
  const levelSel = $('cc-level');
  if (levelSel.options.length === 0) {
    DND_LEVELS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l;
      levelSel.appendChild(opt);
    });
  }
  const classSel = $('cc-class');
  if (classSel.options.length === 0) {
    DND_CLASSES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSel.appendChild(opt);
    });
  }

  $('cc-id').value = m.id;
  $('cc-name').value = m.name;
  $('cc-species').value = m.species || '';
  $('cc-position').value = m.position || '';
  $('cc-level').value = m.level || 1;
  $('cc-class').value = (m.classes && m.classes[0]) ? m.classes[0] : DND_CLASSES[0];
  $('cc-hp').value = m.hp || 0;
  $('cc-maxhp').value = m.maxHp || 10;
  $('cc-ac').value = m.ac || 10;
  $('cc-passive').value = m.passivePerception || 10;
  $('cc-weight').value = m.weight || 0;
  $('cc-info').value = m.info || '';
  const errEl = $('cc-error');
  if (errEl) errEl.textContent = '';

  modal.style.display = 'flex';
}

function saveCharacterCard() {
  const errEl = $('cc-error');
  if (errEl) errEl.textContent = '';

  const id = $('cc-id').value;
  const m = state.members.find(x => x.id === id);
  if (!m) return;

  const newName = $('cc-name').value.trim();
  if (!newName) { if (errEl) errEl.textContent = 'Введите имя'; return; }

  if (newName !== m.name) {
    const dup = state.members.find(x => x.id !== id && x.name.toLowerCase() === newName.toLowerCase());
    if (dup) { if (errEl) errEl.textContent = 'Персонаж с таким именем уже есть'; return; }
    // Перенос счёта, если Игрок
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

  m.species = $('cc-species').value.trim();
  m.position = $('cc-position').value.trim();
  m.level = parseInt($('cc-level').value, 10) || 1;
  const cls = $('cc-class').value;
  m.classes = cls ? [cls] : [];
  m.hp = parseInt($('cc-hp').value, 10) || 0;
  m.maxHp = parseInt($('cc-maxhp').value, 10) || 10;
  if (m.hp > m.maxHp) m.hp = m.maxHp;
  m.ac = parseInt($('cc-ac').value, 10) || 10;
  m.passivePerception = parseInt($('cc-passive').value, 10) || 10;
  m.weight = parseInt($('cc-weight').value, 10) || 0;
  m.info = $('cc-info').value;

  persist();
  $('modal-character-card').style.display = 'none';
  renderMembers();
  if (typeof window.__renderBank === 'function') window.__renderBank();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();
}

/* ============================================================
   ДОБАВЛЕНИЕ НИПА
   ============================================================ */

export function addNPC() {
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  state.members.push({
    id, name: 'Новый НИП',
    type: 'НИП', fired: false,
    rank: '', position: '', info: '', expanded: true,
    species: '', classes: [],
    level: getMaxPlayerLevel(),
    hp: 10, maxHp: 10, ac: 10, passivePerception: 10, weight: 0
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
    if (give) ensureAccount(m.name).personalIn -= balance;
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

  const btnSave = $('btn-save-character-card');
  if (btnSave) btnSave.addEventListener('click', saveCharacterCard);
  const btnCancel = $('btn-cancel-character-card');
  if (btnCancel) btnCancel.addEventListener('click', () => {
    $('modal-character-card').style.display = 'none';
  });
}
