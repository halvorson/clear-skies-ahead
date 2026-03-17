import '@material/web/button/filled-button.js';

export class LandingScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement, onCtaTap: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--landing';
    this.el.innerHTML = `
      <div class="hero-card hero-card--sky">
        <span class="material-symbols-rounded hero-icon" aria-hidden="true">wb_sunny</span>
        <h1 class="app-title">Clear Skies Ahead</h1>
        <p class="app-tagline">Clear skies? Find the closest clouds. Cloudy? Find the nearest sun. Aim your phone and press the button to get started.</p>
      </div>
      <md-filled-button class="cta-fab landing-btn" has-icon>
        <span slot="icon" class="material-symbols-rounded">my_location</span>
        Find Clear Sky
      </md-filled-button>
      <div class="app-footer">
        <p class="app-version">v${__APP_VERSION__}${import.meta.env.VITE_APP_ENV === 'preproduction' ? '+' : ''}</p>
        <button class="share-btn" aria-label="Share this app">
          <span class="material-symbols-rounded">share</span>
        </button>
      </div>
    `;
    container.appendChild(this.el);

    const btn = this.el.querySelector('.landing-btn') as HTMLElement;
    btn.addEventListener('click', onCtaTap);

    const shareBtn = this.el.querySelector('.share-btn') as HTMLElement;
    shareBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'Clear Skies Ahead',
          text: 'Point your phone and find out how far you need to travel to reach clear sky.',
          url: window.location.href,
        }).catch(() => {/* user cancelled */});
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          shareBtn.querySelector('.material-symbols-rounded')!.textContent = 'check';
          setTimeout(() => {
            shareBtn.querySelector('.material-symbols-rounded')!.textContent = 'share';
          }, 2000);
        });
      }
    });
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
