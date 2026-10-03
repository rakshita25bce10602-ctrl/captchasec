/**
 * storage.js — Local persistence helpers
 *
 * Provides get/set/remove wrappers around localStorage with JSON
 * serialisation and fallback for environments where storage
 * is unavailable (e.g. private browsing).
 */

'use strict';

const Storage = (() => {
  /** @param {string} key  @param {*} fallback */
  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  /** @param {string} key  @param {*} value */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — silently ignore */
    }
  }

  /** @param {string} key */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  return { get, set, remove };
})();
