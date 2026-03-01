import '@material/web/button/filled-button.js';

export class LandingScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement, onCtaTap: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--landing';
    this.el.innerHTML = `
      <div class="screen-header">
        <span class="material-symbols-rounded screen-icon" aria-hidden="true">wb_sunny</span>
        <h1 class="app-title">Clear Skies Ahead</h1>
        <p class="app-tagline">
          Point your phone in any direction and find out how far it is to clear sky.
          One tap, one answer.
        </p>
      </div>
      <div class="screen-content">
        <md-filled-button class="cta-fab landing-btn" has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Find Clear Sky
        </md-filled-button>
      </div>
    `;
    container.appendChild(this.el);

    const btn = this.el.querySelector('.landing-btn') as HTMLElement;
    btn.addEventListener('click', onCtaTap);
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
