/**
 * history.js — Verification History & Score Trend Chart
 *
 * Persists the last 10 verification attempts in localStorage,
 * renders an interactive history log table with badges, and
 * generates an inline SVG sparkline score trend chart.
 */

'use strict';

const History = (() => {
  const STORAGE_KEY = 'captchasec-verification-history';
  const MAX_ENTRIES = 10;

  let entries = [];

  function init() {
    entries = Storage.get(STORAGE_KEY, []);
    render();

    const clearBtn = UI.$('clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearHistory);
    }
  }

  /**
   * Add a new verification record to history
   * @param {Object} record - { result: 'Passed'|'Failed'|'Locked', score: number, label: string, solveTime: string, mode: string }
   */
  function addEntry(record) {
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      result: record.result || 'Passed',
      score: typeof record.score === 'number' ? Math.round(record.score) : 25,
      label: record.label || 'Human',
      solveTime: record.solveTime || '0.00s',
      mode: record.mode || 'Manual User',
    };

    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(0, MAX_ENTRIES);
    }

    Storage.set(STORAGE_KEY, entries);
    render();

    if (typeof EventLog !== 'undefined') {
      EventLog.log('SYSTEM', `Verification logged to history: ${entry.result} (${entry.score}/100, ${entry.mode})`);
    }
  }

  function clearHistory() {
    entries = [];
    Storage.remove(STORAGE_KEY);
    render();

    if (typeof EventLog !== 'undefined') {
      EventLog.log('SYSTEM', 'Verification history and trend analytics cleared.');
    }
  }

  function getEntries() {
    return [...entries];
  }

  function render() {
    renderTable();
    renderChart();
    renderStats();
  }

  function renderTable() {
    const tbody = UI.$('history-table-body');
    const emptyState = UI.$('history-empty-state');
    const table = UI.$('history-table');

    if (!tbody) return;

    if (!entries.length) {
      if (emptyState) emptyState.style.display = 'block';
      if (table) table.style.display = 'none';
      tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = entries.map((e, index) => {
      const outcomeBadge = getOutcomeBadge(e.result);
      const scoreBadge = getScoreBadge(e.score, e.label);
      const modeBadge = getModeBadge(e.mode);

      return `
        <tr class="history-row">
          <td class="history-cell history-cell--mono">${entries.length - index}</td>
          <td class="history-cell history-cell--mono">${escapeHtml(e.time)}</td>
          <td class="history-cell">${modeBadge}</td>
          <td class="history-cell history-cell--mono">${escapeHtml(e.solveTime)}</td>
          <td class="history-cell">${scoreBadge}</td>
          <td class="history-cell">${outcomeBadge}</td>
        </tr>
      `;
    }).join('');
  }

  function renderChart() {
    const container = UI.$('history-chart-container');
    if (!container) return;

    if (!entries.length) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <span>Complete verifications or run bot simulations to view score trends.</span>
        </div>
      `;
      return;
    }

    // Chronological order for trend visualization
    const chronological = [...entries].reverse();
    const count = chronological.length;

    const width = 580;
    const height = 140;
    const padX = 40;
    const padY = 24;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const getX = i => (count <= 1 ? padX + plotW / 2 : padX + (i / (count - 1)) * plotW);
    const getY = score => padY + plotH - (Math.min(Math.max(score, 0), 100) / 100) * plotH;

    // Build SVG Path
    let pathD = '';
    const points = chronological.map((e, i) => {
      const x = getX(i);
      const y = getY(e.score);
      if (i === 0) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return { x, y, score: e.score, label: e.label, result: e.result, mode: e.mode, time: e.time };
    });

    // Filled area underneath line
    const areaD = count > 1
      ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
      : '';

    // Threshold line Y positions
    const yHuman = getY(30);
    const yBot = getY(70);

    const svg = `
      <svg class="score-sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Risk score history trend chart">
        <defs>
          <linearGradient id="score-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--clr-accent)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--clr-accent)" stop-opacity="0.02"/>
          </linearGradient>
        </defs>

        <!-- Threshold Reference Bands / Lines -->
        <line x1="${padX}" y1="${yHuman}" x2="${width - padX}" y2="${yHuman}" class="chart-guide chart-guide--human" stroke-dasharray="3 3"/>
        <text x="${padX - 6}" y="${yHuman + 3}" class="chart-label chart-label--human">30</text>

        <line x1="${padX}" y1="${yBot}" x2="${width - padX}" y2="${yBot}" class="chart-guide chart-guide--bot" stroke-dasharray="3 3"/>
        <text x="${padX - 6}" y="${yBot + 3}" class="chart-label chart-label--bot">70</text>

        <!-- Baseline -->
        <line x1="${padX}" y1="${padY + plotH}" x2="${width - padX}" y2="${padY + plotH}" class="chart-axis"/>

        <!-- Area Fill -->
        ${areaD ? `<path d="${areaD}" fill="url(#score-area-grad)" />` : ''}

        <!-- Sparkline Stroke -->
        <path d="${pathD}" fill="none" class="chart-line" stroke="var(--clr-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data Points with Tooltips -->
        ${points.map((p, idx) => {
          const col = p.score <= 30 ? 'var(--clr-success)' : p.score <= 70 ? 'var(--clr-warning)' : 'var(--clr-danger)';
          return `
            <g class="chart-point-group" tabindex="0">
              <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${col}" stroke="var(--clr-surface-solid)" stroke-width="2" class="chart-dot"/>
              <text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" class="chart-point-val" text-anchor="middle">${p.score}</text>
            </g>
          `;
        }).join('')}
      </svg>
    `;

    container.innerHTML = svg;
  }

  function renderStats() {
    const statAvg = UI.$('stat-avg-score');
    const statPassRate = UI.$('stat-pass-rate');
    const statCount = UI.$('stat-total-attempts');

    if (!statAvg || !statPassRate || !statCount) return;

    if (!entries.length) {
      statAvg.textContent = '—';
      statPassRate.textContent = '—';
      statCount.textContent = '0';
      return;
    }

    const total = entries.length;
    const passed = entries.filter(e => e.result.toLowerCase() === 'passed' || e.result.toLowerCase() === 'verified').length;
    const sumScore = entries.reduce((s, e) => s + e.score, 0);
    const avg = Math.round(sumScore / total);
    const passPct = Math.round((passed / total) * 100);

    statAvg.textContent = `${avg}/100`;
    statAvg.style.color = avg <= 30 ? 'var(--clr-success)' : avg <= 70 ? 'var(--clr-warning)' : 'var(--clr-danger)';

    statPassRate.textContent = `${passPct}%`;
    statPassRate.style.color = passPct >= 80 ? 'var(--clr-success)' : passPct >= 50 ? 'var(--clr-warning)' : 'var(--clr-danger)';

    statCount.textContent = `${total} attempt${total === 1 ? '' : 's'}`;
  }

  function getOutcomeBadge(result) {
    const res = (result || '').toLowerCase();
    if (res === 'passed' || res === 'verified' || res === 'success') {
      return '<span class="status-pill status-pill--success"><span class="status-pill__dot"></span>Passed</span>';
    }
    if (res === 'locked' || res === 'lockout' || res === 'blocked') {
      return '<span class="status-pill status-pill--danger"><span class="status-pill__dot"></span>Locked</span>';
    }
    return '<span class="status-pill status-pill--warning"><span class="status-pill__dot"></span>Failed</span>';
  }

  function getScoreBadge(score, label) {
    const col = score <= 30 ? 'var(--clr-success)' : score <= 70 ? 'var(--clr-warning)' : 'var(--clr-danger)';
    return `<span class="score-pill" style="color:${col};border-color:${col}33;background:${col}1a"><span class="score-pill__val">${score}</span><span class="score-pill__label">${escapeHtml(label || '')}</span></span>`;
  }

  function getModeBadge(mode) {
    const m = (mode || '').toLowerCase();
    let icon = '👤';
    let cls = 'mode-pill--manual';
    if (m.includes('instant')) { icon = '⚡'; cls = 'mode-pill--bot'; }
    else if (m.includes('slow')) { icon = '🤖'; cls = 'mode-pill--bot'; }
    else if (m.includes('pasting')) { icon = '📋'; cls = 'mode-pill--bot'; }
    else if (m.includes('human-like') || m.includes('humanlike')) { icon = '🎭'; cls = 'mode-pill--humanlike'; }

    return `<span class="mode-pill ${cls}"><span class="mode-pill__icon">${icon}</span>${escapeHtml(mode || 'Manual')}</span>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    init,
    addEntry,
    clearHistory,
    getEntries,
    render,
  };
})();
