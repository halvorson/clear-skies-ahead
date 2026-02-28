import '@material/web/button/filled-button.js';
import type { PermissionType } from '../types';

interface ErrorConfig {
  heading: string;
  body: string;
  showRetry: boolean;
}

function getErrorConfig(errorType: PermissionType | 'unknown' | 'no_result'): ErrorConfig {
  switch (errorType) {
    case 'location':
      return {
        heading: 'Location access required',
        body: 'Please enable location access in your browser settings and reload the page.',
        showRetry: false,
      };
    case 'compass':
      return {
        heading: 'Compass not available',
        body: 'This app requires compass hardware. It may not be supported on your device or browser.',
        showRetry: false,
      };
    case 'no_result':
      return {
        heading: 'No clear sky found',
        body: 'No clear sky within 1,000 miles in that direction. Try pointing in a different direction.',
        showRetry: true,
      };
    case 'unknown':
      return {
        heading: 'Something went wrong',
        body: 'Please reload and try again.',
        showRetry: false,
      };
  }
}

export class ErrorScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    errorType: PermissionType | 'unknown' | 'no_result',
    onRetry?: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--error';

    const config = getErrorConfig(errorType);

    this.el.innerHTML = `
      <div class="error-content">
        <h2 class="error-heading">${config.heading}</h2>
        <p class="error-body">${config.body}</p>
        ${config.showRetry ? '<md-filled-button class="error-retry-btn">Try again</md-filled-button>' : ''}
      </div>
    `;
    container.appendChild(this.el);

    if (config.showRetry && onRetry) {
      const btn = this.el.querySelector('.error-retry-btn') as HTMLElement;
      btn.addEventListener('click', onRetry);
    }
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
