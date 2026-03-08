import '@material/web/button/filled-button.js';
import type { SearchResult, HistoryEntry } from '../types';
import { buildHistorySection, startHistoryIconCompass } from './historyHelpers';

function heroCardClass(result: SearchResult): string {
  if (result.outOfCoverage || !result.clearSkyFound) return 'hero-card--muted';
  if (result.searchMode === 'find-clouds') return 'hero-card--found-clouds';
  return 'hero-card--found-clear';
}

function buildResultCard(result: SearchResult): string {
  if (result.outOfCoverage) {
    const firstOoc = Math.min(...result.points.filter(p => p.skyCoverPercent < 0).map(p => p.distanceMiles));
    return `
      <div class="hero-card hero-card--muted">
        <span class="material-symbols-rounded hero-icon" aria-hidden="true">public_off</span>
        <p class="hero-headline">Ran out of coverage at ${firstOoc} miles</p>
        <p class="hero-subtext">This direction heads over the ocean, into Canada, or into Mexico. Try a different direction.</p>
      </div>
    `;
  }

  if (result.searchMode === 'find-clouds') {
    if (!result.clearSkyFound) {
      return `
        <div class="hero-card hero-card--sky">
          <span class="material-symbols-rounded hero-icon" aria-hidden="true">wb_sunny</span>
          <p class="hero-headline">Clear sky extends beyond 1,000 miles ${result.compassLabel}</p>
          <p class="hero-subtext">No clouds in this direction — enjoy the sunshine.</p>
        </div>
      `;
    }

    // Found cloud boundary — origin was sunny
    const rotation = result.bearingDegrees - 45;
    return `
      <div class="hero-card hero-card--found-clouds">
        <div class="hero-compass result-compass" aria-hidden="true">
          <span class="material-symbols-rounded" style="transform: rotate(${rotation}deg)">near_me</span>
        </div>
        <p class="hero-distance">${result.nearestClearMiles} mi</p>
        <p class="hero-direction">${result.compassLabel}</p>
        ${result.resultLocation ? `<p class="hero-caption">near ${result.resultLocation.city}, ${result.resultLocation.state}</p>` : ''}
      </div>
    `;
  }

  // find-clear mode
  if (!result.clearSkyFound) {
    return `
      <div class="hero-card hero-card--muted">
        <span class="material-symbols-rounded hero-icon" aria-hidden="true">cloud</span>
        <p class="hero-headline">No clear sky within 1,000 miles ${result.compassLabel}</p>
        <p class="hero-subtext">Try scanning a different direction.</p>
      </div>
    `;
  }

  // Found clear sky — origin was cloudy
  const rotation = result.bearingDegrees - 45;
  return `
    <div class="hero-card hero-card--found-clear">
      <div class="hero-compass result-compass" aria-hidden="true">
        <span class="material-symbols-rounded" style="transform: rotate(${rotation}deg)">near_me</span>
      </div>
      <p class="hero-distance">${result.nearestClearMiles} mi</p>
      <p class="hero-direction">${result.compassLabel}</p>
      ${result.resultLocation ? `<p class="hero-caption">near ${result.resultLocation.city}, ${result.resultLocation.state}</p>` : ''}
    </div>
  `;
}

export class ResultScreen {
  private el: HTMLElement;
  private orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
  private activeOrientationEvent: string | null = null;
  private stopHistoryCompass: (() => void) | null = null;
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

    this.el.innerHTML = `
      <div class="screen-content" style="width:100%;display:contents">
        ${buildResultCard(result)}
        <md-filled-button class="cta-fab result-btn" has-icon>
          <span slot="icon" class="material-symbols-rounded">my_location</span>
          Try a new direction
        </md-filled-button>
        ${buildHistorySection(history)}
      </div>
    `;
    container.appendChild(this.el);

    const btn = this.el.querySelector('.result-btn') as HTMLElement;
    btn.addEventListener('click', onCtaTap);

    this.startCompassListener();
    this.stopHistoryCompass = startHistoryIconCompass(this.el);
  }

  private startCompassListener(): void {
    this.orientationHandler = (event: DeviceOrientationEvent) => {
      const eventType = event.type;
      if (this.activeOrientationEvent === null) {
        this.activeOrientationEvent = eventType;
      } else if (eventType !== this.activeOrientationEvent) {
        return;
      }

      let heading: number | null = null;
      if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
        heading = (event as any).webkitCompassHeading as number;
      } else if (event.alpha !== null) {
        heading = (360 - event.alpha) % 360;
      }

      if (heading === null) return;

      const resultRotation = (this.resultBearing - heading + 360) % 360 - 45;

      const compassIcon = this.el.querySelector('.result-compass .material-symbols-rounded') as HTMLElement | null;
      if (compassIcon) {
        compassIcon.style.transform = `rotate(${resultRotation}deg)`;
      }
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
    this.stopHistoryCompass?.();
    this.el.remove();
  }
}
