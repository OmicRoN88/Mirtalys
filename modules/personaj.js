/* ============================================================
   PERSONAJ.JS — Логика раздела «Персонаж»
   ============================================================ */

import {
  $, state, persist,
  ensureAccount,
  DND_CLASSES, DND_LEVELS
} from './core.js';

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
  const class2Sel = $('personaj-class2');
  if (class2Sel) {
    DND_CLASSES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      class2Sel.appendChild(opt);
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

  // Мультикласс
  const addBtn = $('personaj-add-class');
  if (addBtn) addBtn.addEventListener('click', () => {
    $('personaj-class2-wrapper').style.display = 'flex';
    $('personaj-add-class').style.display = 'none';
  });
  const removeBtn = $('personaj-remove-class');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    $('personaj-class2-wrapper').style.display = 'none';
    $('personaj-add-class').style.display = 'inline-flex';
  });

  // Кнопка «Добавить»
  const btn = $('btn-create-personaj');
  if (btn) btn.addEventListener('click', createPersonaj);
}

function createPersonaj() {
  const errEl = $('personaj-error');
  if (errEl) errEl.textContent = '';

  const name = $('personaj-name').value.trim();
  const species = $('personaj-species').value.trim();
  const position = $('personaj-position').value.trim();
  const class1 = $('personaj-class').value;
  const class2Visible = $('personaj-class2-wrapper').style.display !== 'none';
  const class2 = class2Visible ? $('personaj-class2').value : '';
  const level = parseInt($('personaj-level').value, 10) || 1;
  const maxHp = parseInt($('personaj-maxhp').value, 10) || 10;
  const ac = parseInt($('personaj-ac').value, 10) || 10;
  const passive = parseInt($('personaj-passive').value, 10) || 10;
  const weight = parseInt($('personaj-weight').value, 10) || 0;
  const info = $('personaj-info').value;

  if (!name) { if (errEl) errEl.textContent = 'Введите имя'; return; }

  const dup = state.members.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (dup) { if (errEl) errEl.textContent = 'Персонаж с таким именем уже есть'; return; }

  const classes = [];
  if (class1) classes.push(class1);
  if (class2 && class2 !== class1) classes.push(class2);

  state.members.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, type: 'Игрок', fired: false,
    rank: '', position, info, expanded: false,
    species,
    classes,
    level,
    hp: maxHp,
    maxHp,
    ac,
    passivePerception: passive,
    weight
  });
  ensureAccount(name);
  persist();

  // Очистка формы
  $('personaj-name').value = '';
  $('personaj-species').value = '';
  $('personaj-position').value = '';
  $('personaj-info').value = '';
  if ($('personaj-level')) $('personaj-level').value = '1';
  if ($('personaj-class')) $('personaj-class').selectedIndex = 0;
  if ($('personaj-class2-wrapper')) $('personaj-class2-wrapper').style.display = 'none';
  if ($('personaj-add-class')) $('personaj-add-class').style.display = 'inline-flex';
  if ($('personaj-maxhp')) $('personaj-maxhp').value = '10';
  if ($('personaj-ac')) $('personaj-ac').value = '10';
  if ($('personaj-passive')) $('personaj-passive').value = '10';
  if ($('personaj-weight')) $('personaj-weight').value = '0';

  if (typeof window.__renderBank === 'function') window.__renderBank();
  if (typeof window.__renderHeader === 'function') window.__renderHeader();

  if (errEl) {
    errEl.style.color = 'var(--success)';
    errEl.textContent = `Персонаж «${name}» создан и добавлен в состав!`;
    setTimeout(() => {
      errEl.style.color = '';
      errEl.textContent = '';
    }, 3000);
  }
}
