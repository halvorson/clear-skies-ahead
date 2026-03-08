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
      </div>
      <div class="screen-content">
        <div class="result-card">
          <p class="app-tagline">
            Point your phone in any direction. Cloudy? Find out how far to clear sky. Sunny? Find out where the clouds begin. One tap, one answer.
          </p>
        </div>
        <md-filled-button class="cta-fab landing-btn" has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Find Clear Sky
        </md-filled-button>
        <p class="app-version">v${__APP_VERSION__}${import.meta.env.VITE_APP_ENV === 'preproduction' ? '+' : ''}</p>
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
