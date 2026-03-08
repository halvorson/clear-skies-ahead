
import '@material/web/button/filled-button.js';
import type { HistoryEntry } from '../types';
import { buildHistorySection, startHistoryIconCompass } from './historyHelpers';

export class LoadingScreen {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private logEl: HTMLElement;
  private lastLoggedIsClear: boolean | null = null;
  private placeholderEl: HTMLElement | null = null;
  private stopCompass: (() => void) | null = null;

  constructor(container: HTMLElement, history: HistoryEntry[] = []) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--loading';
    this.el.innerHTML = `
      <div class="hero-card hero-card--sky">
        <span class="material-symbols-rounded hero-icon hero-icon--spinning" aria-hidden="true">wb_sunny</span>
        <p class="loading-status"></p>
        <div class="loading-log"></div>
      </div>
      <md-filled-button class="cta-fab" disabled has-icon>
        <span slot="icon" class="material-symbols-rounded">my_location</span>
        Try a new direction
      </md-filled-button>
      ${buildHistorySection(history)}
    `;
    container.appendChild(this.el);

    this.statusEl = this.el.querySelector('.loading-status') as HTMLElement;
    this.logEl = this.el.querySelector('.loading-log') as HTMLElement;

    this.stopCompass = startHistoryIconCompass(this.el);
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
    row.style.fontWeight = '600';
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
    row.innerHTML = `<span class="material-symbols-rounded log-icon">hourglass_empty</span>  ${dist} — checking…`;
    row.style.opacity = '0.5';
    row.style.fontStyle = 'italic';
    this.logEl.prepend(row);

    return row;
  }

  /** Phase 2: fill in the result on a row created by startEntry(). */
  resolveEntry(row: HTMLElement, skyCoverPercent: number, isClear: boolean): void {
    const distText = row.textContent?.match(/[\d.]+\s*mi/)?.[0] ?? '';

    if (skyCoverPercent < 0) {
      row.innerHTML = `<span class="material-symbols-rounded log-icon">remove</span>  ${distText} — out of coverage`;
      row.style.opacity = '0.4';
      row.style.fontStyle = 'italic';
      return;
    }

    const iconName = isClear ? 'wb_sunny' : 'cloud';

    let label: string;
    if (isClear) {
      label = this.lastLoggedIsClear === true ? 'still clear!' : 'clear!';
    } else {
      label = this.lastLoggedIsClear === false ? `still cloudy (${skyCoverPercent}%)` : `cloudy (${skyCoverPercent}%)`;
    }

    row.innerHTML = `<span class="material-symbols-rounded log-icon">${iconName}</span>  ${distText} — ${label}`;
    row.style.opacity = isClear ? '1' : '0.55';
    row.style.fontStyle = '';

    this.lastLoggedIsClear = isClear;

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
    this.stopCompass?.();
    this.clearPlaceholder();
    this.el.remove();
  }
}
