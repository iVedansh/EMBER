# EMBER — Personal Music Streaming Platform

EMBER is a responsive, browser-based music streaming web app built with React, Vite, TypeScript and Supabase. It is designed as a website/PWA target, not a native Android app.

## What's implemented

- Responsive desktop and mobile music-player interface
- Dark/light theme preference and liked-track preference saved in the browser
- Supabase email/password sign-in and account creation UI
- Authenticated live catalogue search through a Supabase Edge Function
- Jamendo metadata mapping, album artwork and stream URL support
- HTML audio playback controls, seek bar, volume control, next/previous track and queue panel
- PostgreSQL schema for profiles, tracks, favourites, favourite artists, playlists and play history
- Row-level security policies for user-owned database records
- Provider API credential stays on the Edge Function side

## Current status

The app now has the first working integration path for Supabase authentication and Jamendo catalogue search. To use it against a real provider, you must configure a Supabase project, deploy the SQL migration and Edge Function, and set the required provider secret. The default screen uses clearly labelled preview tracks until a signed-in user searches the live catalogue.

**Not finished yet:** database-backed favourites and playlists, history persistence, full playlist editing, Audius adapter, richer queue/shuffle/repeat behavior, PWA install/offline support, accessibility pass, automated test coverage and production deployment. A build has not been verified in this environment; run the build steps below before deploying.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Fill in `.env.local` with the browser-safe values from your dedicated Supabase project:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Do not put a Supabase secret/service-role key or a music-provider secret in any `VITE_*` variable.

## Configure Supabase

1. Create or select a dedicated Supabase project for EMBER.
2. Review and apply `supabase/migrations/20261015000100_music_library.sql`.
3. Set the Edge Function secrets `JAMENDO_CLIENT_ID` and `APP_ORIGIN` (your exact web-app origin, such as `http://localhost:5173` during local development).
4. Deploy the `music-catalog` Edge Function with JWT verification enabled.
5. Enable the email/password auth provider in Supabase. Configure email confirmation as you prefer.
6. Test sign-up, sign-in, catalogue search and playback before deployment.

The browser sends the signed-in user's access token to the Edge Function. The Jamendo client ID remains server-side.

## Build

```bash
npm run build
npm run preview
```

## Music rights

EMBER streams from a provider rather than re-hosting tracks. Download actions should remain unavailable unless the provider explicitly permits downloads. Preserve track attribution/licence links and check the provider's current terms and licence requirements before public or commercial use.
