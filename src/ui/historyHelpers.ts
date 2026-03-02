import type { HistoryEntry } from '../types';

export function startHistoryIconCompass(container: HTMLElement): () => void {
  let activeEvent: string | null = null;

  const handler = (event: DeviceOrientationEvent) => {
    if (activeEvent === null) {
      activeEvent = event.type;
    } else if (event.type !== activeEvent) {
      return;
    }

    let heading: number | null = null;
    if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
      heading = (event as any).webkitCompassHeading as number;
    } else if (event.alpha !== null) {
      heading = (360 - event.alpha) % 360;
    }

    if (heading === null) return;

    const icons = container.querySelectorAll('.history-icon') as NodeListOf<HTMLElement>;
    icons.forEach(icon => {
      const bearing = parseFloat(icon.dataset.bearing ?? '0');
      icon.style.transform = `rotate(${(bearing - heading! + 360) % 360}deg)`;
    });
  };

  window.addEventListener('deviceorientationabsolute', handler as EventListener);
  window.addEventListener('deviceorientation', handler as EventListener);

  return () => {
    window.removeEventListener('deviceorientationabsolute', handler as EventListener);
    window.removeEventListener('deviceorientation', handler as EventListener);
  };
}

export function timeAgo(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

export function buildHistorySection(history: HistoryEntry[]): string {
  if (history.length === 0) return '';

  const recentHistory = [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const entries = recentHistory.map(entry => {
    let iconClass: string;
    let text: string;

    if (entry.outOfCoverage) {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — out of coverage at ${entry.distanceMiles} mi`;
    } else if (entry.clearSkyFound) {
      iconClass = 'history-icon';
      const coverStr = entry.skyCoverPercent !== undefined ? ` (${entry.skyCoverPercent}% clouds)` : '';
      text = `${entry.compassLabel} — ${entry.distanceMiles} mi${coverStr}`;
    } else {
      iconClass = 'history-icon history-icon--no-result';
      text = `${entry.compassLabel} — no clear sky (${entry.distanceMiles} mi checked)`;
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
