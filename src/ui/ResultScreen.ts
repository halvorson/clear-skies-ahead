import '@material/web/button/filled-button.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import type { SearchResult, HistoryEntry } from '../types';

function timeAgo(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
}

export class ResultScreen {
  private el: HTMLElement;

  constructor(
    container: HTMLElement,
    result: SearchResult,
    history: HistoryEntry[],
    onCtaTap: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'screen screen--result';

    // Find sky cover at the last clear point
    let skyCoverHtml = '';
    for (let i = result.points.length - 1; i >= 0; i--) {
      if (result.points[i].isClear) {
        skyCoverHtml = `<p class="result-sky-cover">Sky cover: ${result.points[i].skyCoverPercent}% at that location</p>`;
        break;
      }
    }

    // History: most recent first, max 10
    const recentHistory = [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    const historyHtml = recentHistory.length > 0
      ? `<md-list class="result-history">
          ${recentHistory.map(entry => `
            <md-list-item>
              <span slot="headline">${entry.compassLabel} — ${entry.distanceMiles} miles — ${timeAgo(entry.timestamp)}</span>
            </md-list-item>
          `).join('')}
        </md-list>`
      : '';

    this.el.innerHTML = `
      <div class="result-content">
        <p class="result-headline">Clear sky is ${result.nearestClearMiles} miles ${result.compassLabel} of you</p>
        ${skyCoverHtml}
        <md-filled-button class="result-btn">Point your phone and try a new direction</md-filled-button>
        ${historyHtml}
      </div>
    `;
    container.appendChild(this.el);

    const btn = this.el.querySelector('.result-btn') as HTMLElement;
    btn.addEventListener('click', onCtaTap);
  }

  show(): void { this.el.style.display = ''; }
  hide(): void { this.el.style.display = 'none'; }
  destroy(): void { this.el.remove(); }
}
