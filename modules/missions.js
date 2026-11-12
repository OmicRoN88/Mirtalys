/* ============================================================
   MISSIONS.JS — Логика раздела «Миссии»
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape,
  MONTHS
} from './core.js';

import {
  daysBetween, absoluteDay, addMinutes, formatDate
} from './date.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

function getRemainingHours(mission) {
  const start = mission.createdAt;
  const end = addMinutes(start, mission.durationHours * 60);
  const nowAbs = absoluteDay(state.date);
  const endAbs = absoluteDay(end);
  const dayDiff = endAbs - nowAbs;
  const nowMinutes = state.date.hours * 60 + state.date.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  return dayDiff * 24 + (endMinutes - nowMinutes) / 60;
}

function formatRemaining(mission) {
  const hours = getRemainingHours(mission);
  if (hours <= 0) return 'Просрочено';
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Осталось: ${days} дн.`;
  }
  const h = Math.ceil(hours);
  return `Осталось: ${h} ч.`;
}

function getMissionClass(mission) {
  if (mission.status === 'success') return 'success';
  if (mission.status === 'failed') return 'failed';
  if (mission.status === 'active' && getRemainingHours(mission) <= 0) return 'overdue';
  return '';
}

function sortByRemaining(a, b) {
  const ra = getRemainingHours(a);
  const rb = getRemainingHours(b);
  return ra - rb;
}

function formatDuration(hours) {
  if (hours >= 24 && hours % 24 === 0) {
    return `${hours / 24} дн.`;
  }
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const h = hours % 24;
    return `${d} дн. ${h} ч.`;
  }
  return `${hours} ч.`;
}

/* ============================================================
   ОТРИСОВКА
   ============================================================ */

export function renderMissions() {
  renderProposed();
  renderAccepted();
}

function renderProposed() {
  const list = $('missions-proposed-list');
  if (!list) return;

  const proposed = state.missions.filter(m => m.status === 'proposed');
  if (!proposed.length) {
    list.innerHTML = '<div class="empty">Нет предлагаемых миссий</div>';
    return;
  }
  proposed.sort(sortByRemaining);

  list.innerHTML = '';
  proposed.forEach(m => {
    const card = document.createElement('div');
    card.className = 'mission-card proposed';
    const remaining = formatRemaining(m);

    card.innerHTML = `
      <div class="mc-head" data-mission-toggle="${m.id}">
        <div>
          <span class="mission-goal">${escapeHtml(m.goal)}</span>
          <span class="mission-meta">${m.type === 'Личное' ? 'Личное' : 'Общее'}</span>
          <div class="mission-sub">
            <span>${escapeHtml(remaining)}</span>
            <span>Награда: ${m.reward} ЗМ</span>
          </div>
        </div>
        <span class="mc-arrow">${m.expanded ? '▲' : '▼'}</span>
      </div>
      <div class="mc-body ${m.expanded ? 'open' : ''}">
        ${m.type === 'Личное' && m.issuer ? `<div class="mission-detail"><b>Кто выдал:</b> ${escapeHtml(m.issuer)}</div>` : ''}
        <div class="mission-detail"><b>Цель:</b> ${escapeHtml(m.goal)}</div>
        <div class="mission-detail"><b>Награда:</b> ${m.reward} ЗМ</div>
        <div class="mission-detail"><b>Срок:</b> ${formatDuration(m.durationHours)}</div>
        <div class="mission-actions">
          <button class="success-btn small" data-accept="${m.id}">✓ Принять</button>
          <button class="danger small" data-reject="${m.id}">✕ Отказаться</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-mission-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const m = state.missions.find(x => x.id === el.dataset.missionToggle);
      if (!m) return;
      m.expanded = !m.expanded;
      persist();
      renderMissions();
    });
  });

  list.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', () => acceptMission(btn.dataset.accept));
  });

  list.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', () => rejectMission(btn.dataset.reject));
  });
}

function renderAccepted() {
  const list = $('missions-accepted-list');
  if (!list) return;

  const accepted = state.missions.filter(m => m.status !== 'proposed');
  if (!accepted.length) {
    list.innerHTML = '<div class="empty">Нет принятых миссий</div>';
    return;
  }

  accepted.sort((a, b) => {
    const order = { active: 0, success: 1, failed: 2 };
    const oa = order[a.status] ?? 3;
    const ob = order[b.status] ?? 3;
    if (oa !== ob) return oa - ob;
    if (a.status === 'active') return sortByRemaining(a, b);
    return 0;
  });

  list.innerHTML = '';
  accepted.forEach(m => {
    const card = document.createElement('div');
    const cls = getMissionClass(m);
    card.className = 'mission-card accepted' + (cls ? ' ' + cls : '');

    const remaining = formatRemaining(m);
    let statusLabel = '';
    if (m.status === 'success') statusLabel = 'Выполнено';
    else if (m.status === 'failed') statusLabel = 'Провалено';
    else statusLabel = remaining;

    let actions = '';
    if (m.status === 'active') {
      actions = `<button class="success-btn small" data-success="${m.id}">Удача</button>
                 <button class="danger small" data-fail="${m.id}">Провал</button>`;
    } else {
      actions = `<button class="danger small" data-delete-mission="${m.id}">Удалить</button>`;
    }

    card.innerHTML = `
      <div class="mc-head" data-mission-toggle="${m.id}">
        <div>
          <span class="mission-goal">${escapeHtml(m.goal)}</span>
          <span class="mission-meta">${m.type === 'Личное' ? 'Личное' : 'Общее'}</span>
          <div class="mission-sub">
            <span>${escapeHtml(statusLabel)}</span>
            <span>Награда: ${m.reward} ЗМ</span>
          </div>
        </div>
        <span class="mc-arrow">${m.expanded ? '▲' : '▼'}</span>
      </div>
      <div class="mc-body ${m.expanded ? 'open' : ''}">
        ${m.type === 'Личное' && m.issuer ? `<div class="mission-detail"><b>Кто выдал:</b> ${escapeHtml(m.issuer)}</div>` : ''}
        <div class="mission-detail"><b>Цель:</b> ${escapeHtml(m.goal)}</div>
        <div class="mission-detail"><b>Награда:</b> ${m.reward} ЗМ</div>
        <div class="mission-detail"><b>Срок:</b> ${formatDuration(m.durationHours)}</div>
        <div class="mission-detail"><b>Дата создания:</b> ${formatDate(m.createdAt)}</div>
        <div class="mission-detail"><b>Дата окончания:</b> ${formatDate(addMinutes(m.createdAt, m.durationHours * 60))}</div>
        <div class="mission-actions">${actions}</div>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-mission-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const m = state.missions.find(x => x.id === el.dataset.missionToggle);
      if (!m) return;
      m.expanded = !m.expanded;
      persist();
      renderMissions();
    });
  });

  list.querySelectorAll('[data-success]').forEach(btn => {
    btn.addEventListener('click', () => successMission(btn.dataset.success));
  });
  list.querySelectorAll('[data-fail]').forEach(btn => {
    btn.addEventListener('click', () => failMission(btn.dataset.fail));
  });
  list.querySelectorAll('[data-delete-mission]').forEach(btn => {
    btn.addEventListener('click', () => deleteMission(btn.dataset.deleteMission));
  });
}

/* ============================================================
   ДОБАВЛЕНИЕ МИССИИ
   ============================================================ */

export function addMission() {
  const errEl = $('mission-error');
  if (errEl) errEl.textContent = '';

  const type = $('mission-type').value;
  const issuer = $('mission-issuer').value.trim();
  const goal = $('mission-goal').value.trim();
  const reward = parseInt($('mission-reward').value, 10);
  const days = parseInt($('mission-days').value, 10) || 0;
  const hours = parseInt($('mission-hours').value, 10) || 0;

  if (!goal) { if (errEl) errEl.textContent = 'Введите цель'; return; }
  if (isNaN(reward) || reward < 0) { if (errEl) errEl.textContent = 'Введите награду'; return; }
  const totalHours = days * 24 + hours;
  if (totalHours <= 0) { if (errEl) errEl.textContent = 'Укажите срок'; return; }
  if (type === 'Личное' && !issuer) { if (errEl) errEl.textContent = 'Укажите, кто выдал'; return; }

  state.missions.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type, issuer, goal, reward,
    durationHours: totalHours,
    createdAt: { ...state.date },
    status: 'proposed',
    expanded: false,
    overdueDismissed: false
  });
  persist();

  $('mission-type').value = 'Общее';
  $('mission-issuer').value = '';
  $('mission-goal').value = '';
  $('mission-reward').value = '';
  $('mission-days').value = '';
  $('mission-hours').value = '';
  $('mission-issuer-wrapper').style.display = 'none';

  $('modal-mission-form').style.display = 'none';
  renderMissions();
}

/* ============================================================
   ПРИНЯТИЕ / ОТКАЗ
   ============================================================ */

function acceptMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  m.status = 'active';
  m.createdAt = { ...state.date };
  persist();
  renderMissions();
}

async function rejectMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  const ok = await showConfirm(`Удалить предлагаемую миссию «${m.goal}»?`, 'Удалить', 'Отмена');
  if (!ok) return;
  state.missions = state.missions.filter(x => x.id !== id);
  persist();
  renderMissions();
}

/* ============================================================
   УДАЧА / ПРОВАЛ / УДАЛЕНИЕ
   ============================================================ */

function successMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  m.status = 'success';
  persist();
  renderMissions();
}

function failMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  m.status = 'failed';
  persist();
  renderMissions();
}

async function deleteMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  const ok = await showConfirm(`Удалить миссию «${m.goal}»?`, 'Удалить', 'Отмена');
  if (!ok) return;
  state.missions = state.missions.filter(x => x.id !== id);
  persist();
  renderMissions();
}

/* ============================================================
   ПРОВЕРКА ПРОСРОЧКИ
   ============================================================ */

export async function checkOverdueMissions() {
  const overdue = state.missions.filter(m =>
    m.status === 'active' &&
    !m.overdueDismissed &&
    getRemainingHours(m) <= 0
  );
  for (const m of overdue) {
    const ok = await showConfirm(`Миссия «${m.goal}» просрочена. Считать проваленной?`);
    if (ok) {
      m.status = 'failed';
    } else {
      m.overdueDismissed = true;
    }
    persist();
  }
  if (overdue.length) renderMissions();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initMissionsHandlers() {
  $('btn-create-mission').addEventListener('click', () => {
    $('modal-mission-form').style.display = 'flex';
    const errEl = $('mission-error');
    if (errEl) errEl.textContent = '';
  });

  $('mission-type').addEventListener('change', () => {
    const type = $('mission-type').value;
    $('mission-issuer-wrapper').style.display = type === 'Личное' ? 'flex' : 'none';
  });

  $('mission-days').addEventListener('input', () => {
    const days = parseInt($('mission-days').value, 10);
    if (!isNaN(days) && days >= 0) {
      $('mission-hours').value = days * 24;
    }
  });
  $('mission-hours').addEventListener('input', () => {
    const hours = parseInt($('mission-hours').value, 10);
    if (!isNaN(hours) && hours >= 0) {
      const days = Math.round((hours / 24) * 10) / 10;
      $('mission-days').value = days;
    }
  });

  $('btn-add-mission').addEventListener('click', addMission);
}
