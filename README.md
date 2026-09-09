# TODO MACHINE — 90s Retro Personal To-Do App

A framework-free personal to-do app using HTML5, CSS3, vanilla JavaScript, Supabase PostgreSQL, Supabase Realtime, and server-side Web Push reminders.

## What changed: real background notifications

The app now has a real server-side reminder pipeline:

```text
Task saved in Supabase
      ↓
notification_at stored as UTC
      ↓
Supabase Cron runs every minute
      ↓
Edge Function finds due tasks
      ↓
Web Push + VAPID
      ↓
Browser Push Service
      ↓
Service Worker wakes up
      ↓
🔔 OS notification
```

This means a reminder can arrive even when the TODO MACHINE tab is closed. The browser/OS still needs to permit background notifications; the device itself must be online.

## 1. Frontend setup

1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Put your Supabase URL and publishable key in `js/config.js`.
3. Generate VAPID keys (next section).
4. Put the VAPID public key in `js/config.js`.
5. Serve the app through HTTPS or `localhost` (for example VS Code Live Server).
6. Click **ENABLE PUSH REMINDERS** and allow notifications.

## 2. Generate VAPID keys

VAPID identifies your application server to browser push services. The public key belongs in the browser; the private key must stay server-side.

From the project folder:

```bash
npm install
npm run generate:vapid
```

You will get:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Put only the public key into `js/config.js`:

```js
window.TODO_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-SUPABASE-PUBLISHABLE-KEY",
  vapidPublicKey: "YOUR-VAPID-PUBLIC-KEY"
};
```

## 3. Deploy the Edge Function

Install/login to the Supabase CLI, then from this project:

```bash
supabase login
supabase link --project-ref wlxljlflbgxmolxmdzbp
supabase functions deploy send-task-reminders
```

The function uses the server-side Supabase secret key automatically and must never expose that key to the browser.

## 4. Set Edge Function secrets

Create a long random secret for the Cron caller. Then set these secrets:

```bash
supabase secrets set \
  TODO_CRON_SECRET="YOUR_LONG_RANDOM_CRON_SECRET" \
  VAPID_PUBLIC_KEY="YOUR_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="YOUR_VAPID_PRIVATE_KEY" \
  VAPID_SUBJECT="mailto:YOUR-EMAIL@example.com"
```

Do NOT put `VAPID_PRIVATE_KEY` or a Supabase secret key in `js/config.js`.

## 5. Schedule the reminder worker

Open `supabase/push-cron.sql`.

Before running it, replace:

- `YOUR_SUPABASE_PUBLISHABLE_KEY`
- `GENERATE_A_LONG_RANDOM_SECRET`

with your actual values.

Then run the whole file in Supabase SQL Editor.

It stores the values in Supabase Vault and schedules the Edge Function every minute using `pg_cron` + `pg_net`. Supabase documents this exact cron-to-Edge-Function pattern. 

## 6. Existing tasks

Tasks created before this push upgrade may have a null `notification_at`. Open and save those tasks once so the browser can calculate their UTC reminder timestamp. New tasks calculate it automatically.

## 7. Test

Create a task for a few minutes in the future and set:

- ENABLE REMINDER: checked
- reminder: AT TASK TIME or 5 MINUTES BEFORE

Click **ENABLE PUSH REMINDERS** once on the device.

Then close the TODO MACHINE tab. Keep the device online. When the scheduled time arrives, the service worker should display the OS notification.

## Important limitations

- The browser/device must support Web Push and allow notifications.
- HTTPS is required in production; `localhost` is valid for development.
- iOS/iPadOS requires the web app to be installed to the Home Screen for Web Push.
- The current database policies are intentionally permissive for this single-user prototype. For a public/multi-user app, add Supabase Auth, `user_id`, and user-specific RLS so one user's tasks/subscriptions cannot be seen or notified to another user.

## Files added for background push

```text
supabase/
├── config.toml
├── schema.sql
├── push-cron.sql
└── functions/
    └── send-task-reminders/
        └── index.ts

scripts/
└── generate-vapid-keys.mjs

package.json
```

## Existing frontend features

- HTML5/CSS3/vanilla JavaScript
- Supabase PostgreSQL persistence
- Supabase Realtime refresh
- task CRUD
- priorities/categories/search/filtering
- dashboard/calendar
- local in-app/browser reminder fallback
- PWA service worker
- server-side Web Push reminders
- responsive retro desktop/PDA interface
