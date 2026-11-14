/* ============================================================
   ENCOUNTER.JS — Боевой трекер
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr, cssEscape
} from './core.js';

import { showConfirm } from './dialogi.js';

/* ============================================================
   КОНСТАНТЫ
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

function isDead(c) { return c.status === 'dead'; }
function isUnconscious(c) { return c.status === 'unconscious'; }
function isStable(c) { return c.status === 'stable'; }

function mustSkipTurn(c) {
  if (isDead(c)) return true;
  // Бессознательные и стабилизированные НЕ пропускаются —
  // их ход нужен для спасбросков (или просто чтобы Мастер видел)
  if (isUnconscious(c)) return false;
  if (isStable(c)) return true;
  return c.conditions && c.conditions.some(cond => SKIP_TURN_CONDITIONS.includes(cond));
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function resetOldResources(c, currentRound) {
  if (!c.usedRound) c.usedRound = { action: 0, bonus: 0, reaction: 0 };
  if (c.usedRound.action < currentRound) c.action = false;
  if (c.usedRound.bonus < currentRound) c.bonus = false;
  if (c.usedRound.reaction < currentRound) c.reaction = false;
}

function getHpColorClass(c) {
  if (c.hp >= c.maxHp) return 'hp-full';
  if (c.hp > c.maxHp * 0.5) return 'hp-mid';
  return 'hp-low';
}

function ensureLogs() {
  if (!state.encounter.logs) state.encounter.logs = {};
}

function getLogEntry(id) {
  ensureLogs();
  if (!state.encounter.logs[id]) {
    state.encounter.logs[id] = { damage: 0, heal: 0, kills: 0 };
  }
  return state.encounter.logs[id];
}

function ensureDeathSaves(c) {
  if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
}

/* ============================================================
   МИНИ-ДИАЛОГ: HP / THP
   ============================================================ */

function showHpDialog(combatant, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <p>${escapeHtml(combatant.name)}<br>
        HP: ${combatant.hp}/${combatant.maxHp}${combatant.tempHp ? ` <span style="color:var(--accent);">THP: ${combatant.tempHp}</span>` : ''}
      </p>
      <input type="number" id="hp-dialog-input" min="0" placeholder="Значение" style="margin-bottom: 12px;">
      <div class="field" style="margin-bottom: 16px; flex-direction: row; align-items: center; gap: 8px;">
        <input type="checkbox" id="hp-dialog-temp" style="width:auto;">
        <label for="hp-dialog-temp" style="text-transform:none; font-size:0.9rem; color:var(--text);">Это временные HP (THP)</label>
      </div>
      <div class="dialog-actions">
        <button class="secondary" data-cancel>Отмена</button>
        <button class="danger" data-damage>Урон</button>
        <button class="success-btn" data-heal>Исцеление</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#hp-dialog-input');
  const tempCheck = overlay.querySelector('#hp-dialog-temp');
  input.focus();
  const close = () => overlay.remove();

  overlay.querySelector('[data-cancel]').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('[data-damage]').addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) return;
    if (tempCheck.checked) {
      // Установить THP
      combatant.tempHp = val;
    } else {
      applyDamage(combatant, val, null);
    }
    persist();
    close();
    onDone();
  });

  overlay.querySelector('[data-heal]').addEventListener('click', () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) return;
    if (tempCheck.checked) {
      combatant.tempHp = val;
    } else {
      applyHeal(combatant, val, null);
    }
    persist();
    close();
    onDone();
  });
}

/* ============================================================
   МИНИ-ДИАЛОГ: КД
   ============================================================ */

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
   ЛОГИКА УРОНА / ИСЦЕЛЕНИЯ
   ============================================================ */

function applyDamage(target, val, sourceLog) {
  let dmg = val;
  // Сначала THP
  if (target.tempHp > 0) {
    const absorbed = Math.min(target.tempHp, dmg);
    target.tempHp -= absorbed;
    dmg -= absorbed;
  }

  // Применяем к HP
  const newHp = target.hp - dmg;

  if (newHp <= 0) {
    target.hp = 0;

    if (target.isEnemy) {
      // Враги умирают сразу
      if (target.status !== 'dead') {
        target.status = 'dead';
        if (sourceLog) sourceLog.kills += 1;
      }
    } else {
      // Игрок: проверяем на мгновенную смерть
      // Урон, прошедший после THP = dmg
      // Условие мгновенной смерти: dmg >= текущий_HP + максимальный_HP
      // Но HP уже 0, поэтому используем исходный HP
      const originalHp = target.hp + dmg; // = исходный HP
      const massiveDamage = dmg >= originalHp + target.maxHp;

      if (massiveDamage) {
        // Мгновенная смерть
        target.status = 'dead';
        if (sourceLog) sourceLog.kills += 1;
      } else if (target.status === 'unconscious' || target.status === 'stable') {
        // Уже без сознания — +2 провала
        ensureDeathSaves(target);
        target.deathSaves.failures = Math.min(3, target.deathSaves.failures + 2);
        if (target.deathSaves.failures >= 3) {
          target.status = 'dead';
          if (sourceLog) sourceLog.kills += 1;
        }
      } else {
        // Только что упал без сознания
        target.status = 'unconscious';
        ensureDeathSaves(target);
      }
    }
  } else {
    target.hp = newHp;
  }

  if (sourceLog) sourceLog.damage += val;
}

function applyHeal(target, val, sourceLog) {
  const wasUnconscious = isUnconscious(target) || isStable(target);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + val);
  const healed = target.hp - before;

  if (target.hp > 0) {
    if (wasUnconscious) {
      target.status = 'alive';
      target.deathSaves = { successes: 0, failures: 0 };
      if (!Array.isArray(target.conditions)) target.conditions = [];
      if (!target.conditions.includes('Опрокинутый')) {
        target.conditions.push('Опрокинутый');
      }
    } else if (target.status === 'dead' && !target.isEnemy) {
      target.status = 'alive';
    }
  }

  if (sourceLog) sourceLog.heal += healed;
}

/* ============================================================
   МОДАЛКА УРОНА / ИСЦЕЛЕНИЯ (массовая)
   ============================================================ */

let damageMode = 'damage';
let damageSourceId = null;

function openDamageModal(sourceId, mode) {
  damageMode = mode;
  damageSourceId = sourceId;
  const modal = $('modal-damage');
  const list = $('damage-targets-list');
  const title = $('damage-modal-title');
  const valInput = $('damage-value');
  const errEl = $('damage-error');
  if (!modal || !list) return;

  if (title) title.textContent = mode === 'damage' ? 'Нанести урон' : 'Исцелить';
  if (valInput) valInput.value = '1';
  if (errEl) errEl.textContent = '';

  const enc = state.encounter;
  const sorted = [...enc.combatants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  list.innerHTML = sorted.map(c => {
    const dead = isDead(c);
    return `
      <label class="add-player-row ${dead ? 'already' : ''}">
        <input type="checkbox" data-damage-target="${c.id}" ${dead ? 'disabled' : ''}>
        <span>${escapeHtml(c.name)}</span>
        <span class="hint">${c.hp}/${c.maxHp}${c.tempHp ? ` (+${c.tempHp} THP)` : ''}${isUnconscious(c) ? ' — без сознания' : ''}${isStable(c) ? ' — стабилизирован' : ''}</span>
        ${dead ? '<span class="hint">(мертв)</span>' : ''}
      </label>
    `;
  }).join('');

  modal.style.display = 'flex';
}

function confirmDamage() {
  const list = $('damage-targets-list');
  const valInput = $('damage-value');
  const errEl = $('damage-error');
  if (!list || !valInput) return;
  if (errEl) errEl.textContent = '';

  const val = parseInt(valInput.value, 10);
  if (isNaN(val) || val <= 0) {
    if (errEl) errEl.textContent = 'Введите значение больше 0';
    return;
  }

  const enc = state.encounter;
  const source = enc.combatants.find(c => c.id === damageSourceId);
  const sourceLog = source ? getLogEntry(source.id) : null;

  let applied = 0;
  list.querySelectorAll('[data-damage-target]').forEach(el => {
    if (!el.checked || el.disabled) return;
    const target = enc.combatants.find(c => c.id === el.dataset.damageTarget);
    if (!target) return;

    if (damageMode === 'damage') {
      applyDamage(target, val, sourceLog);
    } else {
      applyHeal(target, val, sourceLog);
    }
    applied++;
  });

  if (!applied) {
    if (errEl) errEl.textContent = 'Выберите хотя бы одну цель';
    return;
  }

  persist();
  $('modal-damage').style.display = 'none';
  renderEncounter();
}

/* ============================================================
   ОТРИСОВКА
   ============================================================ */

export function renderEncounter() {
  const container = $('encounter-list');
  const roundEl = $('encounter-round');
  const nextBtn = $('btn-next-turn');
  const finishBtn = $('btn-finish-enc');
  if (!container) return;

  const enc = state.encounter;
  enc.combatants.forEach(c => resetOldResources(c, enc.round));

  if (nextBtn) {
    if (enc.active) {
      nextBtn.textContent = 'Следующий ход';
      nextBtn.className = 'success-btn';
    } else {
      nextBtn.textContent = 'Начать бой';
      nextBtn.className = 'warn';
    }
  }

  if (finishBtn) {
    finishBtn.textContent = enc.finished ? 'Логи' : 'Закончить';
    finishBtn.className = 'secondary small';
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
    const unconscious = isUnconscious(c);
    const stable = isStable(c);
    const expanded = c.expanded === true;
    const hpClass = getHpColorClass(c);
    const lowHp = c.hp > 0 && c.hp <= c.maxHp * 0.5;

    let rowClass = 'encounter-row';
    rowClass += c.isEnemy ? ' enemy' : ' player';
    if (dead) rowClass += ' dead';
    if (isActive) rowClass += ' active';
    if (!expanded) rowClass += ' collapsed';

    let statusBadges = '';
    if (dead) statusBadges += `<span class="enc-status danger">Мертв</span>`;
    if (unconscious) statusBadges += `<span class="enc-status danger">Без сознания</span>`;
    if (stable) statusBadges += `<span class="enc-status warning">Стабилизирован</span>`;
    if (c.conditions) {
      c.conditions.forEach(cond => {
        statusBadges += `<span class="enc-status warning">${escapeHtml(cond)}</span>`;
      });
    }

    // Спасброски (только для бессознательных, НЕ для стабилизированных)
    let deathSavesHtml = '';
    if (unconscious && !c.isEnemy) {
      ensureDeathSaves(c);
      deathSavesHtml = `
        <div class="death-saves">
          <div class="death-save-row">
            <span class="death-save-label success-label">Успехи</span>
            <div class="death-save-cells">
              ${[0,1,2].map(i => `
                <input type="checkbox" class="death-checkbox" data-ds="success" data-idx="${i}" data-id="${c.id}" ${i < c.deathSaves.successes ? 'checked' : ''}>
              `).join('')}
            </div>
          </div>
          <div class="death-save-row">
            <span class="death-save-label failure-label">Провалы</span>
            <div class="death-save-cells">
              ${[0,1,2].map(i => `
                <input type="checkbox" class="death-checkbox failure" data-ds="failure" data-idx="${i}" data-id="${c.id}" ${i < c.deathSaves.failures ? 'checked' : ''}>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

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
      ${deathSavesHtml}
      <div class="enc-actions">
        <button class="small danger" data-damage="${c.id}">Урон</button>
        <button class="small success-btn" data-heal="${c.id}">Исцеление</button>
        ${(unconscious || stable) && !c.isEnemy ? `<button class="small warn" data-stabilize="${c.id}">Стабилизирован</button>` : ''}
        <button class="small secondary" data-remove="${c.id}" style="margin-left: auto;">Удалить из боя</button>
      </div>
    ` : '';

    const thpHtml = c.tempHp > 0 ? `; <span style="color: var(--accent);">THP: ${c.tempHp}</span>` : '';

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
            <b class="enc-hp-clickable ${hpClass}" data-hp-click="${c.id}">HP: ${c.hp}/${c.maxHp}${thpHtml}</b>
            <b class="enc-ac-clickable" data-ac-click="${c.id}">КД: ${c.ac}</b>
            ${lowHp ? '<span class="enc-bloodied">Окровавлен</span>' : ''}
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
      if (!c) return;
      const key = el.dataset.res;
      c[key] = el.checked;
      if (!c.usedRound) c.usedRound = { action: 0, bonus: 0, reaction: 0 };
      c.usedRound[key] = el.checked ? enc.round : 0;
      persist();
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

  // Спасброски
  container.querySelectorAll('[data-ds]').forEach(el => {
    el.addEventListener('change', (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.id);
      if (!c) return;
      ensureDeathSaves(c);
      const idx = parseInt(el.dataset.idx, 10);
      const key = el.dataset.ds === 'success' ? 'successes' : 'failures';
      if (el.checked) {
        c.deathSaves[key] = Math.max(c.deathSaves[key], idx + 1);
      } else {
        c.deathSaves[key] = Math.min(c.deathSaves[key], idx);
      }
      if (c.deathSaves.successes >= 3) c.status = 'stable';
      if (c.deathSaves.failures >= 3) c.status = 'dead';
      persist();
      renderEncounter();
    });
  });

  // Стабилизация
  container.querySelectorAll('[data-stabilize]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = enc.combatants.find(x => x.id === el.dataset.stabilize);
      if (!c) return;
      c.status = 'stable';
      c.deathSaves = { successes: 0, failures: 0 };
      persist();
      renderEncounter();
    });
  });

  container.querySelectorAll('[data-damage]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openDamageModal(el.dataset.damage, 'damage');
    });
  });

  container.querySelectorAll('[data-heal]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openDamageModal(el.dataset.heal, 'heal');
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

  enc.combatants.forEach(c => { c.expanded = false; });

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

  const current = sorted[enc.turnIndex];
  if (current) current.expanded = true;

  enc.combatants.forEach(c => resetOldResources(c, enc.round));

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
        expanded: false,
        usedRound: { action: 0, bonus: 0, reaction: 0 },
        deathSaves: { successes: 0, failures: 0 }
      });
    }
  });

  persist();
  $('modal-add-players').style.display = 'none';
  renderEncounter();
}

/* ============================================================
   ДОБАВЛЕНИЕ ВРАГА
   ============================================================ */

export function openAddEnemyModal() {
  const modal = $('modal-add-enemy');
  if (!modal) return;
  $('enemy-name').value = 'Гоблин';
  $('enemy-count').value = '1';
  $('enemy-hp').value = '7';
  $('enemy-ac').value = '15';
  $('enemy-init-bonus').value = '0';
  $('enemy-roll-d20').checked = true;
  const errEl = $('enemy-error');
  if (errEl) errEl.textContent = '';
  modal.style.display = 'flex';
}

export function confirmAddEnemy() {
  const errEl = $('enemy-error');
  if (errEl) errEl.textContent = '';

  const name = $('enemy-name').value.trim();
  const count = parseInt($('enemy-count').value, 10);
  const hp = parseInt($('enemy-hp').value, 10);
  const ac = parseInt($('enemy-ac').value, 10);
  const initBonus = parseInt($('enemy-init-bonus').value, 10) || 0;
  const rollD20Checked = $('enemy-roll-d20').checked;

  if (!name) { if (errEl) errEl.textContent = 'Введите имя'; return; }
  if (isNaN(count) || count < 1) { if (errEl) errEl.textContent = 'Количество должно быть ≥ 1'; return; }
  if (isNaN(hp) || hp < 1) { if (errEl) errEl.textContent = 'HP должно быть ≥ 1'; return; }
  if (isNaN(ac) || ac < 1) { if (errEl) errEl.textContent = 'КД должно быть ≥ 1'; return; }

  for (let i = 1; i <= count; i++) {
    const displayName = count > 1 ? `${name} ${i}` : name;
    const initiative = rollD20Checked ? (rollD20() + initBonus) : 0;
    state.encounter.combatants.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + i,
      refId: null,
      name: displayName,
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
      expanded: false,
      usedRound: { action: 0, bonus: 0, reaction: 0 }
    });
  }

  persist();
  $('modal-add-enemy').style.display = 'none';
  renderEncounter();
}

/* ============================================================
   ЗАКОНЧИТЬ / ЛОГИ / СБРОС
   ============================================================ */

export function finishEncounter() {
  const enc = state.encounter;
  if (enc.finished) {
    openLogsModal();
  } else {
    enc.finished = true;
    persist();
    renderEncounter();
    openLogsModal();
  }
}

function openLogsModal() {
  const modal = $('modal-logs');
  const content = $('logs-content');
  if (!modal || !content) return;

  const enc = state.encounter;
  ensureLogs();

  const players = enc.combatants.filter(c => !c.isEnemy);
  const rows = players.map(c => {
    const log = getLogEntry(c.id);
    return `<tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${log.damage}</td>
      <td>${log.heal}</td>
      <td>${log.kills}</td>
    </tr>`;
  }).join('');

  content.innerHTML = players.length ? `
    <table class="logs-table">
      <thead>
        <tr><th>Игрок</th><th>Нанесено урона</th><th>Исцелено</th><th>Убийств</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  ` : '<div class="empty">Нет игроков в бою</div>';

  modal.style.display = 'flex';
}

export async function resetEncounter() {
  const ok = await showConfirm('Сбросить бой полностью? История, список участников и логи будут очищены.', 'Сбросить', 'Отмена');
  if (!ok) return;
  state.encounter = {
    active: false,
    round: 1,
    turnIndex: 0,
    combatants: [],
    finished: false,
    logs: {}
  };
  persist();
  $('modal-logs').style.display = 'none';
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

  const btnFinish = $('btn-finish-enc');
  if (btnFinish) btnFinish.addEventListener('click', finishEncounter);

  const btnConfirmPlayers = $('btn-confirm-add-players');
  if (btnConfirmPlayers) btnConfirmPlayers.addEventListener('click', confirmAddPlayers);
  const btnCancelPlayers = $('btn-cancel-add-players');
  if (btnCancelPlayers) btnCancelPlayers.addEventListener('click', () => {
    $('modal-add-players').style.display = 'none';
  });

  const btnConfirmEnemy = $('btn-confirm-add-enemy');
  if (btnConfirmEnemy) btnConfirmEnemy.addEventListener('click', confirmAddEnemy);
  const btnCancelEnemy = $('btn-cancel-add-enemy');
  if (btnCancelEnemy) btnCancelEnemy.addEventListener('click', () => {
    $('modal-add-enemy').style.display = 'none';
  });

  const btnConfirmDamage = $('btn-confirm-damage');
  if (btnConfirmDamage) btnConfirmDamage.addEventListener('click', confirmDamage);
  const btnCancelDamage = $('btn-cancel-damage');
  if (btnCancelDamage) btnCancelDamage.addEventListener('click', () => {
    $('modal-damage').style.display = 'none';
  });

  const btnResetFromLogs = $('btn-reset-from-logs');
  if (btnResetFromLogs) btnResetFromLogs.addEventListener('click', resetEncounter);
  const btnCloseLogs = $('btn-close-logs');
  if (btnCloseLogs) btnCloseLogs.addEventListener('click', () => {
    $('modal-logs').style.display = 'none';
  });
}
