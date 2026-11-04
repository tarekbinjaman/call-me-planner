# Call-Me Planner — Build Plan

A personal planner for one person with three areas of work: **Personal**, **Company A** and **Company B**.
It saves tasks for today and tomorrow, groups them by company and plan, and escalates reminders for
must-do tasks: notification → voice note → full-screen ring → real phone call → buddy text.

**Two apps, one account:**

| | Mobile app (iOS / Android) | Browser app (laptop or any computer) |
|---|---|---|
| Add, edit, delete, reorder tasks | Yes | Yes |
| Workspaces, plans, reminder rules, quiet hours, settings | Yes | Yes |
| Record voice notes | Yes | Yes (computer microphone) |
| Rings, alarms, ring screen | **Yes, the only place that rings** | No. Shows whether the phone's alarms are armed |

Anything you change in the browser reaches the phone within seconds, and the phone re-plans its alarms
to match. Both apps are built from the same Expo codebase.

---

## Tech stack

| Area | Choice |
|------|--------|
| App | Expo SDK 58 (React Native 0.88, React 19.3) + TypeScript 6. Store version of Expo Go for quick testing; EAS dev builds for alarm work and releases |
| Navigation | `expo-router`: tabs, stacks and modals (ring screen is a full-screen modal) |
| Local database | Plain `expo-sqlite`, no ORM. Tables written as SQL `CREATE TABLE` statements. Migration steps run on app open, tracked with `PRAGMA user_version` |
| Repositories | One per table with typed helpers: `getAll()`, `getById()`, `insert()`, `update()`, `softDelete()` |
| State | `zustand` stores hold lists loaded from the repositories and reload on `addDatabaseChangeListener`, so a local write or a sync refreshes the screens |
| Backend | `@supabase/supabase-js` for auth and Postgres. Session stored with `expo-secure-store` on the phone (browser uses local storage, since secure-store is phone-only) |
| Supabase queries | Only in the sync engine and auth: `supabase.from('task').upsert(...)` and `.select().gt('server_updated_at', since)`. Screens always read the local SQLite copy |
| Network | `@react-native-community/netinfo` to know when to sync |
| Forms | `react-hook-form` + `zod` |
| Charts | `victory-native` |
| Dates | `date-fns` |
| Export / import | `papaparse` (CSV), `expo-print` (PDF), `expo-sharing`, `expo-file-system`, `expo-document-picker` |
| Keys | Supabase URL and public key in `.env` as `EXPO_PUBLIC_*`, never typed into the code. Twilio and Claude API keys live only in Supabase Edge Function secrets |
| Native modules (alarms) | Kotlin module (Android exact alarms + full-screen intent), Swift module (iOS AlarmKit). These need an EAS dev build and don't run in Expo Go |
| Audio | `expo-audio` (record and play voice notes) |
| Tests | Vitest for pure logic in `src/domain`, Maestro for phone end-to-end |

- Architecture: https://claude.ai/artifact/8A8XN3SWMcLm97HN2xeSxC
- Plan written: 4 Nov 2026

---

## How to read this plan

- Phases run **in order**. Each phase ends with something you can install and use every day.
- Every task is a checkbox. Tick it when it is merged and tested on a real phone.
- **Done when** at the end of each phase is the test that says the phase is finished.
- `P1`…`P4` tags in the architecture page match the phase numbers here.

---

## Decisions to make before Phase 0

| # | Decision | Options | Affects |
|---|----------|---------|---------|
| D1 | Which phone do you use? | **Decided: Android 12** | Ring screen in Phase 1. Older iPhones only get a 30 s notification sound until the Phase 2 phone call. |
| D2 | Does a company pay you by the hour? | Yes / No | If yes, move the time tracker from Phase 4 into Phase 2. |
| D3 | Do you want the buddy text feature? | Yes / No / Later | Phase 4 scope |
| D4 | App name and bundle id | e.g. `com.yourname.callmeplanner` | Needed for store builds in Phase 0 |
| D5 | Default reminder ladder timings | **Decided: −15, 0, +10, +20, +40 min** | Phase 1 reminder policy seed |
| D6 | Quiet hours | **Decided: 22:00–07:00** | Phase 1 |

---

## Phase 0 — Project setup

**Goal:** an empty app that builds, runs on your phone and has tests and CI in place.

### Tooling
- [x] Node and Git installed
- [ ] Android Studio (Android emulator) and/or Xcode (iPhone simulator, needs a Mac) — optional, a real phone with Expo Go is enough for now
- [x] Create an Expo account, then `npx eas-cli@latest login` and `npx eas-cli@latest init` (the CLI itself works via npx)
- [x] Create the app on Expo SDK 58 with TypeScript 6 and `expo-router`
- [ ] Run it in the store version of Expo Go on your phone (`npm start`, scan the QR code)
- [x] Set up EAS and a dev build profile (needed from step 1.7, because native alarm code doesn't run in Expo Go)
- [x] Set up ESLint, Prettier and strict TypeScript
- [x] Set up Vitest for `src/domain` and Maestro for phone end-to-end tests
- [x] GitHub Actions workflow: typecheck, lint, unit tests, formatting, expo-doctor (`.github/workflows/ci.yml`)
- [x] Create the GitHub repo and push, so CI runs

### Skeleton
- [x] Create the folder structure (`app/`, `src/domain`, `src/data`, `src/stores`, `src/device`, `src/ui`, `modules/`, `supabase/`)
- [x] Add the `expo-router` tab bar: Today, Tomorrow, Inbox, Review
- [x] Add design tokens (colors for Personal / Company A / Company B, light and dark theme, font sizes)
- [x] Add plain `expo-sqlite` with a migration runner: an ordered list of SQL steps, run on app open, tracked with `PRAGMA user_version`
- [x] Add `.env` (git-ignored) and `.env.example` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Done when:** the app opens in Expo Go on your phone, shows the four empty tabs, the migration runner sets `user_version` to 1, and CI is green.

---

## Phase 1 — MVP: works on one phone, fully offline

**Goal:** you can plan your day across all three areas and the app rings you when a must-do task is late.
No account, no internet needed.

### 1.1 Data layer
- [x] SQL `CREATE TABLE` migration for: `workspace`, `plan`, `task`, `recording`, `reminder_policy`, `reminder`, `reminder_event`, `daily_note`, `settings`
- [x] Common columns on every table: `id` (UUID made on device), `created_at`, `updated_at`, `deleted_at` (soft delete)
- [x] Indexes for the hot queries: `task(scheduled_date, status)`, `task(workspace_id)`, `reminder(fire_at, status)`
- [x] Typed repository helpers per table: `getAll()`, `getById()`, `insert()`, `update()`, `softDelete()`
- [x] `zustand` list-store factory that reloads on `addDatabaseChangeListener`; workspaces store done (task and plan stores are added with their screens in 1.2–1.4)
- [x] Seed on first launch: Personal, Company A, Company B workspaces with colors and a default reminder policy

### 1.2 Workspaces and plans
- [x] Workspace screen: name, color, daily hour budget, working hours
- [x] Plan list per workspace with status (active / paused / done) and target date
- [x] Plan screen: tasks in the plan and a progress bar ("7 of 12 done")

### 1.3 Tasks
- [x] Quick add bar (title only → goes to Inbox)
- [x] Full task form (`react-hook-form` + `zod`): workspace, plan, scheduled date, due time, priority, estimate, must-do, critical, notes
- [x] Subtasks (one level)
- [x] Mark done / doing / dropped, with undo
- [x] Reorder within a day: Reorder mode with move up / move down buttons on Today and Tomorrow
- [ ] Long-press drag to reorder (later polish)
- [x] Move a task to another day or workspace

### 1.4 Screens
- [x] **Today:** tasks with `scheduled_date <= today` and not done, grouped by workspace, overdue flagged
- [x] Capacity bar per workspace ("Company A: 5 h of 4 h planned")
- [x] **Tomorrow:** tasks for tomorrow; a "Move into tomorrow" list pulls in today's leftovers and Inbox ideas with one tap
- [x] **Inbox:** tasks with no workspace (assign a workspace and day from the task page)
- [ ] Inbox swipe gestures to assign faster (later polish)
- [x] **Review:** tasks done today and this week, by workspace, with a bar chart of done tasks per day (plain views; `victory-native` needs Skia, which is extra setup on web)

### 1.5 Domain logic (pure TypeScript, unit tested)
- [x] `rollover.ts`: move unfinished past tasks to today, `carry_count + 1`; safe to run twice
- [x] Run rollover on app open and when the date changes while the app is open (Today flags moved tasks as "Carried over")
- [x] Stale task prompt when `carry_count >= 3`: do today / break down / someday / drop (Someday tasks are listed in Inbox)
- [x] `capacity.ts`: planned minutes vs budget per workspace per day
- [x] `reminderPlanner.ts` (`reminder-planner.ts`): task + policy → list of reminder rows; recalculates on done, snooze, move or time change. The `reminder` table is kept in step automatically; 1.7 turns the rows into phone alarms

### 1.6 Voice notes
- [x] Ask for microphone permission with a clear explanation screen (explanation card on the task form before the system prompt)
- [x] Hold-to-record button on the task form (max 60 s, AAC mono); a quick tap starts tap-to-stop mode
- [x] Play, re-record and delete a recording
- [x] Store the file on the device and link it in the `recording` table (browser: stored in the row until Phase 2 Storage)
- [x] Fallback: read the task title aloud with text-to-speech when there is no recording (helper ready; the ring screen in 1.7 uses it)

### 1.7 Alarms and the ring screen (EAS dev build from here on)
- [x] Alarm scheduler interface in `src/device/alarms/index.ts`: `schedule(reminder)`, `cancel(reminderId)`, `cancelAllForTask(taskId)` (in-app stand-in for Expo Go until the native module; browser never rings)
- [ ] **Android** (Kotlin Expo module `modules/call-me-alarms`; code written, waiting for the first EAS dev build test):
  - [ ] Exact alarms (alarm-clock API) for heads-up, voice alert and ring
  - [ ] Notification channel on the alarm sound stream
  - [ ] Full-screen intent that opens the ring screen over the lock screen
  - [ ] Looping ringtone until answered or timed out (60 s)
  - [ ] Re-schedule all alarms after phone restart and after app update
- [ ] **iPhone** (Swift Expo module):
  - [ ] AlarmKit alarm for the ring step on iOS 26+
  - [ ] Time-sensitive local notifications with a custom sound as fallback
  - [ ] Stay under the 64 pending local notifications limit (schedule only the next 48 hours, top up on app open)
- [x] **Ring screen** (`app/ring/[reminderId].tsx`): task title, workspace badge, due time, snooze count, plays the recording, big Done / Snooze 10 min / Move to tomorrow buttons
- [x] Snooze limit (default 3), then the Snooze button is hidden
- [x] Ignored ring is logged as `missed` in `reminder_event`
- [x] Quiet hours: ring and voice steps shift to the end of quiet hours unless the task is critical (in the reminder planner)

### 1.8 Onboarding and settings
- [ ] Onboarding: pick workspace names, set working hours, set quiet hours
- [ ] Permission walkthrough: notifications, exact alarms, full-screen alerts, battery optimization off (with phone-brand-specific tips for Samsung, Xiaomi, Oppo)
- [ ] "Test my alarm" button that rings in 10 seconds
- [ ] Reminder policy editor per workspace (ladder timings, max snoozes)

### 1.9 Backup
- [ ] Export everything to a JSON backup file (`expo-file-system` + `expo-sharing`)
- [ ] Export tasks to CSV (`papaparse`), filtered by workspace and date range
- [ ] Export a PDF of Today or a week (`expo-print`)
- [ ] Import from a JSON backup or CSV (`expo-document-picker`), with a preview before anything is written

### Tests for Phase 1
- [ ] Unit tests: rollover (including crossing midnight and running twice), capacity, reminder planner (quiet hours, snooze limit, critical)
- [ ] Maestro tests: add task → appears on Today; mark done → leaves Today; set must-do 1 minute ahead → ring screen appears
- [ ] Manual test on a real phone with the screen locked, the app swiped away, airplane mode on and silent mode on

**Done when:** you use the app for 5 working days with no paper list, every must-do alarm fires on time with
the phone locked and offline, and yesterday's unfinished tasks show up on Today each morning.

---

## Phase 2 — Cloud sync, laptop and real phone calls

**Goal:** the same tasks on your phone and laptop, and a real phone call when you ignore the ring screen.

### 2.1 Supabase backend
- [ ] Create the Supabase project and link the Supabase CLI
- [ ] Postgres migrations matching the SQLite tables, plus `user_id` and `server_updated_at` on every table
- [ ] Trigger on every table: set `server_updated_at = now()` on each write, and ignore an incoming row whose `updated_at` is older than the stored one (newest edit wins)
- [ ] Row-level security on every table: `user_id = auth.uid()`
- [ ] Private Storage bucket `recordings`, path `{user_id}/{task_id}.m4a`
- [ ] Auth with `@supabase/supabase-js`: email one-time code, Sign in with Apple, Google sign-in
- [ ] Session storage: `expo-secure-store` on the phone, local storage in the browser
- [ ] Extra tables: `device` (push token, is alarm device), `phone_number` (verified)

### 2.2 Sync engine
- [ ] Outbox table on the device; every repository write also adds an outbox row
- [ ] Push: send outbox rows with `supabase.from(table).upsert(...)`; the server trigger keeps the newest edit
- [ ] Pull: `.select().gt('server_updated_at', since)` per table, starting a few seconds before the last cursor so no row is missed, then apply the rows to SQLite
- [ ] Only the sync engine and auth call Supabase; screens and stores read SQLite only
- [ ] `@react-native-community/netinfo`: sync when the device comes back online
- [ ] Realtime subscription that triggers a pull
- [ ] Upload recordings in the background; download on other devices when needed
- [ ] First sign-in: upload the existing local data from Phase 1
- [ ] Nightly purge of rows soft-deleted more than 30 days ago
- [ ] Sync status indicator (synced / syncing / offline)

### 2.3 Browser app (full control)
- [ ] `expo-router` web build of the same screens: Today, Tomorrow, Inbox, Workspace, Plan, Review
- [ ] Check `expo-sqlite` on web works for our migrations and change listener (it needs special server headers); if it doesn't, the browser reads and writes Supabase directly through the same repository interface
- [ ] Full editing: create, edit, delete, reorder and move tasks; manage workspaces and plans
- [ ] Full settings: reminder ladder per workspace, quiet hours, snooze limit, phone number, alarm device
- [ ] Record voice notes in the browser (computer microphone), uploaded so the phone can play them
- [ ] Wider layout for big screens: all three workspaces side by side on Today
- [ ] Keyboard shortcuts: `N` new task, `T` Today, `I` Inbox, `1/2/3` switch workspace
- [ ] **Phone status** panel: "Phone synced 1 min ago · 4 alarms armed for today"
- [ ] **Test ring my phone** button
- [ ] Deploy to a static host behind the same sign-in
- [ ] The browser never rings itself; it only controls what the phone does

### 2.4 Real phone call step
- [ ] Twilio account, buy a phone number (check ID or address rules for your country)
- [ ] Verify your own number with a one-time code before calls are allowed
- [ ] `escalation-worker` Edge Function, triggered every minute by pg_cron, using `for update skip locked`
- [ ] `twilio-voice` webhook: say the task title, play the recording from a 10-minute signed link, wait for 1 / 2 / 3
- [ ] `twilio-keypress` webhook: 1 = done, 2 = snooze 15 min, 3 = move to tomorrow
- [ ] `twilio-status` webhook: log answered / busy / no-answer; retry once after 5 minutes
- [ ] Check the Twilio request signature on every webhook
- [ ] Daily cap: 10 calls per day
- [ ] Keep all Twilio keys in Edge Function secrets only

### 2.5 Browser → phone control
- [ ] Register Expo push tokens per device
- [ ] "Alarm device" setting so only one phone rings
- [ ] Any change that affects reminders (new task, new time, must-do on/off, done, snooze, move, policy change) makes the server send a silent push to the alarm device
- [ ] On that push the phone pulls changes, re-runs the reminder planner and re-schedules or cancels its local alarms
- [ ] Backup path: the phone also re-syncs on open and on background fetch, in case a push is delayed
- [ ] The phone reports back "alarms armed" with a timestamp, shown in the browser's Phone status panel
- [ ] Warning in the browser if the phone hasn't synced for more than 1 hour ("Alarms may be out of date")

### 2.6 Recurring tasks and focus
- [ ] `recurrence` table with repeat rules (daily, weekdays, weekly, monthly)
- [ ] `recurrence.ts`: create tasks 14 days ahead with id = hash(rule id + date) so devices never duplicate
- [ ] Focus mode: during a workspace's working hours, hide the other workspaces and soften their reminders
- [ ] **What now?** button: overdue must-dos → due today → priority, within the current focus workspace

### 2.7 Time tracker (only if D2 = yes)
- [ ] `time_entry` table, start/stop timer on a task, billable flag
- [ ] Hours per company per week on Review

### Tests for Phase 2
- [ ] Sync: edit the same task offline on phone and laptop, reconnect, newest edit wins, nothing lost
- [ ] Ignore a must-do: real call arrives at +20 min; pressing 1 marks the task done on both devices
- [ ] Finish a task in the browser: the phone alarm for it never rings
- [ ] Add a must-do in the browser for 5 minutes from now: the phone rings on time with the screen locked
- [ ] Change a task's time in the browser: the phone's alarm moves to the new time
- [ ] Record a voice note in the browser: the phone's ring screen plays it
- [ ] Row-level security test: a second test account sees none of your rows

**Done when:** you add a task on the laptop, it rings on your phone, you ignore it, your phone gets a real call
that plays your voice, and pressing 1 marks it done everywhere.

---

## Phase 3 — Zero-effort capture and planning help

**Goal:** adding and planning tasks takes almost no effort.

### 3.1 Voice quick add
- [ ] On-device speech-to-text (expo-speech-recognition)
- [ ] `parse-task` Edge Function: sends the transcript and your workspace names to the Claude API (`claude-haiku-5-5`) and returns title, workspace, date, time and must-do
- [ ] Confirmation card before saving ("Company A · tomorrow 10:00 · must do"), editable
- [ ] Keep the original audio as the task's voice note
- [ ] Fallback when offline: save the transcript to Inbox and parse later

### 3.2 Widgets and sharing
- [ ] Home screen widget: Today count per workspace and the next 3 tasks
- [ ] Record button widget / lock screen widget that opens straight into recording
- [ ] Share from other apps (WhatsApp, email, browser) creates an Inbox task with the text or link

### 3.3 Location reminders
- [ ] `place` table: name, latitude, longitude, radius
- [ ] Geofencing with expo-location + expo-task-manager
- [ ] "When I arrive at Company A's office": show that workspace's tasks and switch focus
- [ ] Clear explanation of background location use; easy to turn off

### 3.4 Daily briefings
- [ ] `daily-digest` Edge Function on cron
- [ ] Morning briefing push at a chosen time: tasks and planned hours per workspace
- [ ] Evening plan-tomorrow push: opens a screen with leftovers and lets you drag tasks into Tomorrow

### 3.5 Google Calendar
- [ ] Read-only Google Calendar connection
- [ ] Show today's meetings on Today and subtract their time from capacity

**Done when:** you can add a task by saying one sentence without opening the app's main screen, and most
evenings the plan-tomorrow nudge is how tomorrow gets planned.

---

## Phase 4 — Motivation and reports

**Goal:** the app helps you see patterns and stay on track.

- [ ] **Buddy text** (if D3 = yes): verify the buddy's number, opt-in per workspace, one SMS at +40 min, cap of 5 SMS per day
- [ ] **Streaks:** days in a row with all must-dos done
- [ ] **Done-for-the-day screen** when Today is empty
- [ ] **Weekly report per company:** done tasks grouped by plan, copy as text for standups or emails
- [ ] **Escalation stats:** how often each workspace needed a ring or phone call
- [ ] **Weekly automatic export** of a JSON backup to your Google Drive
- [ ] Time tracker here if it wasn't moved to Phase 2

**Done when:** every Friday you can copy a ready-made weekly report for each company in under a minute.

---

## Release and store checklist

- [ ] App icon, splash screen, store screenshots
- [ ] Privacy policy page (microphone, location, phone number, recordings)
- [ ] Google Play declarations for exact alarms and full-screen alerts (alarm-app use)
- [ ] App Store review notes explaining AlarmKit use and that phone calls are real calls via Twilio
- [ ] EAS Build for store builds, EAS Update for quick fixes
- [ ] Internal testing track (Play) / TestFlight (iOS) before any public release

---

## Definition of done (every task)

1. Works offline where the feature allows it.
2. Works in light and dark theme.
3. Unit tests for any new logic in `src/domain`.
4. Tested on a real phone, with the screen locked where alarms are involved.
5. No secrets in the app code.
6. CI is green.

---

## Risks to watch

| Risk | Mitigation | Phase |
|------|------------|-------|
| Android phone makers stop background alarms | Alarm-clock API, battery-optimization walkthrough, "Test my alarm" button | 1 |
| Store rejection for full-screen alerts or call-like UI | Alarm-app declaration on Play; AlarmKit plus real Twilio calls on iOS, no fake CallKit | 1, release |
| iPhone 64-notification limit | Schedule only the next 48 hours, top up on app open and from silent push | 1 |
| Twilio cost | Must-do only, daily caps, check current pricing before Phase 2 | 2 |
| Phone call after task was done offline | Pressing 1 closes it; worker re-checks task status just before dialing | 2 |
| Alarm fatigue | Only must-dos escalate, snooze limit, escalation stats in Review | 1, 4 |
| Native alarm code doesn't run in Expo Go | Use Expo Go until step 1.7, then switch to an EAS dev build | 1 |
| `expo-sqlite` on web needs special server headers and may behave differently | Test early in 2.3; fallback is a Supabase-backed repository for the browser | 2 |
| Rows missed by the `server_updated_at` cursor | Pull with a few seconds of overlap; applying a row twice is harmless | 2 |
| Company confidentiality | Keep company task titles generic; no client data, passwords or code | All |
