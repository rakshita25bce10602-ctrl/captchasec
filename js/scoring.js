/**
 * scoring.js — Risk scoring engine
 *
 * Combines behavioural signals from Behaviour.getSignals() into a
 * composite 0–100 risk score based on active detection layers and
 * strictness level from user settings, then updates the analytics UI.
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
 * │   30   │ Honeypot trap            │ Hidden field populated ⟹ automated crawler  │
 * │    5   │ Form abuse / failures    │ Rapid refreshes & repeated failed attempts  │
 * │    5   │ Environment flags        │ navigator.webdriver, headless hints, etc.   │
 * ├────────┼──────────────────────────┼─────────────────────────────────────────────┤
 * │  115   │ TOTAL (clamped 0–100)    │ Multi-layer compounding risk score          │
 * └────────┴──────────────────────────┴─────────────────────────────────────────────┘
 *
 * Strictness Thresholds:
 *   Low    : Human ≤ 40, Suspicious 41–75, Bot > 75
 *   Medium : Human ≤ 30, Suspicious 31–70, Bot > 70  (Default)
 *   High   : Human ≤ 20, Suspicious 21–60, Bot > 60  (Strict)
 */

'use strict';

const Scoring = (() => {
  /* circumference of the SVG risk ring (2π × r=28 ≈ 175.93) */
  const RING_C = 2 * Math.PI * 28;

  function getActiveSettings() {
    if (typeof Settings !== 'undefined') {
      return Settings.get();
    }
    return {
      strictness: 'medium',
      layers: {
        timing: true,
        mouse: true,
        keystrokes: true,
        paste: true,
        honeypot: true,
        env: true,
      },
    };
  }

  /* ═══════════════════════════════════════════════════════
     compute(signals) → { score, label, colour, breakdown }
     ═══════════════════════════════════════════════════════ */
  function compute(signals) {
    const settings = getActiveSettings();
    const layers = settings.layers;
    const breakdown = [];

    /* ── 1. Time-to-solve  (max +20) ────────────────────── */
    if (layers.timing) {
      let timePts = 0;
      const t = signals.solveTime;
      if      (t < 0.8) timePts = 20;
      else if (t < 1.5) timePts = 15;
      else if (t < 2.5) timePts = 8;
      breakdown.push({
        label: 'Solve time',
        pts: timePts,
        max: 20,
        note: t < 0.8 ? `${t.toFixed(2)}s — impossibly fast (<0.8s)`
            : t < 1.5 ? `${t.toFixed(2)}s — rapid automated execution`
            : t < 2.5 ? `${t.toFixed(2)}s — borderline fast response`
            :           `${t.toFixed(2)}s — normal human range (2.5–15s)`,
      });
    } else {
      breakdown.push({ label: 'Solve time', pts: 0, max: 20, note: 'Layer disabled in settings' });
    }

    /* ── 2. Mouse absence  (max +15) ────────────────────── */
    if (layers.mouse) {
      let mousePts = 0;
      if (!signals.hasMouseMoved)            mousePts = 15;
      else if (signals.mousePointCount < 10) mousePts = 8;
      breakdown.push({
        label: 'Mouse activity',
        pts: mousePts,
        max: 15,
        note: !signals.hasMouseMoved ? 'No pointer movement detected'
            : signals.mousePointCount < 10 ? `Only ${signals.mousePointCount} pts recorded`
            : `${signals.mousePointCount} pts — normal human activity`,
      });
    } else {
      breakdown.push({ label: 'Mouse activity', pts: 0, max: 15, note: 'Layer disabled in settings' });
    }

    /* ── 3. Mouse path straightness  (max +5) ──────────── */
    if (layers.mouse) {
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
        note: ratio === null ? 'Insufficient pointer points'
            : `Ratio ${ratio.toFixed(2)} — ${ratio < 1.15 ? 'straight trajectory (bot-like)' : 'organic curvature'}`,
      });
    } else {
      breakdown.push({ label: 'Path curvature', pts: 0, max: 5, note: 'Layer disabled in settings' });
    }

    /* ── 4. Mouse speed constancy  (max +5) ────────────── */
    if (layers.mouse) {
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
        note: sσ === null ? 'Insufficient movement data'
            : `σ = ${sσ.toFixed(3)} — ${sσ < 0.15 ? 'constant robotic velocity' : 'varied human speed'}`,
      });
    } else {
      breakdown.push({ label: 'Speed variance', pts: 0, max: 5, note: 'Layer disabled in settings' });
    }

    /* ── 5. Keystroke speed & injection (max +10) ────────── */
    if (layers.keystrokes) {
      let keySpeedPts = 0;
      const ks = signals.keystrokeStats;
      if (ks) {
        if      (ks.mean < 50)  keySpeedPts = 10;
        else if (ks.mean < 100) keySpeedPts = 6;
        else if (ks.mean < 150) keySpeedPts = 2;
      } else if (signals.keystrokeCount === 0 && signals.solveTime < 1.5) {
        // Direct value injection with 0 keyboard events
        keySpeedPts = 10;
      }
      breakdown.push({
        label: 'Typing speed',
        pts: keySpeedPts,
        max: 10,
        note: ks ? `μ = ${ks.mean.toFixed(0)}ms — ${ks.mean < 100 ? 'rapid scripted cadence' : 'natural human cadence'}`
                 : (signals.keystrokeCount === 0 && signals.solveTime < 1.5)
                 ? 'Zero keystrokes recorded — direct value injection'
                 : 'No keyboard events recorded',
      });
    } else {
      breakdown.push({ label: 'Typing speed', pts: 0, max: 10, note: 'Layer disabled in settings' });
    }

    /* ── 6. Keystroke rhythm  (max +10) ─────────────────── */
    if (layers.keystrokes) {
      let keyRhythmPts = 0;
      const ks = signals.keystrokeStats;
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
          ? `σ = ${ks.stddev.toFixed(0)}ms — ${ks.stddev < 20 ? 'robotic mechanical rhythm' : 'human variance'}`
          : 'Insufficient keystrokes',
      });
    } else {
      breakdown.push({ label: 'Typing rhythm', pts: 0, max: 10, note: 'Layer disabled in settings' });
    }

    /* ── 7. Paste detected  (max +10) ─────────────────── */
    if (layers.paste) {
      const pastePts = Math.min(signals.pasteCount * 10, 10);
      breakdown.push({
        label: 'Paste events',
        pts: pastePts,
        max: 10,
        note: signals.pasteCount > 0
          ? `${signals.pasteCount} clipboard paste event(s) intercepted`
          : 'Clean — manual entry',
      });
    } else {
      breakdown.push({ label: 'Paste events', pts: 0, max: 10, note: 'Layer disabled in settings' });
    }

    /* ── 8. Honeypot triggered  (max +30) ────────────── */
    if (layers.honeypot) {
      const hpPts = signals.honeypotFilled ? 30 : 0;
      breakdown.push({
        label: 'Honeypot trap',
        pts: hpPts,
        max: 30,
        note: signals.honeypotFilled
          ? 'Honeypot field was populated. This is commonly associated with automated form interaction.'
          : 'Empty (PASS) — normal user interaction',
      });
    } else {
      breakdown.push({ label: 'Honeypot trap', pts: 0, max: 30, note: 'Layer disabled in settings' });
    }

    /* ── 9. Form abuse & Failures  (max +5) ───────────── */
    let abusePts = Math.min(signals.failedAttempts * 2, 4);
    if (signals.rapidRefreshes > 0) abusePts = Math.min(abusePts + 3, 5);
    breakdown.push({
      label: 'Abuse signals',
      pts: abusePts,
      max: 5,
      note: signals.rapidRefreshes > 0
        ? `Rapid challenge refreshes (${signals.refreshCount} total, ${signals.rapidRefreshes} rapid)`
        : signals.failedAttempts > 0
        ? `${signals.failedAttempts} failed attempt(s) recorded`
        : 'Clean — normal attempt flow',
    });

    /* ── 10. Environment flags  (max +5) ─────────────── */
    if (layers.env) {
      const envHits = Object.values(signals.env || {}).filter(Boolean);
      let envPts = 0;
      if (signals.env && signals.env.webdriver) envPts = 5;
      else if (envHits.length > 0) envPts = Math.min(envHits.length * 2, 5);
      const envNames = Object.entries(signals.env || {})
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ');
      breakdown.push({
        label: 'Environment',
        pts: envPts,
        max: 5,
        note: envHits.length > 0
          ? `Flags: ${envNames}`
          : 'No automation hooks detected',
      });
    } else {
      breakdown.push({ label: 'Environment', pts: 0, max: 5, note: 'Layer disabled in settings' });
    }

    /* ── final score ── */
    const raw   = breakdown.reduce((s, b) => s + b.pts, 0);
    const score = Math.min(Math.max(Math.round(raw), 0), 100);

    const { label, colour } = classifyScore(score, settings.strictness);

    return { score, label, colour, breakdown, strictness: settings.strictness };
  }

  /* ── classification based on strictness ── */
  function classifyScore(score, strictness = 'medium') {
    let humanThreshold = 30;
    let botThreshold = 70;

    if (strictness === 'low') {
      humanThreshold = 40;
      botThreshold = 75;
    } else if (strictness === 'high') {
      humanThreshold = 20;
      botThreshold = 60;
    }

    if (score <= humanThreshold) return { label: 'Human',      colour: 'var(--clr-success)' };
    if (score <= botThreshold)   return { label: 'Suspicious', colour: 'var(--clr-warning)' };
    return                              { label: 'Bot',        colour: 'var(--clr-danger)'  };
  }

  /* ═══════════════════════════════════════════════════════
     updateUI(result, signals) — push score + breakdown to the DOM
     ═══════════════════════════════════════════════════════ */
  function updateUI(result, signals = null) {
    const { score, label, colour, breakdown } = result;

    /* ── honeypot metric badge ── */
    const $hpMetric = UI.$('metric-honeypot');
    if ($hpMetric) {
      const isHpFilled = signals ? !!signals.honeypotFilled : false;
      if (isHpFilled) {
        $hpMetric.textContent = 'BOT SIGNAL';
        $hpMetric.style.color = 'var(--clr-danger)';
      } else {
        $hpMetric.textContent = 'PASS';
        $hpMetric.style.color = 'var(--clr-success)';
      }
    }

    /* ── risk ring ── */
    const $fill   = UI.$('risk-fill');
    const $val    = UI.$('risk-value');
    const $score  = UI.$('risk-score');
    const $status = UI.$('risk-status');

    if ($fill) {
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
              <span class="signal__pts" style="color:${b.pts > 0 ? bar : 'var(--clr-text-muted)'}">${b.pts > 0 ? `+${b.pts}` : '0'}</span>
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
    const settings = getActiveSettings();
    const result = compute(signals);
    updateUI(result, signals);

    if (typeof EventLog !== 'undefined') {
      if (signals.honeypotFilled && settings.layers.honeypot) {
        EventLog.log('SECURITY', 'Honeypot field triggered');
        EventLog.log('SECURITY', '+Risk: honeypot signal');
      }
      EventLog.log('SCORE', `Risk score updated: ${result.score}`);
      EventLog.log('SECURITY', `Decision: ${result.label.toUpperCase()}`);
    }
    return result;
  }

  /* ── helpers ── */
  function barColour(pct) {
    if (pct <= 0)  return 'var(--clr-border-accent)';
    if (pct <= 40) return 'var(--clr-success)';
    if (pct <= 75) return 'var(--clr-warning)';
    return 'var(--clr-danger)';
  }

  /* ── public API ── */
  return { compute, updateUI, evaluate, classifyScore };
})();
