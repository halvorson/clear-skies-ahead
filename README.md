# Clear Skies Ahead

**v1.1.1** — March 2026

A progressive web app that answers one question: **how far do I need to travel to reach the edge of the current sky conditions?** If you're under clouds, it finds the nearest clear sky. If you're in sunshine, it finds where the clouds begin.

Point your phone, tap a button, get an answer. No map. No account required.

**Live:** https://clear-skies-ahead.web.app
**Preview channel:** https://clear-skies-ahead--dev-nhdzm47i.web.app

---

## How it works

1. Aim your phone and tap the button
2. The app reads your GPS location and live compass bearing
3. It checks sky cover at your current location to determine search direction:
   - **Cloudy?** Searches outward for the nearest clear sky
   - **Sunny?** Searches outward for where the clouds begin
4. It scans at exponentially increasing distances — 1 mi, 2, 4, 8... up to 1,000 miles — using the free NOAA/NWS weather API
5. When it finds the sky boundary, it binary-searches back toward you to narrow the result to the nearest half-mile
6. You get a single answer — *"Clear sky begins 5.5 mi E"* or *"Clouds begin 12 mi NE"* — with a live compass arrow that rotates as you turn

The hero card changes color to match the result: warm amber for sun-dominant outcomes, steel blue for cloud-dominant ones. The search progress log appears live inside the card as distances are checked.

---

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Bundler | Vite |
| UI | Vanilla TS + Material Web Components (MD3) |
| Weather API | NOAA/NWS `api.weather.gov` — free, no key required |
| Hosting | Firebase Hosting |
| Analytics | Firebase Analytics |
| PWA | `vite-plugin-pwa` |
| CI/CD | GitHub Actions |

---

## Development

### Local setup

```bash
git clone git@github.com:halvorson/clear-skies-ahead.git
cd clear-skies-ahead
npm install
cp .env.example .env.local
# fill in Firebase config values from your Firebase console
npm run dev
```

`npm run dev` runs a local Vite dev server. Useful for UI work, but **compass and geolocation require HTTPS** — use the preview channel for real device testing.

### Deploy environments

| Environment | URL | Trigger |
|---|---|---|
| Preview | `clear-skies-ahead--dev-nhdzm47i.web.app` | Push to `main` — auto via GitHub Actions |
| Production | `clear-skies-ahead.web.app` | Publish a GitHub release — auto via GitHub Actions |

Manual deploys:
```bash
npm run deploy:preview   # → preview channel
npm run deploy:prod      # → production
```

### GitHub Actions secrets

All seven Firebase config vars plus the service account:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
GOOGLE_APPLICATION_CREDENTIALS_B64   ← base64-encoded Firebase service account JSON
```

---

## How this was built

This project was built almost entirely through conversations with [Claude Code](https://claude.ai/claude-code) — Anthropic's CLI coding assistant — starting from a blank repo.

**Design:** The initial UI pass came from [Figma Make](https://www.figma.com/make/). A design was generated there, then pulled directly into the codebase through Claude Code's Figma MCP integration and translated from React + MUI into the project's Vanilla TS + Material Web Components stack.

**Development:** Feature work ran in multi-agent Claude Code sessions. Complex tasks were split into parallel workstreams — one agent per file ownership domain — with a circular review chain before merging. The `TASKS.md` file in the repo root is the task board used throughout; it includes a handoff prompt that an agent can read to continue where the previous session left off.

**What worked well:**
- Parallel agents with strict file ownership avoided merge conflicts entirely
- The two-phase loading log (show distance immediately, fill in result when the API returns) came from a real UX observation during device testing
- Out-of-coverage handling (ocean, Canada, Mexico returning NWS 404s) was discovered through actual use and handled gracefully without touching the core search algorithm
- Hooking the Figma MCP directly into Claude Code meant zero manual design-to-code translation

---

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Technical Design Document](docs/TDD.md)
- [Task board](TASKS.md)

## License

MIT
