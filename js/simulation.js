/**
 * simulation.js — Automated Bot Simulation & Virtual Cursor
 *
 * Demonstrates how different automation profiles trigger distinct
 * behavioural signals and risk scores in real-time.
 *
 * Four simulation modes:
 *   1. Instant Bot    — 0ms DOM injection, zero mouse movement, instant submit.
 *   2. Slow Bot       — Linear cursor trajectory, constant speed, robotic keystroke cadence.
 *   3. Pasting Bot    — Populates honeypot field, triggers clipboard paste event.
 *   4. Human-like Bot — Cubic Bézier trajectory with micro-jitter, non-uniform typing intervals.
 */

'use strict';

const Simulation = (() => {
  /* ── State ── */
  let activeMode    = 'instant'; // 'instant' | 'slow' | 'pasting' | 'humanlike'
  let isRunning     = false;
  let abortCtrl     = null;      // AbortController for cancelable async sleep
  let animationId   = null;

  /* ── Cached DOM refs ── */
  let $simBtn, $resetBtn, $cursor, $cursorLabel, $cursorRipple;

  /* ═══════════════════════════════════════════
     init()
     ═══════════════════════════════════════════ */
  function init() {
    $simBtn       = UI.$('sim-btn');
    $resetBtn     = UI.$('reset-demo-btn');
    $cursor       = UI.$('fake-cursor');
    $cursorLabel  = UI.$('fake-cursor-label');
    $cursorRipple = UI.$('fake-cursor-ripple');

    if ($simBtn) {
      $simBtn.addEventListener('click', toggleSimulation);
    }
    if ($resetBtn) {
      $resetBtn.addEventListener('click', () => {
        stop();
        Captcha.resetDemo();
      });
    }

    /* Mode selector tabs */
    const modeButtons = document.querySelectorAll('.bot-mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning) return;
        const mode = btn.dataset.mode;
        setMode(mode);
      });
    });

    setMode('instant');
  }

  /* ═══════════════════════════════════════════
     Mode Management
     ═══════════════════════════════════════════ */
  function setMode(mode) {
    activeMode = mode;

    const modeButtons = document.querySelectorAll('.bot-mode-btn');
    modeButtons.forEach(b => {
      const isCurrent = b.dataset.mode === mode;
      b.classList.toggle('bot-mode-btn--active', isCurrent);
      b.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
    });

    const modeLabel = UI.$('current-mode-label');
    if (modeLabel) {
      const names = {
        instant:   'Mode: Instant Bot (⚡ 0ms Direct Injection + Honeypot)',
        slow:      'Mode: Slow Bot (🤖 Linear Trajectory & Robotic Cadence)',
        pasting:   'Mode: Pasting Bot (📋 Clipboard Paste & Honeypot)',
        humanlike: 'Mode: Human-like Bot (👤 Bézier Curve & Variable Cadence)',
      };
      modeLabel.textContent = names[mode] || `Mode: ${mode}`;
    }

    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', `Selected bot profile: ${mode.toUpperCase()}`);
    }
  }

  /* ═══════════════════════════════════════════
     Simulation Execution Control
     ═══════════════════════════════════════════ */
  function toggleSimulation() {
    if (isRunning) {
      stop();
      if (typeof EventLog !== 'undefined') {
        EventLog.log('BOT', 'Simulation halted by user.');
      }
    } else {
      run();
    }
  }

  async function run() {
    if (isRunning || Captcha.isLocked()) return;

    isRunning = true;
    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;

    updateUIState(true);

    try {
      // Clear previous input & feedback
      const input = UI.$('captcha-input');
      if (input) input.value = '';

      const targetCode = Captcha.getCode();
      if (!targetCode) {
        throw new Error('No active challenge available.');
      }

      if (typeof EventLog !== 'undefined') {
        EventLog.log('BOT', `▶ Starting ${activeMode.toUpperCase()} simulation against challenge [${targetCode}]`);
      }

      if (typeof PipelineAnimation !== 'undefined') {
        PipelineAnimation.activateStage(2);
      }

      switch (activeMode) {
        case 'instant':
          await runInstantBot(targetCode, signal);
          break;
        case 'slow':
          await runSlowBot(targetCode, signal);
          break;
        case 'pasting':
          await runPastingBot(targetCode, signal);
          break;
        case 'humanlike':
          await runHumanlikeBot(targetCode, signal);
          break;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Simulation error:', err);
      }
    } finally {
      stop();
    }
  }

  function stop() {
    isRunning = false;
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    hideCursor();
    updateUIState(false);
  }

  function updateUIState(running) {
    if (!$simBtn) return;
    if (running) {
      $simBtn.classList.add('btn-outline--running');
      $simBtn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span>Stop Simulation</span>
      `;
    } else {
      $simBtn.classList.remove('btn-outline--running');
      $simBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Run Bot Simulation</span>
      `;
    }
  }

  /* ═══════════════════════════════════════════
     1. Instant Bot
     ═══════════════════════════════════════════ */
  async function runInstantBot(code, signal) {
    const input = UI.$('captcha-input');
    const hp = UI.$('form-website-field') || UI.$('hp-email');
    const verifyBtn = UI.$('verify-btn');

    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', 'Direct memory assignment to DOM element & honeypot (0ms latency)');
    }

    // Direct value injection with no mouse or keyboard events, populating honeypot trap
    if (input) input.value = code;
    if (hp) hp.value = 'https://bot-crawler-auto.io';

    await sleep(40, signal);

    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', 'Synthetic click dispatched directly to #verify-btn');
    }

    if (verifyBtn) verifyBtn.click();
  }

  /* ═══════════════════════════════════════════
     2. Slow Bot (Linear / Constant Speed)
     ═══════════════════════════════════════════ */
  async function runSlowBot(code, signal) {
    const input = UI.$('captcha-input');
    const verifyBtn = UI.$('verify-btn');
    const card = document.querySelector('.card');
    const cardRect = card.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const btnRect = verifyBtn.getBoundingClientRect();

    // Start cursor at card top-right
    const startX = cardRect.right - 40;
    const startY = cardRect.top + 30;

    const inputTargetX = inputRect.left + inputRect.width / 2;
    const inputTargetY = inputRect.top + inputRect.height / 2;

    showCursor(startX, startY, '🤖 Moving (Linear)');
    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', 'Linear constant-velocity trajectory to #captcha-input');
    }

    // Move in a strictly straight line with constant speed (ratio ≈ 1.0, stddev ≈ 0)
    await animateLinearCursor(startX, startY, inputTargetX, inputTargetY, 900, signal, '🤖 Moving (Linear)');

    // Click input
    triggerCursorClick();
    if (input) input.focus();
    await sleep(200, signal);

    // Mechanical typing: strictly constant 220ms interval
    setCursorLabel('🤖 Typing (Fixed 220ms)');
    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', `Mechanical key cadence engaged (${code.length} characters @ 220ms interval)`);
    }

    for (let i = 0; i < code.length; i++) {
      if (input) input.value += code[i];
      if (typeof Behaviour !== 'undefined') {
        Behaviour.recordKey(performance.now(), code[i]);
      }
      await sleep(220, signal);
    }

    await sleep(200, signal);

    // Move straight to Verify button
    const btnTargetX = btnRect.left + btnRect.width / 2;
    const btnTargetY = btnRect.top + btnRect.height / 2;

    setCursorLabel('🤖 Moving to Verify');
    await animateLinearCursor(inputTargetX, inputTargetY, btnTargetX, btnTargetY, 700, signal, '🤖 Moving to Verify');

    // Click verify
    triggerCursorClick();
    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', 'Dispatched click event to #verify-btn');
    }
    await sleep(100, signal);
    if (verifyBtn) verifyBtn.click();
  }

  /* ═══════════════════════════════════════════
     3. Pasting Bot (Honeypot + Clipboard)
     ═══════════════════════════════════════════ */
  async function runPastingBot(code, signal) {
    const input = UI.$('captcha-input');
    const hp = UI.$('form-website-field') || UI.$('hp-email');
    const verifyBtn = UI.$('verify-btn');
    const card = document.querySelector('.card');
    const cardRect = card.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const btnRect = verifyBtn.getBoundingClientRect();

    const startX = cardRect.left + 50;
    const startY = cardRect.top + 50;

    const inputTargetX = inputRect.left + 60;
    const inputTargetY = inputRect.top + inputRect.height / 2;

    showCursor(startX, startY, '📋 Auto-scraped Paste');

    // Fast linear jump to input
    await animateLinearCursor(startX, startY, inputTargetX, inputTargetY, 400, signal, '📋 Auto-scraped Paste');

    // 1. Populate Honeypot field (naive scraper bot behaviour)
    if (hp) {
      hp.value = 'https://bot-scraped-field.xyz';
      if (typeof EventLog !== 'undefined') {
        EventLog.log('SECURITY', 'Honeypot field filled: website = "https://bot-scraped-field.xyz"');
      }
    }

    await sleep(150, signal);

    // 2. Trigger Clipboard Paste event
    triggerCursorClick();
    if (input) {
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof Behaviour !== 'undefined') {
      Behaviour.recordPaste();
    }
    if (typeof EventLog !== 'undefined') {
      EventLog.log('PASTE', `Synthetic clipboard paste into #captcha-input ("${code}")`);
    }

    await sleep(250, signal);

    // Move to Verify button
    const btnTargetX = btnRect.left + btnRect.width / 2;
    const btnTargetY = btnRect.top + btnRect.height / 2;

    await animateLinearCursor(inputTargetX, inputTargetY, btnTargetX, btnTargetY, 350, signal, '📋 Submit');

    triggerCursorClick();
    await sleep(100, signal);
    if (verifyBtn) verifyBtn.click();
  }

  /* ═══════════════════════════════════════════
     4. Human-like Bot (Bézier + Natural Cadence)
     ═══════════════════════════════════════════ */
  async function runHumanlikeBot(code, signal) {
    const input = UI.$('captcha-input');
    const verifyBtn = UI.$('verify-btn');
    const card = document.querySelector('.card');
    const cardRect = card.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const btnRect = verifyBtn.getBoundingClientRect();

    // Natural starting position near screen top
    const startX = cardRect.left + Math.random() * (cardRect.width * 0.6);
    const startY = cardRect.top + 20;

    const inputTargetX = inputRect.left + 30 + Math.random() * 60;
    const inputTargetY = inputRect.top + inputRect.height / 2 + (Math.random() * 6 - 3);

    showCursor(startX, startY, '👤 Human Biometrics');
    if (typeof EventLog !== 'undefined') {
      EventLog.log('BOT', 'Simulating human motor biometrics (cubic Bézier + velocity curve)');
    }

    // Smooth curved trajectory to input
    await animateBezierCursor(startX, startY, inputTargetX, inputTargetY, 1100, signal, '👤 Human Biometrics');

    // Natural hesitation before typing
    triggerCursorClick();
    if (input) input.focus();
    await sleep(rand(200, 380), signal);

    // Human typing cadence: variable intervals with natural pauses
    setCursorLabel('👤 Typing (Human Cadence)');
    for (let i = 0; i < code.length; i++) {
      if (input) input.value += code[i];
      if (typeof Behaviour !== 'undefined') {
        Behaviour.recordKey(performance.now(), code[i]);
      }
      // Non-uniform human interval with occasional micro-pauses
      const keyDelay = rand(110, 260) + (Math.random() > 0.75 ? rand(70, 150) : 0);
      await sleep(keyDelay, signal);
    }

    // Natural inspection delay before verifying (reading over what was typed)
    setCursorLabel('👤 Checking Code');
    await sleep(rand(300, 500), signal);

    // Curved trajectory with slight overshoot to verify button
    const btnTargetX = btnRect.left + btnRect.width / 2 + (Math.random() * 20 - 10);
    const btnTargetY = btnRect.top + btnRect.height / 2 + (Math.random() * 6 - 3);

    setCursorLabel('👤 Moving to Verify');
    await animateBezierCursor(inputTargetX, inputTargetY, btnTargetX, btnTargetY, 850, signal, '👤 Moving to Verify');

    // Click verify
    triggerCursorClick();
    await sleep(150, signal);
    if (verifyBtn) verifyBtn.click();
  }

  /* ═══════════════════════════════════════════
     Cursor Animation Engine
     ═══════════════════════════════════════════ */

  function showCursor(x, y, label = '') {
    if (!$cursor) return;
    $cursor.style.transform = `translate(${x}px, ${y}px)`;
    $cursor.classList.add('fake-cursor--visible');
    setCursorLabel(label);
  }

  function hideCursor() {
    if (!$cursor) return;
    $cursor.classList.remove('fake-cursor--visible');
  }

  function setCursorLabel(text) {
    if ($cursorLabel) $cursorLabel.textContent = text;
  }

  function triggerCursorClick() {
    if (!$cursor) return;
    $cursor.classList.remove('fake-cursor--click');
    void $cursor.offsetWidth; // force reflow
    $cursor.classList.add('fake-cursor--click');
    setTimeout(() => {
      if ($cursor) $cursor.classList.remove('fake-cursor--click');
    }, 400);
  }

  /**
   * Strictly Linear Cursor (Slow Bot)
   * Produces straight line ratio ≈ 1.0, constant speed stddev ≈ 0
   */
  function animateLinearCursor(x0, y0, x1, y1, duration, signal, label) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      function step(now) {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Perfectly linear interpolation (no easing)
        const curX = x0 + (x1 - x0) * progress;
        const curY = y0 + (y1 - y0) * progress;

        if ($cursor) {
          $cursor.style.transform = `translate(${curX}px, ${curY}px)`;
        }
        if (label) setCursorLabel(label);

        // Record point in Behaviour
        if (typeof Behaviour !== 'undefined') {
          Behaviour.recordMousePoint(curX, curY, now);
        }

        if (progress < 1) {
          animationId = requestAnimationFrame(step);
        } else {
          resolve();
        }
      }

      animationId = requestAnimationFrame(step);
    });
  }

  /**
   * Cubic Bézier Curve with natural easing and micro-jitter (Human-like Bot)
   * Produces high path ratio > 1.3, high speed stddev, natural entropy
   */
  function animateBezierCursor(x0, y0, x1, y1, duration, signal, label) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      // Random control points to create organic arching curve
      const dx = x1 - x0;
      const dy = y1 - y0;
      const cp1X = x0 + dx * 0.25 + (Math.random() - 0.5) * 80;
      const cp1Y = y0 + dy * 0.1  + (Math.random() - 0.5) * 60;
      const cp2X = x0 + dx * 0.75 + (Math.random() - 0.5) * 60;
      const cp2Y = y0 + dy * 0.8  + (Math.random() - 0.5) * 40;

      function step(now) {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        const elapsed = now - startTime;
        const linearProgress = Math.min(elapsed / duration, 1);

        // Smooth ease-in-out timing
        const t = easeInOutCubic(linearProgress);

        // Cubic Bézier calculation
        const u = 1 - t;
        let curX = u * u * u * x0 + 3 * u * u * t * cp1X + 3 * u * t * t * cp2X + t * t * t * x1;
        let curY = u * u * u * y0 + 3 * u * u * t * cp1Y + 3 * u * t * t * cp2Y + t * t * t * y1;

        // Natural micro-jitter (±1px human hand tremor)
        if (linearProgress < 0.95) {
          curX += (Math.random() - 0.5) * 2;
          curY += (Math.random() - 0.5) * 2;
        }

        if ($cursor) {
          $cursor.style.transform = `translate(${curX}px, ${curY}px)`;
        }
        if (label) setCursorLabel(label);

        // Record point in Behaviour
        if (typeof Behaviour !== 'undefined') {
          Behaviour.recordMousePoint(curX, curY, now);
        }

        if (linearProgress < 1) {
          animationId = requestAnimationFrame(step);
        } else {
          resolve();
        }
      }

      animationId = requestAnimationFrame(step);
    });
  }

  /* ── Helpers ── */

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }
    });
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getActiveModeTitle() {
    const titles = {
      instant:   'Instant Bot',
      slow:      'Slow Bot',
      pasting:   'Pasting Bot',
      humanlike: 'Human-like Bot',
    };
    return titles[activeMode] || 'Automated Bot';
  }

  /* ── public API ── */
  return {
    init,
    setMode,
    run,
    stop,
    isRunning: () => isRunning,
    getActiveModeTitle,
  };
})();
