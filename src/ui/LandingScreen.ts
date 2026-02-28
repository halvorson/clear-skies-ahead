import '@material/web/button/filled-button.js';

export class LandingScreen {
  private el: HTMLElement;

  constructor(container: HTMLElement, onCtaTap: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--landing';
    this.el.innerHTML = `
      <div class="landing-content">
        <h1 class="landing-title">Clear Skies Ahead</h1>
        <p class="landing-copy">
          Point your phone in any direction and tap the button.
          We'll tell you exactly how far you need to travel to find clear sky.
        </p>
      </div>
      <div class="landing-cta">
        <md-filled-button class="landing-btn">Find Clear Sky</md-filled-button>
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
