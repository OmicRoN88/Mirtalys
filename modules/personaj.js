/* ============================================================
   PERSONAJ.JS — Логика раздела «Персонаж»
   Создание Игрока (попадает в «Состав»)
   ============================================================ */

import {
  $, state, persist,
  escapeHtml, escapeAttr,
  ensureAccount,
  DND_CLASSES, DND_LEVELS
} from './core.js';

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ВЫПАДАЮЩИХ СПИСКОВ
   ============================================================ */

export function initPersonajHandlers() {
  // Классы
  const classSel = $('personaj-class');
  if (classSel) {
    DND_CLASSES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSel.appendChild(opt);
    });
  }

  // Уровни
  const levelSel = $('personaj-level');
  if (levelSel) {
    DND_LEVELS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l;
      levelSel.appendChild(opt);
    });
    levelSel.value = '1';
  }

  // Кнопка «Создать»
  const btn = $('btn-create-personaj');
  if (btn) btn.addEventListener('click', createPersonaj);
}

/* ============================================================
   СОЗДАНИЕ ПЕРСОНАЖА
   ============================================================ */

function createPersonaj() {
  const errEl = $('personaj-error');
  if (errEl) errEl.textContent = '';

  const name = $('personaj-name').value.trim();
  const species = $('personaj-species').value.trim();
  const position = $('personaj-position').value.trim();
  const class1 = $('personaj-class').value;
  const level = parseInt($('personaj-level').value, 10) || 1;
  const info = $('personaj-info').value;

  if (!name) { if (errEl) errEl.textContent = 'Введите имя'; return; }

  // Проверка на дубликат
  const dup = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (dup) {
    if (errEl) errEl.textContent = 'Персонаж с таким именем уже есть';
    return;
  }

  const newMember = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, type: 'Игрок', fired: false,
    rank: '', position, info, expanded: true,
    species,
    classes: class1 ? [class1] : [],
    level
  };
  state.members.push(newMember);
  ensureAccount(name);
  persist();

  // Очистка формы
  $('personaj-name').value = '';
  $('personaj-species').value = '';
  $('personaj-position').value = '';
  $('personaj-info').value = '';
  if ($('personaj-level')) $('personaj-level').value = '1';
  if ($('personaj-class')) $('personaj-class').selectedIndex = 0;

  // Обновляем состав и шапку
  if (typeof window.__renderBank === 'function') window.__renderBank();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();

  // Показываем сообщение об успехе
  if (errEl) {
    errEl.style.color = 'var(--success)';
    errEl.textContent = `Персонаж «${name}» создан и добавлен в состав!`;
    setTimeout(() => {
      errEl.style.color = '';
      errEl.textContent = '';
    }, 3000);
  }
}
