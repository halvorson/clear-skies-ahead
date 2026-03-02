import type { HistoryEntry } from '../types';

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
      text = `${entry.compassLabel} — no coverage (${entry.distanceMiles} mi)`;
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
