import '@material/web/button/filled-button.js';
import type { PermissionType, DebugContext, HistoryEntry } from '../types';

interface ErrorConfig {
  heading: string;
  body: string;
}

function getErrorConfig(errorType: PermissionType | 'unknown'): ErrorConfig {
  switch (errorType) {
    case 'location':
      return {
        heading: 'Location access required',
        body: 'Please enable location access in your browser settings and try again.',
      };
    case 'compass':
      return {
        heading: 'Compass not available',
        body: 'This app requires compass hardware. It may not be supported on your device or browser.',
      };
    case 'unknown':
      return {
        heading: 'Something went wrong',
        body: 'Please try again.',
      };
  }
}

function isPreproduction(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === 'preproduction'
  );
}

function timeAgo(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

function buildHistorySection(history: HistoryEntry[]): string {
  if (history.length === 0) return '';

  const recentHistory = [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const entries = recentHistory.map(entry => {
    let iconClass: string;
    let text: string;

    if (entry.outOfCoverage) {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no coverage (${entry.distanceMiles} mi)`;
    } else if (entry.clearSkyFound) {
      iconClass = 'history-icon';
      text = `${entry.compassLabel} — ${entry.distanceMiles} mi`;
    } else {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no clear sky`;
    }

    return `
      <div class="history-entry">
        <span class="material-symbols-rounded ${iconClass}" aria-hidden="true" data-bearing="${entry.bearingDegrees}">navigation</span>
        <span class="history-entry-text">${text}</span>
        <span class="history-entry-time">${timeAgo(entry.timestamp)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="history-section">
      <hr class="history-divider" />
      <span class="history-label">Recent Searches</span>
      ${entries}
    </div>
  `;
}

function bearingToCardinal(deg: number): string {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function buildDebugText(rows: Array<[string, string]>): string {
  return rows.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDebugPanel(
  errorType: PermissionType | 'unknown',
  ctx: DebugContext | undefined,
): string {
  const rows: Array<[string, string]> = [];

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

  if (ctx?.bearingDegrees !== undefined) {
    const deg = ctx.bearingDegrees;
    rows.push(['Bearing', `${deg.toFixed(1)}° (${bearingToCardinal(deg)})`]);
  } else {
    rows.push(['Bearing', 'not available']);
  }

  rows.push(['User agent', navigator.userAgent]);
  rows.push(['Geolocation API', 'geolocation' in navigator ? 'supported' : 'not supported']);

  const hasAbsolute = 'ondeviceorientationabsolute' in window;
  const hasRelative = 'ondeviceorientation' in window;
  rows.push([
    'DeviceOrientation',
    hasAbsolute ? 'absolute supported' : hasRelative ? 'relative only' : 'not supported',
  ]);

  rows.push(['Error type', errorType]);
  if (ctx?.errorMessage) {
    rows.push(['Error message', ctx.errorMessage]);
  }
  rows.push(['Timestamp', new Date().toISOString()]);

  const debugText = buildDebugText(rows);

  const tableRows = rows
    .map(([k, v]) => `
      <tr>
        <th style="text-align:left;padding:4px 8px 4px 0;white-space:nowrap;opacity:0.7;font-weight:500">${k}</th>
        <td style="padding:4px 0;word-break:break-all;font-family:monospace">${escapeHtml(v)}</td>
      </tr>`)
    .join('');

  return `
    <details style="text-align:left;border:1px solid rgba(0,0,0,0.12);border-radius:8px;padding:12px;background:rgba(0,0,0,0.04);width:100%">
      <summary style="cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;opacity:0.7;margin-bottom:8px">
        Debug info (preproduction)
      </summary>
      <table style="font-size:12px;border-collapse:collapse;width:100%;color:#1b1c1e">
        <tbody>${tableRows}</tbody>
      </table>
      <button data-debug-text="${escapeHtml(debugText)}" style="margin-top:10px;font-size:11px;padding:4px 10px;border:1px solid rgba(0,0,0,0.3);border-radius:4px;background:rgba(0,0,0,0.06);color:#44474e;cursor:pointer">
        Copy
      </button>
    </details>
  `;
}

export class ErrorScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    errorType: PermissionType | 'unknown',
    onRetry?: () => void,
    debugContext?: DebugContext,
    history: HistoryEntry[] = [],
  ) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--error';

    const config = getErrorConfig(errorType);
    const debugHtml = isPreproduction()
      ? buildDebugPanel(errorType, debugContext)
      : '';

    this.el.innerHTML = `
      <div class="screen-header">
        <span class="material-symbols-rounded screen-icon" aria-hidden="true">wb_sunny</span>
        <h1 class="app-title">Clear Skies Ahead</h1>
      </div>
      <div class="screen-content">
        <div class="no-result-card">
          <p class="no-result-headline">${config.heading}</p>
          <p class="no-result-subtext">${config.body}</p>
        </div>
        <md-filled-button class="cta-fab error-retry-btn" has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Start over
        </md-filled-button>
        ${buildHistorySection(history)}
        ${debugHtml}
      </div>
    `;
    container.appendChild(this.el);

    if (onRetry) {
      const btn = this.el.querySelector('.error-retry-btn') as HTMLElement;
      btn.addEventListener('click', onRetry);
    }

    const copyBtn = this.el.querySelector('[data-debug-text]') as HTMLButtonElement | null;
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = copyBtn.dataset.debugText ?? '';
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        });
      });
    }
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
