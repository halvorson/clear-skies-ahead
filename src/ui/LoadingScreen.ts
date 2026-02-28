import '@material/web/progress/circular-progress.js';

export class LoadingScreen {
  private el: HTMLElement;
  private statusEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--loading';
    this.el.innerHTML = `
      <div class="loading-content">
        <md-circular-progress indeterminate></md-circular-progress>
        <p class="loading-status"></p>
      </div>
    `;
    container.appendChild(this.el);

    this.statusEl = this.el.querySelector('.loading-status') as HTMLElement;
  }

  setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
