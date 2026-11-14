/* ============================================================
   ENCOUNTER.JS — Боевой трекер
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm, showPrompt } from './dialogi.js';

/* ============================================================
   ОТРИСОВКА
   ============================================================ */

export function renderEncounter() {
  const container = $('encounter-list');
  const roundEl = $('encounter-round');
  if (!container) return;

  const enc = state.encounter;

  if (!enc.combatants.length) {
    container.innerHTML = '<div class="empty">Нет участников боя</div>';
    if (roundEl) roundEl.textContent = '';
    return;
  }

  if (roundEl) {
    roundEl.textContent = enc.active ? `Раунд №${enc.round}` : 'Бой не начат';
  }

  // Сортировка по инициативе (по убыванию)
  const sorted = [...enc.combatants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
  const activeId = enc.active && sorted[enc.turnIndex] ? sorted[enc.turnIndex].id : null;

  container.innerHTML = '';
  sorted.forEach((c, idx) => {
    const isActive = c.id === activeId;
    const isDead = c.status === 'dead';
    const isDisabled = c.status === 'disabled';

    let rowClass = 'encounter-row';
    rowClass += c.isEnemy ? ' enemy' : ' player';
    if (isDead) rowClass += ' dead';
    if (isActive) rowClass += ' active';

    const row = document.createElement('div');
    row.className = rowClass;

    row.innerHTML = `
      <div class="enc-initiative">
        <input type="number" class="enc-init-input" data-init="${c.id}" value="${c.initiative || ''}" placeholder="Иниц.">
        ${c.isEnemy ? `<button class="small secondary" data-roll="${c.id}" title="Бросок d20">🎲</button>` : ''}
      </div>
      <div class="enc-main">
        <div class="enc-head">
          <span class="enc-name">${escapeHtml(c.name)}</span>
          <span class="enc-hp">HP: <input type="number" class="enc-hp-input" data-hp="${c.id}" value="${c.hp}" min="0"> / ${c.maxHp}</span>
          <span class="enc-ac">КД: ${c.ac}</span>
        </div>
        <div class="enc-resources">
          <label><input type="checkbox" data-res="action" data-id="${c.id}" ${c.action ? 'checked' : ''}> Действие</label>
          <label><input type="checkbox" data-res="bonus" data-id="${c.id}" ${c.bonus ? 'checked' : ''}> Бонусное</label>
          <label><input type="checkbox" data-res="reaction" data-id="${c.id}" ${c.reaction ? 'checked' : ''}> Реакция</label>
          <label><input type="checkbox" data-res="movement" data-id="${c.id}" ${c.movement ? 'checked' : ''}> Движение</label>
        </div>
        ${isDisabled ? `<div class="enc-status warning">Оглушен/Парализован (пропуск хода)</div>` : ''}
        ${isDead ? `<div class="enc-status danger">Мертв</div>` : ''}
        <div class="enc-actions">
          <button class="small ${isActive ? 'warn' : 'secondary'}" data-set-active="${c.id}">Ход</button>
          <button class="small danger" data-toggle-dead="${c.id}">${isDead ? 'Воскресить' : 'Мертв'}</button>
          <button class="small warn" data-toggle-disabled="${c.id}">${isDisabled ? 'Снять оглушение' : 'Оглушен'}</button>
          <button class="small secondary" data-remove="${c.id}">Удалить</button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  // Обработчики
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

  container.querySelectorAll('[data-roll]').forEach(el => {
    el.addEventListener('click', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.roll);
      if (c) {
        c.initiative = Math.floor(Math.random() * 20) + 1;
        persist();
        renderEncounter();
      }
    });
  });

  container.querySelectorAll('[data-hp]').forEach(el => {
    el.addEventListener('change', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.hp);
      if (c) {
        c.hp = parseInt(el.value, 10) || 0;
        if (c.hp <= 0) c.status = 'dead';
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

  container.querySelectorAll('[data-set-active]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = sorted.findIndex(x => x.id === el.dataset.setActive);
      if (idx >= 0) {
        enc.turnIndex = idx;
        enc.active = true;
        persist();
        renderEncounter();
      }
    });
  });

  container.querySelectorAll('[data-toggle-dead]').forEach(el => {
    el.addEventListener('click', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.toggleDead);
      if (c) {
        c.status = c.status === 'dead' ? 'alive' : 'dead';
        if (c.status === 'dead') c.hp = 0;
        persist();
        renderEncounter();
      }
    });
  });

  container.querySelectorAll('[data-toggle-disabled]').forEach(el => {
    el.addEventListener('click', () => {
      const c = enc.combatants.find(x => x.id === el.dataset.toggleDisabled);
      if (c) {
        c.status = c.status === 'disabled' ? 'alive' : 'disabled';
        persist();
        renderEncounter();
      }
    });
  });

  container.querySelectorAll('[data-remove]').forEach(el => {
    el.addEventListener('click', async () => {
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
    enc.turnIndex = 0;
  } else {
    let nextIdx = enc.turnIndex + 1;
    let guard = 0;
    while (guard < 100) {
      if (nextIdx >= sorted.length) {
        nextIdx = 0;
        enc.round += 1;
      }
      const c = sorted[nextIdx];
      if (c.status === 'dead' || c.status === 'disabled') {
        nextIdx++;
        guard++;
        continue;
      }
      enc.turnIndex = nextIdx;
      break;
    }
  }

  // Сбрасываем ресурсы у текущего существа
  const current = sorted[enc.turnIndex];
  if (current) {
    current.action = false;
    current.bonus = false;
    current.reaction = false;
    current.movement = false;
  }

  persist();
  renderEncounter();
}

/* ============================================================
   ДОБАВЛЕНИЕ
   ============================================================ */

export function addPlayersToEncounter() {
  const players = state.members.filter(m => m.type === 'Игрок' && !m.fired);
  let added = 0;
  players.forEach(p => {
    if (state.encounter.combatants.some(c => c.refId === p.id)) return;
    state.encounter.combatants.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      refId: p.id,
      name: p.name,
      isEnemy: false,
      initiative: 0,
      hp: 10,
      maxHp: 10,
      ac: 10,
      action: false,
      bonus: false,
      reaction: false,
      movement: false,
      status: 'alive'
    });
    added++;
  });
  persist();
  renderEncounter();
  if (!added) alert('Все игроки уже добавлены в бой');
}

export async function addEnemy() {
  const name = await showPrompt('Имя врага:', 'Гоблин');
  if (!name) return;
  const hpStr = await showPrompt('Максимум HP:', '7');
  const hp = parseInt(hpStr, 10) || 7;
  const acStr = await showPrompt('Класс брони (КД):', '15');
  const ac = parseInt(acStr, 10) || 10;
  const initStr = await showPrompt('Инициатива (или оставьте пустым для броска):', '');
  const initiative = initStr === null || initStr === '' ? Math.floor(Math.random() * 20) + 1 : parseInt(initStr, 10) || 0;

  state.encounter.combatants.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    refId: null,
    name,
    isEnemy: true,
    initiative,
    hp,
    maxHp: hp,
    ac,
    action: false,
    bonus: false,
    reaction: false,
    movement: false,
    status: 'alive'
  });
  persist();
  renderEncounter();
}

/* ============================================================
   СБРОС БОЯ
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
  if (btnPlayers) btnPlayers.addEventListener('click', addPlayersToEncounter);

  const btnEnemy = $('btn-add-enemy-enc');
  if (btnEnemy) btnEnemy.addEventListener('click', addEnemy);

  const btnNext = $('btn-next-turn');
  if (btnNext) btnNext.addEventListener('click', nextTurn);

  const btnReset = $('btn-reset-enc');
  if (btnReset) btnReset.addEventListener('click', resetEncounter);
}
