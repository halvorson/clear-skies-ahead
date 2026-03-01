import '@material/web/button/filled-button.js';
import type { PermissionType, DebugContext } from '../types';

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

function isPreproduction(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === 'preproduction'
  );
}

function bearingToCardinal(deg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function buildDebugPanel(
  errorType: PermissionType | 'unknown' | 'no_result',
  ctx: DebugContext | undefined,
): string {
  const rows: Array<[string, string]> = [];

  // ── Location ──────────────────────────────────────────────────────────────
  if (ctx?.coords) {
    const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = ctx.coords;
    rows.push(['Latitude', latitude.toFixed(6)]);
    rows.push(['Longitude', longitude.toFixed(6)]);
    rows.push(['GPS accuracy', `±${Math.round(accuracy)} m`]);
    if (altitude !== null && altitude !== undefined) {
      const altAcc = altitudeAccuracy !== null ? ` ±${Math.round(altitudeAccuracy)} m` : '';
      rows.push(['Altitude', `${Math.round(altitude)} m${altAcc}`]);
    }
  } else {
    rows.push(['Location', 'not available']);
  }

  // ── Compass ───────────────────────────────────────────────────────────────
  if (ctx?.bearingDegrees !== undefined) {
    const deg = ctx.bearingDegrees;
    rows.push(['Bearing', `${deg.toFixed(1)}° (${bearingToCardinal(deg)})`]);
  } else {
    rows.push(['Bearing', 'not available']);
  }

  // ── Browser / device ──────────────────────────────────────────────────────
  rows.push(['User agent', navigator.userAgent]);
  rows.push(['Geolocation API', 'geolocation' in navigator ? 'supported' : 'not supported']);

  const hasAbsolute = 'ondeviceorientationabsolute' in window;
  const hasRelative = 'ondeviceorientation' in window;
  rows.push([
    'DeviceOrientation',
    hasAbsolute ? 'absolute supported' : hasRelative ? 'relative only' : 'not supported',
  ]);

  // ── Error context ─────────────────────────────────────────────────────────
  rows.push(['Error type', errorType]);
  if (ctx?.errorMessage) {
    rows.push(['Error message', ctx.errorMessage]);
  }

  rows.push(['Timestamp', new Date().toISOString()]);

  const tableRows = rows
    .map(([k, v]) => `
      <tr>
        <th style="text-align:left;padding:4px 8px 4px 0;white-space:nowrap;opacity:0.7;font-weight:500">${k}</th>
        <td style="padding:4px 0;word-break:break-all;font-family:monospace">${escapeHtml(v)}</td>
      </tr>`)
    .join('');

  return `
    <details style="margin-top:24px;text-align:left;border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:12px;background:rgba(0,0,0,0.15)" open>
      <summary style="cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;opacity:0.8;margin-bottom:8px">
        Debug info (preproduction)
      </summary>
      <table style="font-size:12px;border-collapse:collapse;width:100%">
        <tbody>${tableRows}</tbody>
      </table>
    </details>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ErrorScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    errorType: PermissionType | 'unknown' | 'no_result',
    onRetry?: () => void,
    debugContext?: DebugContext,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--error';

    const config = getErrorConfig(errorType);
    const debugHtml = isPreproduction()
      ? buildDebugPanel(errorType, debugContext)
      : '';

    this.el.innerHTML = `
      <div class="error-content">
        <h2 class="error-heading">${config.heading}</h2>
        <p class="error-body">${config.body}</p>
        ${config.showRetry ? '<md-filled-button class="error-retry-btn">Try again</md-filled-button>' : ''}
        ${debugHtml}
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
