/**
 * ui.js — DOM manipulation helpers & theme toggle
 *
 * Initialises the light/dark theme toggle and provides
 * small DOM utility functions used by other modules.
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
