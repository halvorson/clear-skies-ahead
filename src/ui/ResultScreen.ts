import '@material/web/button/filled-button.js';
import type { SearchResult, HistoryEntry } from '../types';

function timeAgo(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

function buildResultCard(result: SearchResult): string {
  if (result.outOfCoverage) {
    return `
      <div class="no-result-card">
        <p class="no-result-headline">No coverage in this direction</p>
        <p class="no-result-subtext">NWS doesn't cover the ocean, Canada, or Mexico. Try a different direction.</p>
      </div>
    `;
  }

  if (!result.clearSkyFound) {
    return `
      <div class="no-result-card">
        <p class="no-result-headline">No clear sky within 1,000 miles</p>
        <p class="no-result-subtext">Try pointing your phone a different way.</p>
      </div>
    `;
  }

  // Rotate the near_me icon (which points NE at 0°) by bearing - 45° to point in the right direction
  const rotation = result.bearingDegrees - 45;

  return `
    <div class="result-card">
      <div class="result-compass" aria-hidden="true">
        <span class="material-symbols-rounded" style="transform: rotate(${rotation}deg)">near_me</span>
      </div>
      <p class="result-headline">${result.nearestClearMiles} miles ${result.compassLabel}</p>
      <p class="result-subtext">Clear sky is ${result.nearestClearMiles} miles ${result.compassLabel} of you</p>
    </div>
  `;
}

function buildHistorySection(history: HistoryEntry[]): string {
  if (history.length === 0) return '';

  const entries = history.map(entry => {
    let iconName: string;
    let iconClass: string;
    let text: string;
    let dataBearing: string;

    if (entry.outOfCoverage) {
      iconName = 'public_off';
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no coverage`;
      dataBearing = ''; // no rotation for coverage icons
    } else if (entry.clearSkyFound) {
      iconName = 'navigation';
      iconClass = 'history-icon';
      text = `${entry.compassLabel} — ${entry.distanceMiles} mi`;
      dataBearing = `data-bearing="${entry.bearingDegrees}"`;
    } else {
      iconName = 'navigation';
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no clear sky`;
      dataBearing = `data-bearing="${entry.bearingDegrees}"`;
    }

    return `
      <div class="history-entry">
        <span class="material-symbols-rounded ${iconClass}" aria-hidden="true" ${dataBearing}>${iconName}</span>
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

export class ResultScreen {
  private el: HTMLElement;
  private orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
  private activeOrientationEvent: string | null = null;
  private resultBearing: number;

  constructor(
    container: HTMLElement,
    result: SearchResult,
    history: HistoryEntry[],
    onCtaTap: () => void,
  ) {
    this.resultBearing = result.bearingDegrees;
    this.el = document.createElement('div');
    this.el.className = 'screen screen--result';

    const recentHistory = [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    this.el.innerHTML = `
      <div class="screen-header">
        <span class="material-symbols-rounded screen-icon" aria-hidden="true">wb_sunny</span>
        <h1 class="app-title">Clear Skies Ahead</h1>
      </div>
      <div class="screen-content">
        ${buildResultCard(result)}
        <md-filled-button class="cta-fab result-btn" has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Try a new direction
        </md-filled-button>
        ${buildHistorySection(recentHistory)}
      </div>
    `;
    container.appendChild(this.el);

    const btn = this.el.querySelector('.result-btn') as HTMLElement;
    btn.addEventListener('click', onCtaTap);

    this.startCompassListener();
  }

  private startCompassListener(): void {
    this.orientationHandler = (event: DeviceOrientationEvent) => {
      // Deduplicate: once we know which event fires, ignore the other
      const eventType = event.type;
      if (this.activeOrientationEvent === null) {
        this.activeOrientationEvent = eventType;
      } else if (eventType !== this.activeOrientationEvent) {
        return;
      }

      // Extract heading: prefer webkitCompassHeading (iOS), else derive from alpha
      let heading: number | null = null;
      if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
        heading = (event as any).webkitCompassHeading as number;
      } else if (event.alpha !== null) {
        heading = (360 - event.alpha) % 360;
      }

      if (heading === null) return;

      // Result compass: point toward clear sky relative to current heading
      const resultRotation = (this.resultBearing - heading + 360) % 360 - 45;

      // Update result-card compass icon
      const compassIcon = this.el.querySelector('.result-compass .material-symbols-rounded') as HTMLElement | null;
      if (compassIcon) {
        compassIcon.style.transform = `rotate(${resultRotation}deg)`;
      }

      // Update all history icons (compute rotation per icon based on its stored bearing)
      const historyIcons = this.el.querySelectorAll('.history-icon') as NodeListOf<HTMLElement>;
      historyIcons.forEach(icon => {
        const bearing = parseFloat(icon.dataset.bearing ?? '0');
        const historyRotation = (bearing - heading + 360) % 360;
        icon.style.transform = `rotate(${historyRotation}deg)`;
      });
    };

    window.addEventListener('deviceorientationabsolute', this.orientationHandler as EventListener);
    window.addEventListener('deviceorientation', this.orientationHandler as EventListener);
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }

  destroy(): void {
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientationabsolute', this.orientationHandler as EventListener);
      window.removeEventListener('deviceorientation', this.orientationHandler as EventListener);
      this.orientationHandler = null;
    }
    this.el.remove();
  }
}
