/**
 * main.js — Application entry-point
 *
 * Bootstraps all modules once the DOM is ready.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Theme
  UI.initTheme();

  // CAPTCHA
  Captcha.init();
});
