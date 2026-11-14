/* ============================================================
   ENCOUNTER.JS — Боевой трекер
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm, showPrompt } from './dialogi.js';

/* ============================================================
   КОНСТАНТЫ СОСТОЯНИЙ
   ============================================================ */

const CONDITIONS = [
  'Бессознательный', 'Испуганный', 'Истощение', 'Невидимый',
  'Недееспособный', 'Оглохший', 'Окаменевший', 'Опрокинутый',
  'Опутанный', 'Ослеплённый', 'Отравленный', 'Очарованный',
  'Ошеломлённый', 'Парализованный', 'Схваченный'
];

const SKIP_TURN_CONDITIONS = [
  'Бессознательный', 'Недееспособный', 'Окаменевший',
  'Ошеломлённый', 'Парализованный'
];

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ
   ============================================================ */

function isDead(c) {
  return c.status === 'dead';
}

function mustSkipTurn(c) {
  if (isDead(c)) return true;
  return c.conditions && c.conditions.some(cond => SKIP_TURN_CONDITIONS.includes(cond));
}

/* Мини-диалог для урона/исцеления */
function showHpDialog(combatant, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <p>${escapeHtml(combatant.name)} — HP: ${combatant.hp}/${combatant.maxHp}${combatant.tempHp ? ` (+${combatant.tempHp})` : ''}</p>
      <input type="number" id="hp-dialog-input" min="0" placeholder="Значение" style="margin-bottom: 16px;">
      <div class="dialog-actions">
        <button class="secondary" data-cancel>Отмена</button>
        <button class="danger" data-damage>Урон</button>
        <button class="success-btn" data-heal>Исцеление</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#hp-dialog-input');
  input.focus();
  const close = () => overlay.remove();

  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('[data-damage]').addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) return;
    let dmg = val;
    if (combatant.tempHp > 0) {
      const absorbed = Math.min(combatant.tempHp, dmg);
      combatant.tempHp -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) combatant.hp -= dmg;
    if (combatant.hp <= 0) { combatant.hp = 0; combatant.status = 'dead'; }
    persist();
    close();
    onDone();
  });

  overlay.querySelector('[data-heal]').addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) return;
    combatant.hp = Math.min(combatant.maxHp, combatant.hp + val);
    if (combatant.hp > 0 && combatant.status === 'dead') combatant.status = 'alive';
    persist();
    close();
    onDone();
  });
}

/* Мини-диалог для КД */
function showAcDialog(combatant, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <p>${escapeHtml(combatant.name)} — КД: <b>${combatant.ac}</b></p>
      <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 16px; flex-wrap: wrap;">
        <button class="danger" data-ac="-2">−2 КД</button>
        <button class="danger" data-ac="-1">−1 КД</button>
        <button class="success-btn" data-ac="+1">+1 КД</button>
        <button class="success-btn" data-ac="+2">+2 КД</button>
      </div>
      <div class="dialog-actions">
        <button class="secondary" data-cancel>Закрыть</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();

  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('[data-ac]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.ac, 10);
      combatant.ac += delta;
      persist();
      close();
      onDone();
    });
  });
}

/* ============================================================
   ОТРИСОВКА
   ============================================================ */

export function renderEncounter() {
  const container = $('encounter-list');
  const roundEl = $('encounter-round');
  const nextBtn = $('btn-next-turn');
  if (!container) return;

  const enc = state.encounter;

  if (nextBtn) {
    if (enc.active) {
      nextBtn.textContent = 'Следующий ход';
      nextBtn.className = 'success-btn';
    } else {
      nextBtn.textContent = 'Начать бой';
      nextBtn.className = 'warn';
    }
  }

  if (!enc.combatants.length) {
    container.innerHTML = '<div class="empty">Нет участников боя</div>';
    if (roundEl) roundEl.textContent = 'Бой не начат';
    return;
  }

  if (roundEl) {
    roundEl.textContent = enc.active ? `Раунд №${enc.round}` : 'Бой не начат';
  }

  const sorted = [...enc.combatants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
  const activeId = enc.active && sorted[enc.turnIndex] ? sorted[enc.turnIndex].id : null;

  container.innerHTML = '';
  sorted.forEach((c) => {
    const isActive = c.id === activeId;
    const dead = isDead(c);
    const disabled = mustSkipTurn(c) && !dead;
    const expanded = c.expanded === true;

    let rowClass = 'encounter-row';
    rowClass += c.isEnemy ? ' enemy' : ' player';
    if (dead) rowClass += ' dead';
    if (isActive) rowClass += ' active';
    if (!expanded) rowClass += ' collapsed';

    // Бейджи состояний
    let statusBadges = '';
    if (dead) statusBadges += `<span class="enc-status danger">Мертв</span>`;
    if (c.conditions) {
      c.conditions.forEach(cond => {
        statusBadges += `<span class="enc-status warning">${escapeHtml(cond)}</span>`;
      });
    }

    // Раскрытая часть
    const expandedPart = expanded ? `
      <div class="enc-resources">
        <label><input type="checkbox" data-res="action" data-id="${c.id}" ${c.action ? 'checked' : ''}> Действие</label>
        <label><input type="checkbox" data-res="bonus" data-id="${c.id}" ${c.bonus ? 'checked' : ''}> Бонусное</label>
        <label><input type="checkbox" data-res="reaction" data-id="${c.id}" ${c.reaction ? 'checked' : ''}> Реакция</label>
      </div>
      <div class="enc-conditions">
        <select class="enc-condition-select" data-cond="${c.id}">
          <option value="">— Добавить состояние —</option>
          ${CONDITIONS.map(cond => `<option value="${escapeAttr(cond)}">${escapeHtml(cond)}</option>`).join('')}
        </select>
      </div>
      ${c.conditions && c.conditions.length ? `
        <div class="enc-active-conditions">
          ${c.conditions.map((cond, i) => `
            <span class="enc-condition-tag">${escapeHtml(cond)} <button class="small danger" data-remove-cond="${c.id}" data-cond-idx="${i}" style="padding: 0 4px; font-size: 0.7rem;">×</button></span>
          `).join('')}
        </div>
      ` : ''}
      <div class="enc-actions">
        <button class="small secondary" data-remove="${c.id}">Удалить из боя</button>
      </div>
    ` : '';

    const row = document.createElement('div');
    row.className = rowClass;

    row.innerHTML = `
      <div class="enc-initiative">
        <input type="number" class="enc-init-input" data-init="${c.id}" value="${c.initiative || ''}" placeholder="Иниц.">
      </div>
      <div class="enc-main">
        <div class="enc-head" data-toggle="${c.id}" style="cursor: pointer;">
          <span class="enc-name">${escapeHtml(c.name)}</span>
          <span class="enc-stats">
            <b class="enc-hp-clickable" data-hp-click="${c.id}">HP: ${c.hp}${c.tempHp > 0 ? ` <span style="color: var(--warning);">(+${c.tempHp})</span>` : ''} / ${c.maxHp}</b>
            <b class="enc-ac-clickable" data-ac-click="${c.id}">КД: ${c.ac}</b>
          </span>
          <span class="enc-arrow">${expanded ? '▲' : '▼'}</span>
        </div>
        ${statusBadges ? `<div class="enc-statuses">${statusBadges}</div>` : ''}
        ${expandedPart}
      </div>
    `;
    container.appendChild(row);
  });

  // ---------- Обработчики ----------

  container.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select')) return;
      const c = enc.combatants.find(x => x.id === el.dataset.toggle);
      if (!c) return;
      c.expanded = !c.expanded;
      persist();
      renderEncounter();
    });
  });

  container.querySelectorAll('[data-hp-click]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.hpClick);
      if (!c) return;
      showHpDialog(c, renderEncounter);
    });
  });

  container.querySelectorAll('[data-ac-click]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.acClick);
      if (!c) return;
      showAcDialog(c, renderEncounter);
    });
  });

  container.querySelectorAll('[data-init]').forEach(el => {
    el.addEventListener('change', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.init);
      if (c) {
        c.initiative = parseInt(el.value, 10) || 0;
        persist();
        renderEncounter();
      }
    });
  });

  container.querySelectorAll('[data-res]').forEach(el => {
    el.addEventListener('change', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.id);
      if (c) {
        c[el.dataset.res] = el.checked;
        persist();
      }
    });
  });

  container.querySelectorAll('[data-cond]').forEach(el => {
    el.addEventListener('change', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.cond);
      if (!c || !el.value) return;
      if (!Array.isArray(c.conditions)) c.conditions = [];
      if (!c.conditions.includes(el.value)) c.conditions.push(el.value);
      el.value = '';
      persist();
      renderEncounter();
    });
  });

  container.querySelectorAll('[data-remove-cond]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.removeCond);
      if (!c || !Array.isArray(c.conditions)) return;
      const idx = parseInt(el.dataset.condIdx, 10);
      c.conditions.splice(idx, 1);
      persist();
      renderEncounter();
    });
  });

  container.querySelectorAll('[data-remove]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.remove);
      if (!c) return;
      const ok = await showConfirm(`Удалить «${c.name}» из боя?`, 'Удалить', 'Отмена');
      if (!ok) return;
      enc.combatants = enc.combatants.filter(x => x.id !== el.dataset.remove);
      if (enc.turnIndex >= enc.combatants.length) enc.turnIndex = 0;
      persist();
      renderEncounter();
    });
  });
}

/* ============================================================
   СЛЕДУЮЩИЙ ХОД
   ============================================================ */

export function nextTurn() {
  const enc = state.encounter;
  if (!enc.combatants.length) return;

  const sorted = [...enc.combatants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  if (!enc.active) {
    enc.active = true;
    enc.round = 1;
    const first = sorted.findIndex(c => !mustSkipTurn(c));
    enc.turnIndex = first >= 0 ? first : 0;
  } else {
    let nextIdx = enc.turnIndex + 1;
    let guard = 0;
    while (guard < 1000) {
      if (nextIdx >= sorted.length) {
        nextIdx = 0;
        enc.round += 1;
      }
      const c = sorted[nextIdx];
      if (mustSkipTurn(c)) {
        nextIdx++;
        guard++;
        continue;
      }
      enc.turnIndex = nextIdx;
      break;
    }
  }

  // Сбрасываем ресурсы у текущего
  const current = sorted[enc.turnIndex];
  if (current) {
    current.action = false;
    current.bonus = false;
    current.reaction = false;
  }

  persist();
  renderEncounter();
}

/* ============================================================
   ДОБАВЛЕНИЕ ИГРОКОВ
   ============================================================ */

export function openAddPlayersModal() {
  const modal = $('modal-add-players');
  const list = $('add-players-list');
  if (!modal || !list) return;

  const players = state.members.filter(m => m.type === 'Игрок' && !m.fired);
  if (!players.length) {
    list.innerHTML = '<div class="empty">Нет игроков в составе</div>';
  } else {
    list.innerHTML = players.map(p => {
      const alreadyIn = state.encounter.combatants.some(c => c.refId === p.id);
      return `
        <label class="add-player-row ${alreadyIn ? 'already' : ''}">
          <input type="checkbox" data-add-player="${p.id}" ${alreadyIn ? 'disabled' : ''}>
          <span>${escapeHtml(p.name)}</span>
          ${alreadyIn ? '<span class="hint">(уже в бою)</span>' : ''}
        </label>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
}

export function confirmAddPlayers() {
  const list = $('add-players-list');
  if (!list) return;

  list.querySelectorAll('[data-add-player]').forEach(el => {
    if (el.checked && !el.disabled) {
      const playerId = el.dataset.addPlayer;
      const player = state.members.find(m => m.id === playerId);
      if (!player) return;
      state.encounter.combatants.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        refId: player.id,
        name: player.name,
        isEnemy: false,
        initiative: 0,
        hp: 10,
        maxHp: 10,
        tempHp: 0,
        ac: 10,
        action: false,
        bonus: false,
        reaction: false,
        status: 'alive',
        conditions: [],
        expanded: false
      });
    }
  });

  persist();
  $('modal-add-players').style.display = 'none';
  renderEncounter();
}

/* ============================================================
   ДОБАВЛЕНИЕ ВРАГА (одна форма)
   ============================================================ */

export function openAddEnemyModal() {
  const modal = $('modal-add-enemy');
  if (!modal) return;
  // Сброс полей
  $('enemy-name').value = 'Гоблин';
  $('enemy-hp').value = '7';
  $('enemy-ac').value = '15';
  $('enemy-init').value = '';
  const errEl = $('enemy-error');
  if (errEl) errEl.textContent = '';
  modal.style.display = 'flex';
}

export function confirmAddEnemy() {
  const errEl = $('enemy-error');
  if (errEl) errEl.textContent = '';

  const name = $('enemy-name').value.trim();
  const hp = parseInt($('enemy-hp').value, 10);
  const ac = parseInt($('enemy-ac').value, 10);
  const initStr = $('enemy-init').value.trim();
  const initiative = initStr === '' ? Math.floor(Math.random() * 20) + 1 : parseInt(initStr, 10) || 0;

  if (!name) { if (errEl) errEl.textContent = 'Введите имя'; return; }
  if (isNaN(hp) || hp < 1) { if (errEl) errEl.textContent = 'HP должно быть ≥ 1'; return; }
  if (isNaN(ac) || ac < 1) { if (errEl) errEl.textContent = 'КД должно быть ≥ 1'; return; }

  state.encounter.combatants.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    refId: null,
    name,
    isEnemy: true,
    initiative,
    hp,
    maxHp: hp,
    tempHp: 0,
    ac,
    action: false,
    bonus: false,
    reaction: false,
    status: 'alive',
    conditions: [],
    expanded: false
  });
  persist();
  $('modal-add-enemy').style.display = 'none';
  renderEncounter();
}

/* ============================================================
   СБРОС
   ============================================================ */

export async function resetEncounter() {
  const ok = await showConfirm('Завершить бой и очистить список?', 'Очистить', 'Отмена');
  if (!ok) return;
  state.encounter = { active: false, round: 1, turnIndex: 0, combatants: [] };
  persist();
  renderEncounter();
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

export function initEncounterHandlers() {
  const btnPlayers = $('btn-add-players-enc');
  if (btnPlayers) btnPlayers.addEventListener('click', openAddPlayersModal);

  const btnEnemy = $('btn-add-enemy-enc');
  if (btnEnemy) btnEnemy.addEventListener('click', openAddEnemyModal);

  const btnNext = $('btn-next-turn');
  if (btnNext) btnNext.addEventListener('click', nextTurn);

  const btnReset = $('btn-reset-enc');
  if (btnReset) btnReset.addEventListener('click', resetEncounter);

  // Модалка выбора игроков
  const btnConfirmPlayers = $('btn-confirm-add-players');
  if (btnConfirmPlayers) btnConfirmPlayers.addEventListener('click', confirmAddPlayers);
  const btnCancelPlayers = $('btn-cancel-add-players');
  if (btnCancelPlayers) btnCancelPlayers.addEventListener('click', () => {
    $('modal-add-players').style.display = 'none';
  });

  // Модалка добавления врага
  const btnConfirmEnemy = $('btn-confirm-add-enemy');
  if (btnConfirmEnemy) btnConfirmEnemy.addEventListener('click', confirmAddEnemy);
  const btnCancelEnemy = $('btn-cancel-add-enemy');
  if (btnCancelEnemy) btnCancelEnemy.addEventListener('click', () => {
    $('modal-add-enemy').style.display = 'none';
  });
}
