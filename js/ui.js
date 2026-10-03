/**
 * ui.js — DOM manipulation helpers, theme toggle & EventLog
 *
 * Initialises the light/dark theme toggle, provides DOM utility
 * functions, and implements the detection event timeline & logger.
 */

'use strict';

const UI = (() => {
  /* ── Theme toggle ── */
  const THEME_KEY = 'captchasec-theme';

  function initTheme() {
    const saved = Storage.get(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    // If nothing saved, respect system preference
    else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.set(THEME_KEY, next);
  }

  /* ── Helpers ── */

  /** @param {string} id @returns {HTMLElement|null} */
  function $(id) {
    return document.getElementById(id);
  }

  return { initTheme, toggleTheme, $ };
})();

/**
 * EventLog — Real-time detection timeline & event logger
 */
const EventLog = (() => {
  let entries = [];
  let sessionStart = performance.now();

  function resetSession() {
    sessionStart = performance.now();
  }

  function getRelativeTime() {
    const elapsed = Math.max(0, (performance.now() - sessionStart) / 1000);
    return `+${elapsed.toFixed(2)}s`;
  }

  function log(category, message, details = '') {
    const timeStr = getRelativeTime();
    const entry = { time: timeStr, category, message, details, timestamp: Date.now() };
    entries.push(entry);

    const list = document.getElementById('event-log-list');
    const count = document.getElementById('event-log-count');
    if (count) count.textContent = `${entries.length} event${entries.length === 1 ? '' : 's'}`;

    if (list) {
      const empty = list.querySelector('.event-log__empty');
      if (empty) empty.remove();

      const item = document.createElement('div');
      item.className = `event-item event-item--${category.toLowerCase()}`;

      item.innerHTML = `
        <span class="event-item__time">${timeStr}</span>
        <span class="event-item__badge event-item__badge--${category.toLowerCase()}">${category}</span>
        <span class="event-item__msg">${escapeHtml(message)}</span>
      `;
      list.appendChild(item);
      list.scrollTop = list.scrollHeight;
    }
  }

  function clear() {
    entries = [];
    const list = document.getElementById('event-log-list');
    const count = document.getElementById('event-log-count');
    if (count) count.textContent = '0 events';
    if (list) {
      list.innerHTML = '<div class="event-log__empty">Awaiting interactions or simulation...</div>';
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    const clearBtn = document.getElementById('event-log-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', clear);
    }
  }

  return { init, log, clear, resetSession, getEntries: () => [...entries] };
})();
