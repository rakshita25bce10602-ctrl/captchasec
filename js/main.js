/**
 * main.js — Application entry-point
 *
 * Bootstraps all modules once the DOM is ready.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Theme & UI
  UI.initTheme();
  EventLog.init();

  // Behaviour tracking (must init before captcha so listeners are ready)
  Behaviour.init();

  // CAPTCHA challenge engine
  Captcha.init();

  // Bot simulation & virtual cursor
  Simulation.init();
});
