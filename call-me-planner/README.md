# Call-Me Planner

A personal planner for Personal, Company A and Company B, with reminders that escalate to a ring
screen and a real phone call. See `../PLAN.md` for the build phases.

## Run it

```bash
npm install
npm start
```

Scan the QR code with the **Expo Go** app on your phone (Phases 0–1.6). From step 1.7 the alarm code
needs a dev build instead:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform android
```

Browser app: `npm run web`.

## Checks

| Command                            | What it does                           |
| ---------------------------------- | -------------------------------------- |
| `npm run typecheck`                | TypeScript, strict                     |
| `npm run lint`                     | ESLint (Expo config + Prettier)        |
| `npm run test`                     | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run format`                   | Format everything with Prettier        |
| `npm run check`                    | All of the above, same as CI           |
| `maestro test .maestro/smoke.yaml` | Phone end-to-end smoke test            |

## Layout

```
src/
  app/          screens (expo-router: every file is a route)
  config/       .env values (EXPO_PUBLIC_* only)
  data/         expo-sqlite: db.ts, migrations.ts, repositories/, sync/
  domain/       pure TypeScript logic (rollover, recurrence, capacity, reminder planner)
  stores/       zustand stores
  device/       alarms, audio, speech, location, widgets
  ui/           theme tokens and shared components
modules/        native Kotlin / Swift modules (alarms, Phase 1.7)
supabase/       migrations and Edge Functions (Phase 2)
```

## Database migrations

Add a new step to the end of `MIGRATIONS` in `src/data/migrations.ts`. Never edit a step that has
shipped. The app records the last step it ran in `PRAGMA user_version`.

## Environment

Copy `.env.example` to `.env`. Only public `EXPO_PUBLIC_*` values go there.
