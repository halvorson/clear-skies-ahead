import '@material/web/progress/circular-progress.js';

export class LoadingScreen {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private logEl: HTMLElement;

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

  addProgressEntry(distanceMiles: number, skyCoverPercent: number, clear: boolean): void {
    const dist = distanceMiles === Math.round(distanceMiles)
      ? `${distanceMiles} mi`
      : `${distanceMiles.toFixed(1)} mi`;
    const icon = clear ? '☀' : '☁';
    const label = clear ? 'clear!' : `still cloudy (${skyCoverPercent}%)`;

    const row = document.createElement('div');
    row.textContent = `${icon}  ${dist} — ${label}`;
    row.style.opacity = clear ? '1' : '0.55';
    this.logEl.appendChild(row);
    const bottomZone = this.logEl.parentElement;
    if (bottomZone) bottomZone.scrollTop = bottomZone.scrollHeight;
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
