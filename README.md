# Clear Skies Ahead

**v1.0.0** — March 2026

A progressive web app that answers one question: **how far do I need to travel in the direction I'm facing to find clear sky?**

Point your phone, tap a button, get an answer. No map. No account required.

**Live:** https://clear-skies-ahead.web.app
**Preview channel:** https://clear-skies-ahead--dev-nhdzm47i.web.app

---

## How it works

1. Tap **Find Clear Sky**
2. The app reads your GPS location and live compass bearing
3. It checks sky cover along your exact bearing at exponentially increasing distances — 8 mi, 16, 32, 64... up to 1,000 miles — using the free NOAA/NWS weather API
4. When it finds a clear point, it binary-searches back toward you to narrow the result to the nearest half-mile
5. You get a single answer: *"Sky is clear 5.5 miles E of you"* — with a live compass arrow that rotates as you turn

The loading screen shows every distance checked in real time, annotated by phase (exponential scan → narrowing down).

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
