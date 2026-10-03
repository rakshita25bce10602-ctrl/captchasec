/**
 * behaviour.js — User behaviour tracking
 *
 * Captures real-time behavioural signals while the user interacts
 * with the CAPTCHA. Signals are consumed by scoring.js to produce
 * a composite risk score.
 *
 * Tracked signals:
 *   • Time-to-solve (seconds)
 *   • Mouse movement — path length, curvature ratio, speed variance
 *   • Mouse activity before first click / key
 *   • Keystroke intervals — mean & standard-deviation
 *   • Paste events on the CAPTCHA input
 *   • Honeypot field status
 *   • Failed-attempt count & refresh count
 *   • Focus / blur transitions, tab-hidden duration
 *   • Environment flags (navigator.webdriver, headless hints)
 */

'use strict';

const Behaviour = (() => {
  /* ─────────── state ─────────── */
  let mousePoints     = [];   // { x, y, t }
  let keystrokeTimes  = [];   // timestamps (ms)
  let pasteCount      = 0;
  let refreshCount    = 0;
  let failedAttempts  = 0;
  let focusBlurs      = 0;
  let hiddenDuration  = 0;    // ms spent with tab hidden
  let hiddenSince     = null;
  let startTime       = 0;    // challenge-start (performance.now)
  let hasMouseMoved   = false;
  let envFlags        = {};   // computed once in init()
  let active          = false;

  /* ─────────── init ─────────── */
  function init() {
    checkEnvironment();

    /* mouse movement — entire document */
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });

    /* keystrokes & paste — scoped to the CAPTCHA input */
    const input = UI.$('captcha-input');
    if (input) {
      input.addEventListener('keydown',  onKeyDown);
      input.addEventListener('paste',    onPaste);
    }

    /* focus / blur */
    window.addEventListener('focus', () => { focusBlurs++; });
    window.addEventListener('blur',  () => { focusBlurs++; });

    /* tab visibility */
    document.addEventListener('visibilitychange', onVisibility);
  }

  /* ─────────── reset (called each new captcha) ─────────── */

  /** Soft reset — clears per-challenge data, keeps session counters. */
  function reset() {
    mousePoints    = [];
    keystrokeTimes = [];
    pasteCount     = 0;
    hasMouseMoved  = false;
    hiddenDuration = 0;
    hiddenSince    = null;
    focusBlurs     = 0;
    startTime      = performance.now();
    active         = true;
  }

  /** Hard reset — clears everything (after success / lockout end). */
  function fullReset() {
    reset();
    refreshCount   = 0;
    failedAttempts = 0;
  }

  /* ─────────── event handlers ─────────── */

  function onMouseMove(e) {
    if (!active) return;
    hasMouseMoved = true;
    mousePoints.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    /* cap stored points to avoid memory growth in long sessions */
    if (mousePoints.length > 2000) mousePoints = mousePoints.slice(-1500);
  }

  function onTouchMove(e) {
    if (!active || !e.touches.length) return;
    const t = e.touches[0];
    hasMouseMoved = true;
    mousePoints.push({ x: t.clientX, y: t.clientY, t: performance.now() });
    if (mousePoints.length > 2000) mousePoints = mousePoints.slice(-1500);
  }

  function onKeyDown() {
    if (!active) return;
    keystrokeTimes.push(performance.now());
  }

  function onPaste() {
    if (!active) return;
    pasteCount++;
    /* update the live metric in the analytics panel */
    const el = UI.$('metric-paste');
    if (el) el.textContent = pasteCount;
  }

  function onVisibility() {
    if (document.hidden) {
      hiddenSince = performance.now();
    } else if (hiddenSince !== null) {
      hiddenDuration += performance.now() - hiddenSince;
      hiddenSince = null;
    }
  }

  /* ─────────── environment probes (run once) ─────────── */
  function checkEnvironment() {
    envFlags = {
      /** navigator.webdriver is set by Selenium / Puppeteer / Playwright */
      webdriver: !!navigator.webdriver,

      /** Headless Chrome reports 0 plugins */
      noPlugins: navigator.plugins ? navigator.plugins.length === 0 : false,

      /** Headless environments often lack real language arrays */
      noLanguages: !navigator.languages || navigator.languages.length === 0,

      /** HeadlessChrome user-agent substring */
      headlessUA: /HeadlessChrome|PhantomJS|Headless/i.test(navigator.userAgent),

      /** Automation-specific properties on window */
      automationAPIs: !!(
        window._phantom ||
        window.__nightmare ||
        window.callPhantom ||
        window._selenium ||
        window.domAutomation ||
        window.domAutomationController
      ),
    };
  }

  /* ─────────── derived metrics ─────────── */

  /**
   * Mouse path "straightness" ratio.
   * Total path length / direct start→end distance.
   * Value ≈ 1.0 → perfectly straight (bot-like).
   * Value > 1.3 → natural human movement.
   * Returns null if too few points.
   */
  function mousePathRatio() {
    if (mousePoints.length < 3) return null;
    let totalDist = 0;
    for (let i = 1; i < mousePoints.length; i++) {
      totalDist += dist(mousePoints[i - 1], mousePoints[i]);
    }
    const directDist = dist(mousePoints[0], mousePoints[mousePoints.length - 1]);
    if (directDist < 1) return null; // cursor didn't really move
    return totalDist / directDist;
  }

  /**
   * Mouse speed standard-deviation (px/ms).
   * Low std-dev → constant robotic speed.
   */
  function mouseSpeedVariance() {
    if (mousePoints.length < 5) return null;
    const speeds = [];
    for (let i = 1; i < mousePoints.length; i++) {
      const dt = mousePoints[i].t - mousePoints[i - 1].t;
      if (dt > 0) speeds.push(dist(mousePoints[i - 1], mousePoints[i]) / dt);
    }
    if (speeds.length < 3) return null;
    return stddev(speeds);
  }

  /**
   * Keystroke inter-key intervals (ms).
   * Returns { mean, stddev, count }.
   */
  function keystrokeStats() {
    if (keystrokeTimes.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < keystrokeTimes.length; i++) {
      intervals.push(keystrokeTimes[i] - keystrokeTimes[i - 1]);
    }
    return {
      mean:   mean(intervals),
      stddev: stddev(intervals),
      count:  intervals.length,
    };
  }

  /* ─────────── getSignals() — public snapshot ─────────── */
  function getSignals() {
    const now  = performance.now();
    const solveTime = (now - startTime) / 1000;  // seconds

    return {
      /* timing */
      solveTime,

      /* mouse */
      mousePointCount:   mousePoints.length,
      hasMouseMoved,
      mousePathRatio:    mousePathRatio(),
      mouseSpeedStddev:  mouseSpeedVariance(),

      /* keyboard */
      keystrokeStats:    keystrokeStats(),
      keystrokeCount:    keystrokeTimes.length,

      /* paste */
      pasteCount,

      /* honeypot */
      honeypotFilled:    !!(UI.$('hp-email') && UI.$('hp-email').value),

      /* attempts & refreshes */
      failedAttempts,
      refreshCount,

      /* focus / visibility */
      focusBlurs,
      hiddenDuration,

      /* environment */
      env: { ...envFlags },
    };
  }

  /* ─────────── session counters (called by captcha.js) ─────── */
  function trackRefresh()       { refreshCount++;  }
  function trackFailedAttempt() { failedAttempts++; }

  /* ─────────── math helpers ─────────── */
  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stddev(arr) {
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  /* ─────────── public API ─────────── */
  return {
    init,
    reset,
    fullReset,
    getSignals,
    trackRefresh,
    trackFailedAttempt,
  };
})();
