import '@material/web/progress/circular-progress.js';

export class LoadingScreen {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private logEl: HTMLElement;
  private hasLoggedEntry = false;
  private placeholderEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--loading';
    this.el.innerHTML = `
      <div class="loading-top-zone">
        <div class="screen-header">
          <span class="material-symbols-rounded screen-icon screen-icon--spinning" aria-hidden="true">wb_sunny</span>
          <h1 class="app-title">Clear Skies Ahead</h1>
        </div>
        <md-circular-progress indeterminate class="loading-spinner"></md-circular-progress>
        <p class="loading-status"></p>
      </div>
      <div class="loading-bottom-zone">
        <div class="loading-log"></div>
      </div>
    `;
    container.appendChild(this.el);

    this.statusEl = this.el.querySelector('.loading-status') as HTMLElement;
    this.logEl = this.el.querySelector('.loading-log') as HTMLElement;
  }

  setStatus(message: string): void {
    this.statusEl.textContent = message;
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

    let label: string;
    if (skyCoverPercent < 0) {
      label = 'out of coverage';
    } else if (isClear) {
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
