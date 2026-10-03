/**
 * ui.js — DOM manipulation helpers, theme toggle, EventLog, Settings Drawer & Pipeline
 *
 * Handles:
 *   • Light/Dark theme toggle & persistence
 *   • Event timeline & logging system
 *   • Settings slide-over drawer with strictness and detection layer toggles
 *   • "How it works" animated pipeline stage highlights
 */

'use strict';

const UI = (() => {
  /* ── Theme toggle ── */
  const THEME_KEY = 'captchasec-theme';

  function initTheme() {
    const saved = Storage.get(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
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
  function $(id) {
    return document.getElementById(id);
  }

  return { initTheme, toggleTheme, $ };
})();

/**
 * Settings — Detection strictness & layer configuration manager
 */
const Settings = (() => {
  const SETTINGS_KEY = 'captchasec-detection-settings';
  const DEFAULT = {
    strictness: 'medium', // 'low' | 'medium' | 'high'
    layers: {
      timing: true,
      mouse: true,
      keystrokes: true,
      paste: true,
      honeypot: true,
      env: true,
    },
  };

  let state = { ...DEFAULT, layers: { ...DEFAULT.layers } };

  function load() {
    const saved = Storage.get(SETTINGS_KEY, null);
    if (saved) {
      state = {
        strictness: saved.strictness || DEFAULT.strictness,
        layers: { ...DEFAULT.layers, ...(saved.layers || {}) },
      };
    }
    syncUI();
  }

  function save() {
    Storage.set(SETTINGS_KEY, state);
    syncUI();
  }

  function get() {
    return state;
  }

  function setStrictness(val) {
    state.strictness = val;
    save();
    if (typeof EventLog !== 'undefined') {
      EventLog.log('SYSTEM', `Security strictness updated to: ${val.toUpperCase()}`);
    }
  }

  function setLayer(layer, enabled) {
    state.layers[layer] = !!enabled;
    save();
    if (typeof EventLog !== 'undefined') {
      EventLog.log('SYSTEM', `Detection layer [${layer}] set to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  }

  function resetToDefaults() {
    state = { ...DEFAULT, layers: { ...DEFAULT.layers } };
    save();
    if (typeof EventLog !== 'undefined') {
      EventLog.log('SYSTEM', 'Detection settings restored to factory defaults');
    }
  }

  function syncUI() {
    // Strictness radio buttons
    const strictButtons = document.querySelectorAll('.strictness-btn');
    strictButtons.forEach(btn => {
      const isCur = btn.dataset.strictness === state.strictness;
      btn.classList.toggle('strictness-btn--active', isCur);
      btn.setAttribute('aria-checked', isCur ? 'true' : 'false');
    });

    // Layer checkboxes
    Object.entries(state.layers).forEach(([layerKey, isEnabled]) => {
      const input = UI.$(`toggle-layer-${layerKey}`);
      if (input) {
        input.checked = !!isEnabled;
      }
    });

    // Status description
    const strictDesc = UI.$('strictness-desc');
    if (strictDesc) {
      const descs = {
        low: 'Low (Lenient): Human ≤ 40, Bot > 75. Optimized for mobile, trackpads, and accessibility.',
        medium: 'Medium (Default): Human ≤ 30, Bot > 70. Standard balanced commercial fraud threshold.',
        high: 'High (Strict): Human ≤ 20, Bot > 60. Financial and high-security enterprise defense.',
      };
      strictDesc.textContent = descs[state.strictness] || '';
    }
  }

  function init() {
    load();

    // Drawer Open / Close
    const openBtn = UI.$('settings-open-btn');
    const closeBtn = UI.$('settings-close-btn');
    const backdrop = UI.$('settings-backdrop');
    const drawer = UI.$('settings-drawer');
    const resetBtn = UI.$('settings-reset-defaults');

    if (openBtn) {
      openBtn.addEventListener('click', openDrawer);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', resetToDefaults);
    }

    // Strictness button listeners
    const strictButtons = document.querySelectorAll('.strictness-btn');
    strictButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setStrictness(btn.dataset.strictness);
      });
    });

    // Layer toggle listeners
    const layerCheckboxes = document.querySelectorAll('.layer-checkbox');
    layerCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const layerKey = cb.dataset.layer;
        if (layerKey) {
          setLayer(layerKey, cb.checked);
        }
      });
    });

    // Keyboard navigation (ESC to close)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isDrawerOpen()) {
        closeDrawer();
      }
    });
  }

  function isDrawerOpen() {
    const drawer = UI.$('settings-drawer');
    return drawer && drawer.classList.contains('settings-drawer--open');
  }

  function openDrawer() {
    const drawer = UI.$('settings-drawer');
    const backdrop = UI.$('settings-backdrop');
    const openBtn = UI.$('settings-open-btn');

    if (drawer) {
      drawer.classList.add('settings-drawer--open');
      drawer.setAttribute('aria-hidden', 'false');
    }
    if (backdrop) {
      backdrop.classList.add('settings-backdrop--open');
    }
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'true');
    }

    // Focus close button for accessibility
    setTimeout(() => {
      const closeBtn = UI.$('settings-close-btn');
      if (closeBtn) closeBtn.focus();
    }, 100);
  }

  function closeDrawer() {
    const drawer = UI.$('settings-drawer');
    const backdrop = UI.$('settings-backdrop');
    const openBtn = UI.$('settings-open-btn');

    if (drawer) {
      drawer.classList.remove('settings-drawer--open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.remove('settings-backdrop--open');
    }
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.focus();
    }
  }

  return {
    init,
    get,
    setStrictness,
    setLayer,
    resetToDefaults,
    openDrawer,
    closeDrawer,
  };
})();

/**
 * PipelineAnimation — Stage highlighting for "How it works" section
 */
const PipelineAnimation = (() => {
  function activateStage(stageIndex) {
    const stages = document.querySelectorAll('.pipeline-step');
    stages.forEach((el, idx) => {
      const isCurrent = idx + 1 === stageIndex;
      el.classList.toggle('pipeline-step--active', isCurrent);
      if (isCurrent) {
        el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function reset() {
    const stages = document.querySelectorAll('.pipeline-step');
    stages.forEach(el => el.classList.remove('pipeline-step--active'));
  }

  return { activateStage, reset };
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
