/**
 * scoring.js — Risk scoring engine
 *
 * Combines behavioural signals from Behaviour.getSignals() into a
 * composite 0–100 risk score, then updates the analytics UI.
 *
 * ┌────────┬──────────────────────────┬─────────────────────────────────────────────┐
 * │ Weight │ Signal                   │ Rationale                                   │
 * ├────────┼──────────────────────────┼─────────────────────────────────────────────┤
 * │   20   │ Time-to-solve            │ Bots solve in < 1 s; humans need 3–15 s     │
 * │   15   │ Mouse absence            │ No pointer movement is a strong bot signal  │
 * │    5   │ Mouse path straightness  │ Bots move in straight lines (ratio ≈ 1)     │
 * │    5   │ Mouse speed constancy    │ Bots maintain constant speed (low σ)        │
 * │   10   │ Keystroke speed          │ Sub-50 ms inter-key = likely automated      │
 * │   10   │ Keystroke rhythm         │ Constant rhythm (low σ) = robotic           │
 * │   10   │ Paste detected           │ Pasting CAPTCHA text ⟹ likely scripted      │
 * │   15   │ Honeypot triggered       │ Filling a hidden field is definitive        │
 * │    5   │ Failed attempts          │ Repeated failures suggest brute-force       │
 * │    5   │ Environment flags        │ navigator.webdriver, headless hints, etc.   │
 * ├────────┼──────────────────────────┼─────────────────────────────────────────────┤
 * │  100   │ TOTAL                    │                                             │
 * └────────┴──────────────────────────┴─────────────────────────────────────────────┘
 *
 * Labels:
 *   0–30   → Human       (green)
 *   31–70  → Suspicious  (amber)
 *   71–100 → Bot         (red)
 */

'use strict';

const Scoring = (() => {
  /* circumference of the SVG risk ring (2π × r=28 ≈ 175.93) */
  const RING_C = 2 * Math.PI * 28;

  /* ═══════════════════════════════════════════════════════
     compute(signals) → { score, label, colour, breakdown }
     ═══════════════════════════════════════════════════════ */
  function compute(signals) {
    const breakdown = [];

    /* ── 1. Time-to-solve  (max +20) ──────────────────────
       < 1 s  → full 20 pts  (impossibly fast)
       1–2 s  → 15 pts       (very suspicious)
       2–3 s  → 8 pts        (borderline)
       ≥ 3 s  → 0 pts        (normal human range)           */
    let timePts = 0;
    const t = signals.solveTime;
    if      (t < 1)  timePts = 20;
    else if (t < 2)  timePts = 15;
    else if (t < 3)  timePts = 8;
    breakdown.push({
      label: 'Solve time',
      pts: timePts,
      max: 20,
      note: t < 1 ? `${t.toFixed(2)}s — impossibly fast`
          : t < 2 ? `${t.toFixed(2)}s — very fast`
          : t < 3 ? `${t.toFixed(2)}s — borderline`
          :         `${t.toFixed(2)}s — normal`,
    });

    /* ── 2. Mouse absence  (max +15) ──────────────────────
       No movement at all → 15.
       < 10 points         → 8.                              */
    let mousePts = 0;
    if (!signals.hasMouseMoved)           mousePts = 15;
    else if (signals.mousePointCount < 10) mousePts = 8;
    breakdown.push({
      label: 'Mouse activity',
      pts: mousePts,
      max: 15,
      note: !signals.hasMouseMoved ? 'No movement detected'
          : signals.mousePointCount < 10 ? `Only ${signals.mousePointCount} pts recorded`
          : `${signals.mousePointCount} pts — normal`,
    });

    /* ── 3. Mouse path straightness  (max +5) ────────────
       Ratio ≈ 1.0 → straight line → +5.
       Ratio > 1.4 → curved / natural → 0.                  */
    let straightPts = 0;
    const ratio = signals.mousePathRatio;
    if (ratio !== null) {
      if      (ratio < 1.05) straightPts = 5;
      else if (ratio < 1.15) straightPts = 3;
      else if (ratio < 1.3)  straightPts = 1;
    }
    breakdown.push({
      label: 'Path curvature',
      pts: straightPts,
      max: 5,
      note: ratio === null ? 'Insufficient data'
          : `Ratio ${ratio.toFixed(2)} — ${ratio < 1.15 ? 'too straight' : 'natural'}`,
    });

    /* ── 4. Mouse speed constancy  (max +5) ──────────────
       σ(speed) < 0.05 → constant → +5.
       σ > 0.3          → varied / human → 0.               */
    let speedPts = 0;
    const sσ = signals.mouseSpeedStddev;
    if (sσ !== null) {
      if      (sσ < 0.05) speedPts = 5;
      else if (sσ < 0.15) speedPts = 3;
      else if (sσ < 0.3)  speedPts = 1;
    }
    breakdown.push({
      label: 'Speed variance',
      pts: speedPts,
      max: 5,
      note: sσ === null ? 'Insufficient data'
          : `σ = ${sσ.toFixed(3)} — ${sσ < 0.15 ? 'too constant' : 'varied'}`,
    });

    /* ── 5. Keystroke speed  (max +10) ────────────────────
       Mean interval < 50 ms → full 10 pts.
       < 100 ms → 6 pts.
       ≥ 100 ms → 0 pts.                                    */
    let keySpeedPts = 0;
    const ks = signals.keystrokeStats;
    if (ks) {
      if      (ks.mean < 50)  keySpeedPts = 10;
      else if (ks.mean < 100) keySpeedPts = 6;
      else if (ks.mean < 150) keySpeedPts = 2;
    }
    breakdown.push({
      label: 'Typing speed',
      pts: keySpeedPts,
      max: 10,
      note: ks ? `μ = ${ks.mean.toFixed(0)}ms — ${ks.mean < 100 ? 'very fast' : 'normal'}`
               : 'No keystrokes recorded',
    });

    /* ── 6. Keystroke rhythm  (max +10) ───────────────────
       σ(intervals) < 10 ms → robotic → +10.
       < 30 ms  → 5 pts.
       ≥ 30 ms → human → 0 pts.                             */
    let keyRhythmPts = 0;
    if (ks && ks.count >= 2) {
      if      (ks.stddev < 10) keyRhythmPts = 10;
      else if (ks.stddev < 20) keyRhythmPts = 6;
      else if (ks.stddev < 30) keyRhythmPts = 3;
    }
    breakdown.push({
      label: 'Typing rhythm',
      pts: keyRhythmPts,
      max: 10,
      note: ks && ks.count >= 2
        ? `σ = ${ks.stddev.toFixed(0)}ms — ${ks.stddev < 20 ? 'too regular' : 'natural'}`
        : 'Insufficient keystrokes',
    });

    /* ── 7. Paste detected  (max +10) ─────────────────── */
    const pastePts = Math.min(signals.pasteCount * 10, 10);
    breakdown.push({
      label: 'Paste events',
      pts: pastePts,
      max: 10,
      note: signals.pasteCount > 0
        ? `${signals.pasteCount} paste(s) detected`
        : 'None — typed manually',
    });

    /* ── 8. Honeypot triggered  (max +15) ────────────── */
    const hpPts = signals.honeypotFilled ? 15 : 0;
    breakdown.push({
      label: 'Honeypot',
      pts: hpPts,
      max: 15,
      note: signals.honeypotFilled
        ? 'Hidden field filled — definitive bot'
        : 'Clean',
    });

    /* ── 9. Failed attempts  (max +5) ────────────────── */
    const failPts = Math.min(signals.failedAttempts * 1, 5);
    breakdown.push({
      label: 'Failed attempts',
      pts: failPts,
      max: 5,
      note: signals.failedAttempts > 0
        ? `${signals.failedAttempts} failure(s) — ${signals.failedAttempts >= 4 ? 'brute-force?' : 'some errors'}`
        : 'None',
    });

    /* ── 10. Environment flags  (max +5) ─────────────── */
    const envHits = Object.values(signals.env).filter(Boolean);
    const envPts = Math.min(envHits.length * 2, 5);
    const envNames = Object.entries(signals.env)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    breakdown.push({
      label: 'Environment',
      pts: envPts,
      max: 5,
      note: envHits.length > 0
        ? `Flags: ${envNames}`
        : 'No automation signals',
    });

    /* ── final score ── */
    const raw   = breakdown.reduce((s, b) => s + b.pts, 0);
    const score = Math.min(Math.max(Math.round(raw), 0), 100);

    const { label, colour } = classifyScore(score);

    return { score, label, colour, breakdown };
  }

  /* ── classification ── */
  function classifyScore(score) {
    if (score <= 30) return { label: 'Human',      colour: 'var(--clr-success)' };
    if (score <= 70) return { label: 'Suspicious', colour: 'var(--clr-warning)' };
    return                   { label: 'Bot',        colour: 'var(--clr-danger)'  };
  }

  /* ═══════════════════════════════════════════════════════
     updateUI(result) — push score + breakdown to the DOM
     ═══════════════════════════════════════════════════════ */
  function updateUI(result) {
    const { score, label, colour, breakdown } = result;

    /* ── risk ring ── */
    const $fill   = UI.$('risk-fill');
    const $val    = UI.$('risk-value');
    const $score  = UI.$('risk-score');
    const $status = UI.$('risk-status');

    if ($fill) {
      /* stroke-dashoffset: full circumference = 0%, 0 = 100% */
      const offset = RING_C * (1 - score / 100);
      $fill.style.strokeDasharray  = RING_C;
      $fill.style.strokeDashoffset = offset;
      $fill.style.stroke           = colour;
    }
    if ($val)    $val.textContent    = score;
    if ($score)  { $score.textContent = `${score} / 100`; $score.style.color = colour; }
    if ($status) { $status.textContent = `● ${label}`; $status.style.color = colour; }

    /* ── signal breakdown list ── */
    const $list = UI.$('signals-list');
    if ($list) {
      $list.innerHTML = breakdown.map(b => {
        const pct  = b.max > 0 ? (b.pts / b.max) * 100 : 0;
        const bar  = barColour(pct);
        return `
          <div class="signal">
            <div class="signal__head">
              <span class="signal__name">${b.label}</span>
              <span class="signal__pts" style="color:${bar}">+${b.pts}</span>
            </div>
            <div class="signal__bar-track">
              <div class="signal__bar-fill" style="width:${pct}%;background:${bar}"></div>
            </div>
            <span class="signal__note">${b.note}</span>
          </div>`;
      }).join('');
    }
  }

  /** Convenience: compute + render in one call. */
  function evaluate(signals) {
    const result = compute(signals);
    updateUI(result);
    if (typeof EventLog !== 'undefined') {
      EventLog.log('SCORE', `Risk Score: ${result.score}/100 (${result.label})`);
    }
    return result;
  }

  /* ── helpers ── */
  function barColour(pct) {
    if (pct <= 0)  return 'var(--clr-success)';
    if (pct <= 40) return 'var(--clr-success)';
    if (pct <= 75) return 'var(--clr-warning)';
    return 'var(--clr-danger)';
  }

  /* ── public API ── */
  return { compute, updateUI, evaluate };
})();
