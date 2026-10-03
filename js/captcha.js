/**
 * captcha.js — Dynamic canvas CAPTCHA
 *
 * • Generates a random 5-6 character code every refresh
 * • Renders with per-character rotation, varied sizes/fonts,
 *   wave distortion, noise dots and interference lines
 * • 2-minute countdown with visible timer
 * • Case-insensitive validation, max 5 attempts, 30 s cooldown
 * • Optional audio read-out (Web Speech API)
 * • Success (checkmark) and failure (shake + message) states
 */

'use strict';

const Captcha = (() => {
  /* ── Configuration ── */
  const CFG = {
    CHARS:      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789',
    MIN_LEN:    5,
    MAX_LEN:    6,
    EXPIRY_SEC: 120,       // 2 minutes
    MAX_ATTEMPTS: 5,
    COOLDOWN_SEC: 30,
    NOISE_DOTS: 200,
    LINES:      6,
    FONTS: [
      'Inter', 'JetBrains Mono', 'Georgia',
      'Courier New', 'Arial', 'Verdana',
    ],
  };

  /* ── State ── */
  let code         = '';
  let attempts     = 0;
  let locked       = false;
  let remaining    = 0;          // seconds left on captcha
  let cooldownLeft = 0;          // seconds left on lockout
  let timerID      = null;
  let cooldownID   = null;
  let startTime    = 0;          // when current captcha was shown (perf)

  /* ── Cached DOM refs ── */
  let $canvas, $ctx, $refresh, $input, $verifyBtn,
      $timer, $timerText, $feedback, $overlay,
      $audioBtn, $card;

  /* ═══════════════════════════════════════════
     Public: init
     ═══════════════════════════════════════════ */
  function init() {
    $canvas     = UI.$('captcha-canvas');
    $ctx        = $canvas.getContext('2d');
    $refresh    = UI.$('captcha-refresh');
    $input      = UI.$('captcha-input');
    $verifyBtn  = UI.$('verify-btn');
    $timer      = UI.$('captcha-timer');
    $timerText  = UI.$('captcha-timer-text');
    $feedback   = UI.$('captcha-feedback');
    $overlay    = UI.$('captcha-overlay');
    $audioBtn   = UI.$('captcha-audio');
    $card       = document.querySelector('.card');

    /* events */
    $refresh.addEventListener('click', onRefresh);
    $verifyBtn.addEventListener('click', onVerify);
    $input.addEventListener('keydown', e => { if (e.key === 'Enter') onVerify(); });
    if ($audioBtn) $audioBtn.addEventListener('click', onAudio);

    /* initial generate */
    generate();
  }

  /* ═══════════════════════════════════════════
     Generate a new challenge
     ═══════════════════════════════════════════ */
  function generate() {
    if (locked) return;

    /* clear UI artefacts */
    clearFeedback();
    hideOverlay();
    $input.value = '';
    $input.disabled = false;
    $verifyBtn.disabled = false;
    $card.classList.remove('card--success', 'card--fail');

    /* build code */
    const len = rand(CFG.MIN_LEN, CFG.MAX_LEN);
    code = '';
    for (let i = 0; i < len; i++) {
      code += CFG.CHARS[rand(0, CFG.CHARS.length - 1)];
    }

    /* render & start timer */
    renderCanvas();
    startCountdown();
    startTime = performance.now();

    /* update analytics */
    updateMetric('metric-attempts', `${attempts} / ${CFG.MAX_ATTEMPTS}`);
    updateStatus('Awaiting verification attempt…');
  }

  /* ═══════════════════════════════════════════
     Canvas rendering
     ═══════════════════════════════════════════ */
  function renderCanvas() {
    const W = $canvas.width;
    const H = $canvas.height;

    /* background — use a computed colour so it works in both themes */
    const bgColour = getCSS('--clr-bg-alt') || '#0c1221';
    $ctx.fillStyle = bgColour;
    $ctx.fillRect(0, 0, W, H);

    /* noise dots */
    for (let i = 0; i < CFG.NOISE_DOTS; i++) {
      $ctx.beginPath();
      $ctx.arc(rand(0, W), rand(0, H), Math.random() * 2.2, 0, Math.PI * 2);
      $ctx.fillStyle = `rgba(${rand(80,220)},${rand(80,220)},${rand(80,220)},${Math.random() * 0.45 + 0.05})`;
      $ctx.fill();
    }

    /* interference lines (bezier curves) */
    for (let i = 0; i < CFG.LINES; i++) {
      $ctx.beginPath();
      $ctx.moveTo(rand(0, W), rand(0, H));
      $ctx.bezierCurveTo(
        rand(0, W), rand(0, H),
        rand(0, W), rand(0, H),
        rand(0, W), rand(0, H),
      );
      $ctx.strokeStyle = `rgba(${rand(80,200)},${rand(80,200)},${rand(80,200)},${Math.random() * 0.35 + 0.1})`;
      $ctx.lineWidth = Math.random() * 2.5 + 0.5;
      $ctx.stroke();
    }

    /* characters */
    const padX  = 50;
    const slotW = (W - padX * 2) / code.length;

    for (let i = 0; i < code.length; i++) {
      const ch   = code[i];
      const size = rand(30, 46);
      const font = CFG.FONTS[rand(0, CFG.FONTS.length - 1)];
      const bold = Math.random() > 0.4 ? 'bold' : 'normal';
      const rot  = (Math.random() - 0.5) * 0.5;          // ±~14 °
      const x    = padX + i * slotW + slotW / 2;
      const y    = H / 2 + rand(-18, 18);

      $ctx.save();
      $ctx.translate(x, y);
      $ctx.rotate(rot);
      $ctx.font      = `${bold} ${size}px "${font}"`;
      $ctx.fillStyle = `hsl(${rand(190, 300)}, ${rand(50,90)}%, ${rand(58,82)}%)`;
      $ctx.textAlign    = 'center';
      $ctx.textBaseline = 'middle';

      /* per-char shadow for depth */
      $ctx.shadowColor   = 'rgba(0,0,0,0.35)';
      $ctx.shadowBlur    = 4;
      $ctx.shadowOffsetX = 1;
      $ctx.shadowOffsetY = 2;

      $ctx.fillText(ch, 0, 0);
      $ctx.restore();
    }

    /* wave distortion */
    applyWave(W, H);

    /* extra thin scribble lines on top of everything */
    for (let i = 0; i < 3; i++) {
      $ctx.beginPath();
      $ctx.moveTo(rand(0, W * 0.2), rand(H * 0.2, H * 0.8));
      $ctx.quadraticCurveTo(rand(W * 0.3, W * 0.7), rand(0, H), rand(W * 0.8, W), rand(H * 0.2, H * 0.8));
      $ctx.strokeStyle = `rgba(${rand(120,255)},${rand(120,255)},${rand(120,255)},${Math.random() * 0.25 + 0.08})`;
      $ctx.lineWidth   = Math.random() * 1.2 + 0.3;
      $ctx.stroke();
    }
  }

  /** Horizontal sine-wave distortion */
  function applyWave(W, H) {
    const src = $ctx.getImageData(0, 0, W, H);
    const dst = $ctx.createImageData(W, H);
    const amp = rand(3, 6);
    const freq = 0.02 + Math.random() * 0.03;
    const phase = Math.random() * Math.PI * 2;

    for (let y = 0; y < H; y++) {
      const shift = Math.round(amp * Math.sin(freq * y + phase));
      for (let x = 0; x < W; x++) {
        const sx = x + shift;
        if (sx >= 0 && sx < W) {
          const si = (y * W + sx) * 4;
          const di = (y * W + x)  * 4;
          dst.data[di]     = src.data[si];
          dst.data[di + 1] = src.data[si + 1];
          dst.data[di + 2] = src.data[si + 2];
          dst.data[di + 3] = src.data[si + 3];
        }
      }
    }
    $ctx.putImageData(dst, 0, 0);
  }

  /* ═══════════════════════════════════════════
     Countdown timer
     ═══════════════════════════════════════════ */
  function startCountdown() {
    clearInterval(timerID);
    remaining = CFG.EXPIRY_SEC;
    renderTimer();
    timerID = setInterval(() => {
      remaining--;
      renderTimer();
      if (remaining <= 0) {
        clearInterval(timerID);
        onExpired();
      }
    }, 1000);
  }

  function renderTimer() {
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    $timerText.textContent = `${m}:${s}`;

    /* colour classes */
    $timer.classList.toggle('captcha-timer--warn', remaining <= 30 && remaining > 0);
    $timer.classList.toggle('captcha-timer--expired', remaining <= 0);
  }

  function onExpired() {
    code = '';                       // invalidate
    $input.disabled  = true;
    $verifyBtn.disabled = true;
    setFeedback('Code expired — refreshing…', 'warn');
    updateStatus('Challenge expired. Generating new code…');
    setTimeout(() => generate(), 1500);
  }

  /* ═══════════════════════════════════════════
     Refresh (with spin animation)
     ═══════════════════════════════════════════ */
  function onRefresh() {
    if (locked) return;
    /* spin icon */
    const svg = $refresh.querySelector('svg');
    svg.style.transition = 'transform 0.45s cubic-bezier(.16,1,.3,1)';
    svg.style.transform  = 'rotate(360deg)';
    setTimeout(() => { svg.style.transition = 'none'; svg.style.transform = ''; }, 480);

    generate();
  }

  /* ═══════════════════════════════════════════
     Validation
     ═══════════════════════════════════════════ */
  function onVerify() {
    if (locked || $verifyBtn.disabled) return;

    const input = $input.value.trim();

    /* empty guard */
    if (!input) {
      setFeedback('Please enter the CAPTCHA code.', 'error');
      shakeCard();
      return;
    }

    /* honeypot check */
    const hp = UI.$('hp-email');
    if (hp && hp.value) {
      setFeedback('Verification failed.', 'error');
      updateMetric('metric-honeypot', 'Triggered', 'var(--clr-danger)');
      shakeCard();
      return;
    }

    /* response time */
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    updateMetric('metric-time', `${elapsed}s`);

    attempts++;
    updateMetric('metric-attempts', `${attempts} / ${CFG.MAX_ATTEMPTS}`);

    /* compare (case-insensitive) */
    if (input.toLowerCase() === code.toLowerCase()) {
      onSuccess(elapsed);
    } else {
      onFail();
    }
  }

  /* ── success ── */
  function onSuccess(elapsed) {
    clearInterval(timerID);
    $input.disabled    = true;
    $verifyBtn.disabled = true;

    showOverlay('success');
    setFeedback('✓ Verification successful!', 'success');
    $card.classList.add('card--success');
    updateStatus(`Verified in ${elapsed}s — human confidence: high`);

    /* auto-reset after a moment so the demo is replayable */
    setTimeout(() => {
      attempts = 0;
      generate();
    }, 3500);
  }

  /* ── failure ── */
  function onFail() {
    shakeCard();
    setFeedback(
      `✗ Incorrect code. ${CFG.MAX_ATTEMPTS - attempts} attempt${CFG.MAX_ATTEMPTS - attempts === 1 ? '' : 's'} remaining.`,
      'error',
    );
    $card.classList.add('card--fail');
    setTimeout(() => $card.classList.remove('card--fail'), 600);

    updateStatus('Incorrect code entered.');

    /* lockout check */
    if (attempts >= CFG.MAX_ATTEMPTS) {
      engageLockout();
    } else {
      /* regenerate a new code after a wrong attempt */
      setTimeout(() => generate(), 1200);
    }
  }

  /* ── lockout ── */
  function engageLockout() {
    locked = true;
    clearInterval(timerID);
    $input.disabled    = true;
    $verifyBtn.disabled = true;
    $refresh.disabled  = true;
    cooldownLeft = CFG.COOLDOWN_SEC;

    setFeedback(`Too many attempts. Locked for ${cooldownLeft}s.`, 'error');
    updateStatus('Cooldown lockout engaged.');
    $card.classList.add('card--locked');

    cooldownID = setInterval(() => {
      cooldownLeft--;
      setFeedback(`Too many attempts. Locked for ${cooldownLeft}s.`, 'error');
      if (cooldownLeft <= 0) {
        clearInterval(cooldownID);
        locked = false;
        attempts = 0;
        $refresh.disabled = false;
        $card.classList.remove('card--locked');
        generate();
      }
    }, 1000);
  }

  /* ═══════════════════════════════════════════
     Audio CAPTCHA (Web Speech API)
     ═══════════════════════════════════════════ */
  function onAudio() {
    if (!('speechSynthesis' in window)) {
      setFeedback('Audio CAPTCHA not supported in this browser.', 'warn');
      return;
    }
    /* cancel any in-progress speech */
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance();
    /* spell out each character with pauses */
    utterance.text = code.split('').join(', ');
    utterance.rate  = 0.7;
    utterance.pitch = 1.0;
    utterance.lang  = 'en-US';

    /* visual feedback while speaking */
    $audioBtn.classList.add('captcha-audio--speaking');
    utterance.onend = () => $audioBtn.classList.remove('captcha-audio--speaking');

    speechSynthesis.speak(utterance);
  }

  /* ═══════════════════════════════════════════
     Overlay (success checkmark / fail X)
     ═══════════════════════════════════════════ */
  function showOverlay(type) {
    $overlay.className = 'captcha-overlay captcha-overlay--visible';

    if (type === 'success') {
      $overlay.classList.add('captcha-overlay--success');
      $overlay.innerHTML = `
        <svg class="checkmark" viewBox="0 0 52 52" aria-label="Success">
          <circle class="checkmark__circle" cx="26" cy="26" r="24" fill="none"/>
          <path   class="checkmark__check"  fill="none" d="M14 27l7 7 16-16"/>
        </svg>`;
    } else {
      $overlay.classList.add('captcha-overlay--fail');
      $overlay.innerHTML = `
        <svg class="xmark" viewBox="0 0 52 52" aria-label="Failed">
          <circle class="xmark__circle" cx="26" cy="26" r="24" fill="none"/>
          <path class="xmark__x" fill="none" d="M16 16l20 20M36 16l-20 20"/>
        </svg>`;
    }
  }

  function hideOverlay() {
    if ($overlay) {
      $overlay.className = 'captcha-overlay';
      $overlay.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════ */
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getCSS(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  function setFeedback(msg, type) {
    if (!$feedback) return;
    $feedback.textContent = msg;
    $feedback.className   = 'captcha-feedback';
    if (type) $feedback.classList.add(`captcha-feedback--${type}`);
  }

  function clearFeedback() {
    if ($feedback) { $feedback.textContent = ''; $feedback.className = 'captcha-feedback'; }
  }

  function shakeCard() {
    $card.classList.remove('card--shake');       // reset
    void $card.offsetWidth;                     // force reflow
    $card.classList.add('card--shake');
    setTimeout(() => $card.classList.remove('card--shake'), 500);
  }

  function updateMetric(id, value, colour) {
    const el = UI.$(id);
    if (!el) return;
    el.textContent = value;
    if (colour) el.style.color = colour;
    else el.style.color = '';
  }

  function updateStatus(text) {
    const el = UI.$('analytics-status-text');
    if (el) el.textContent = text;
  }

  /* ── public API ── */
  return { init, generate };
})();
