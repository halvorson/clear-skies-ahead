
import '@material/web/button/filled-button.js';
import type { HistoryEntry } from '../types';

function timeAgo(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

function buildHistorySection(history: HistoryEntry[]): string {
  if (history.length === 0) return '';

  const recentHistory = [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const entries = recentHistory.map(entry => {
    let iconClass: string;
    let text: string;

    if (entry.outOfCoverage) {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no coverage (${entry.distanceMiles} mi)`;
    } else if (entry.clearSkyFound) {
      iconClass = 'history-icon';
      text = `${entry.compassLabel} — ${entry.distanceMiles} mi`;
    } else {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no clear sky`;
    }

    return `
      <div class="history-entry">
        <span class="material-symbols-rounded ${iconClass}" aria-hidden="true" data-bearing="${entry.bearingDegrees}">navigation</span>
        <span class="history-entry-text">${text}</span>
        <span class="history-entry-time">${timeAgo(entry.timestamp)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="history-section">
      <hr class="history-divider" />
      <span class="history-label">Recent Searches</span>
      ${entries}
    </div>
  `;
}

export class LoadingScreen {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private logEl: HTMLElement;
  private hasLoggedEntry = false;
  private placeholderEl: HTMLElement | null = null;

  constructor(container: HTMLElement, history: HistoryEntry[] = []) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--loading';
    this.el.innerHTML = `
      <div class="screen-header">
        <span class="material-symbols-rounded screen-icon screen-icon--spinning" aria-hidden="true">wb_sunny</span>
        <h1 class="app-title">Clear Skies Ahead</h1>
      </div>
      <div class="screen-content">
        <div class="result-card">
          <div class="loading-spinner" role="progressbar" aria-label="Searching"></div>
          <p class="loading-status"></p>
        </div>
        <md-filled-button class="cta-fab" disabled has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Try a new direction
        </md-filled-button>
        <div class="history-section">
          <hr class="history-divider" />
          <span class="history-label">Searching…</span>
          <div class="loading-log"></div>
        </div>
        ${buildHistorySection(history)}
      </div>
    `;
    container.appendChild(this.el);

    this.statusEl = this.el.querySelector('.loading-status') as HTMLElement;
    this.logEl = this.el.querySelector('.loading-log') as HTMLElement;
  }

  setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  /** Insert a phase separator label into the log (e.g. "Scanning outward"). */
  addPhaseLabel(text: string): void {
    this.clearPlaceholder();
    const row = document.createElement('div');
    row.textContent = text;
    row.style.opacity = '0.4';
    row.style.fontSize = '11px';
    row.style.fontWeight = '500';
    row.style.textTransform = 'uppercase';
    row.style.letterSpacing = '1px';
    row.style.paddingTop = '2px';
    this.logEl.prepend(row);
  }

  /** Phase 1: show a "checking..." row before the NWS call returns. */
  startEntry(distanceMiles: number): HTMLElement {
    this.clearPlaceholder();

    const dist = distanceMiles === Math.round(distanceMiles)
      ? `${distanceMiles} mi`
      : `${distanceMiles.toFixed(1)} mi`;

    const row = document.createElement('div');
    row.textContent = `⏳  ${dist} — checking…`;
    row.style.opacity = '0.5';
    row.style.fontStyle = 'italic';
    this.logEl.prepend(row);

    return row;
  }

  /** Phase 2: fill in the result on a row created by startEntry(). */
  resolveEntry(row: HTMLElement, skyCoverPercent: number, isClear: boolean): void {
    const distText = row.textContent?.match(/[\d.]+\s*mi/)?.[0] ?? '';
    const icon = isClear ? '☀' : '☁';

    if (skyCoverPercent < 0) {
      row.textContent = `—  ${distText} — out of coverage`;
      row.style.opacity = '0.4';
      row.style.fontStyle = 'italic';
      return; // do not set hasLoggedEntry or add placeholder
    }

    let label: string;
    if (isClear) {
      label = 'clear!';
    } else if (!this.hasLoggedEntry) {
      label = `cloudy (${skyCoverPercent}%)`;
    } else {
      label = `still cloudy (${skyCoverPercent}%)`;
    }

    row.textContent = `${icon}  ${distText} — ${label}`;
    row.style.opacity = isClear ? '1' : '0.55';
    row.style.fontStyle = '';

    this.hasLoggedEntry = true;

    this.addPlaceholder();
  }

  private addPlaceholder(): void {
    this.clearPlaceholder();
    const ph = document.createElement('div');
    ph.textContent = '…';
    ph.style.opacity = '0.4';
    ph.style.fontStyle = 'italic';
    this.logEl.prepend(ph);
    this.placeholderEl = ph;
  }

  clearPlaceholder(): void {
    if (this.placeholderEl) {
      this.placeholderEl.remove();
      this.placeholderEl = null;
    }
  }

  /** Call before transitioning away from loading screen. */
  finalize(): void {
    this.clearPlaceholder();
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void {
    this.clearPlaceholder();
    this.el.remove();
  }
}
