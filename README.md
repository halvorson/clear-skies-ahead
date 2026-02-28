# clear-skies-ahead ☀️

**Point your phone. Find the sun.**

clear-skies-ahead is a progressive web app (PWA) that uses your current GPS location and the direction your phone is facing to find the nearest clear sky along that bearing — then tells you how far you'd need to travel to reach it.

## How it works

1. Open the app and tap **Find Clear Sky**
2. Grant location and compass permissions
3. The app searches outward along your bearing (1mi → 2 → 4 → 8...) until it finds clear sky, then narrows down to the nearest half-mile
4. You get a simple result: *"Clear sky is 5.5 miles NNW of you"*

## Tech stack

- **Frontend:** Vanilla TypeScript, Material Design 3
- **Backend:** Firebase Functions (API key proxy), Firebase Analytics
- **Weather API:** NOAA / National Weather Service (free, no key required for public endpoints)
- **Hosting:** Firebase Hosting

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Technical Design Document](docs/TDD.md)

## Development

```bash
npm install
npm run dev
```

See the [TDD](docs/TDD.md) for full setup instructions including Firebase configuration.

## License

MIT
