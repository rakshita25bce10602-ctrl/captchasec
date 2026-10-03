/**
 * main.js — Application entry-point
 *
 * Bootstraps all modules once the DOM is ready.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Theme
  UI.initTheme();

  // Behaviour tracking (must init before captcha so listeners are ready)
  Behaviour.init();

  // CAPTCHA (calls Behaviour.reset() on first generate)
  Captcha.init();
});
