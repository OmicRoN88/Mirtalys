/* ============================================================
   DIALOGI.JS — Кастомные диалоги в стиле сайта
   ============================================================ */

import { escapeHtml, escapeAttr } from './core.js';

export function showConfirm(message, okText = 'Да', cancelText = 'Отмена') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog">
        <p>${escapeHtml(message)}</p>
        <div class="dialog-actions">
          <button class="secondary" data-cancel>${cancelText}</button>
          <button data-ok>${okText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-ok]').addEventListener('click', () => {
      overlay.remove(); resolve(true);
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => {
      overlay.remove(); resolve(false);
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

export function showPrompt(message, defaultValue = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog">
        <p>${escapeHtml(message)}</p>
        <input type="text" id="dialog-input" value="${escapeAttr(defaultValue)}" style="margin-bottom: 16px;">
        <div class="dialog-actions">
          <button class="secondary" data-cancel>Отмена</button>
          <button data-ok>OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#dialog-input');
    input.focus();
    input.select();
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-ok]').addEventListener('click', () => close(input.value));
    overlay.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close(null);
    });
  });
}
