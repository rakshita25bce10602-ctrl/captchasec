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
  let lastLoggedMouse = 0;

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
      input.addEventListener('focus',    () => {
        if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', 'Input field focused');
      });
    }

    /* honeypot monitor */
    const hp = UI.$('hp-email');
    if (hp) {
      hp.addEventListener('input', () => {
        if (hp.value && typeof EventLog !== 'undefined') {
          EventLog.log('SECURITY', 'Honeypot field modified: email_confirm populated!');
        }
      });
    }

    /* focus / blur */
    window.addEventListener('focus', () => {
      focusBlurs++;
      if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', 'Window regained focus');
    });
    window.addEventListener('blur',  () => {
      focusBlurs++;
      if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', 'Window lost focus (blur)');
    });

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
    lastLoggedMouse = 0;
    if (typeof EventLog !== 'undefined') {
      EventLog.resetSession();
    }
  }

  /** Hard reset — clears everything (after success / lockout end / demo reset). */
  function fullReset() {
    reset();
    refreshCount   = 0;
    failedAttempts = 0;
  }

  /* ─────────── event handlers ─────────── */

  function onMouseMove(e) {
    if (!active) return;
    recordMousePoint(e.clientX, e.clientY, performance.now());
  }

  function onTouchMove(e) {
    if (!active || !e.touches.length) return;
    const t = e.touches[0];
    recordMousePoint(t.clientX, t.clientY, performance.now());
  }

  function recordMousePoint(x, y, t = performance.now()) {
    if (!active) return;
    if (!hasMouseMoved) {
      hasMouseMoved = true;
      if (typeof EventLog !== 'undefined') {
        EventLog.log('MOUSE', `Initial pointer movement (x: ${Math.round(x)}, y: ${Math.round(y)})`);
      }
    }
    mousePoints.push({ x, y, t });

    // Periodically log milestone mouse count for timeline visibility
    if (t - lastLoggedMouse > 1200 && mousePoints.length > 10) {
      lastLoggedMouse = t;
      if (typeof EventLog !== 'undefined') {
        const ratio = mousePathRatio();
        EventLog.log('MOUSE', `Trajectory active: ${mousePoints.length} points${ratio ? ` (curvature: ${ratio.toFixed(2)})` : ''}`);
      }
    }

    if (mousePoints.length > 2000) mousePoints = mousePoints.slice(-1500);
  }

  function onKeyDown(e) {
    if (!active) return;
    recordKey(performance.now(), e ? e.key : null);
  }

  function recordKey(t = performance.now(), keyChar = null) {
    if (!active) return;
    const prev = keystrokeTimes.length ? keystrokeTimes[keystrokeTimes.length - 1] : null;
    const delta = prev ? Math.round(t - prev) : 0;
    keystrokeTimes.push(t);

    if (typeof EventLog !== 'undefined') {
      const charStr = keyChar && keyChar.length === 1 ? `'${keyChar}'` : 'key';
      EventLog.log('KEYBOARD', `Keydown ${charStr}${delta ? ` (interval: ${delta}ms)` : ' (initial key)'}`);
    }
  }

  function onPaste() {
    if (!active) return;
    recordPaste();
  }

  function recordPaste() {
    if (!active) return;
    pasteCount++;
    const el = UI.$('metric-paste');
    if (el) el.textContent = pasteCount;
    if (typeof EventLog !== 'undefined') {
      EventLog.log('PASTE', `Clipboard paste event intercepted (total pastes: ${pasteCount})`);
    }
  }

  function onVisibility() {
    if (document.hidden) {
      hiddenSince = performance.now();
      if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', 'Tab switched to background / hidden');
    } else if (hiddenSince !== null) {
      const dur = performance.now() - hiddenSince;
      hiddenDuration += dur;
      hiddenSince = null;
      if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', `Tab returned to foreground (away for ${(dur / 1000).toFixed(1)}s)`);
    }
  }

  /* ─────────── environment probes (run once) ─────────── */
  function checkEnvironment() {
    envFlags = {
      webdriver: !!navigator.webdriver,
      noPlugins: navigator.plugins ? navigator.plugins.length === 0 : false,
      noLanguages: !navigator.languages || navigator.languages.length === 0,
      headlessUA: /HeadlessChrome|PhantomJS|Headless/i.test(navigator.userAgent),
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
   */
  function mousePathRatio() {
    if (mousePoints.length < 3) return null;
    let totalDist = 0;
    for (let i = 1; i < mousePoints.length; i++) {
      totalDist += dist(mousePoints[i - 1], mousePoints[i]);
    }
    const directDist = dist(mousePoints[0], mousePoints[mousePoints.length - 1]);
    if (directDist < 1) return null;
    return totalDist / directDist;
  }

  /**
   * Mouse speed standard-deviation (px/ms).
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
    const now = performance.now();
    const solveTime = (now - startTime) / 1000;

    return {
      solveTime,
      mousePointCount:   mousePoints.length,
      hasMouseMoved,
      mousePathRatio:    mousePathRatio(),
      mouseSpeedStddev:  mouseSpeedVariance(),
      keystrokeStats:    keystrokeStats(),
      keystrokeCount:    keystrokeTimes.length,
      pasteCount,
      honeypotFilled:    !!(UI.$('hp-email') && UI.$('hp-email').value),
      failedAttempts,
      refreshCount,
      focusBlurs,
      hiddenDuration,
      env: { ...envFlags },
    };
  }

  /* ─────────── session counters ─────────── */
  function trackRefresh() {
    refreshCount++;
    if (typeof EventLog !== 'undefined') EventLog.log('SYSTEM', `Challenge refreshed (count: ${refreshCount})`);
  }

  function trackFailedAttempt() {
    failedAttempts++;
    if (typeof EventLog !== 'undefined') EventLog.log('SECURITY', `Failed attempt recorded (failures: ${failedAttempts})`);
  }

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
    recordMousePoint,
    recordKey,
    recordPaste,
    trackRefresh,
    trackFailedAttempt,
  };
})();
