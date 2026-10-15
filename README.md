# EMBER — Personal Music Streaming Platform

React + Vite + TypeScript starter for a personal music streaming PWA.

## Current status

This is the UI foundation plus Phase 1 backend scaffolding, not yet a finished streaming service.

Included:
- Responsive desktop/mobile shell, theme toggle, search and genre filters
- Session-only mock catalogue, track selection, queue panel and player controls
- Optional Supabase client bootstrap
- Initial PostgreSQL schema with row-level security policies for user-owned library data
- JWT-protected Supabase Edge Function scaffold for Jamendo catalogue search

Not yet connected: real track results/playback, sign-in UI, persistent library flows, Audius adapter, installable PWA/offline support. The UI still displays mock tracks; the Jamendo function is not yet wired into it.

## Run locally

Requirements: Node.js 22 recommended and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` from your dedicated Supabase project. Do not put service-role keys or provider secrets in frontend variables.

## Supabase setup

1. Review and apply `supabase/migrations/20261015000100_music_library.sql` to your dedicated EMBER project.
2. Set Edge Function secrets `JAMENDO_CLIENT_ID` and `APP_ORIGIN`.
3. Deploy `music-catalog` with JWT verification enabled.
4. Build and test auth, real streaming, RLS, playlists/history and PWA support in later phases.

## Build

```bash
npm run build
```

Build verification has not yet succeeded in this environment, so run it locally before deployment.

## Security and licensing

Keep provider credentials server-side. Only expose download actions when the provider explicitly permits downloads, and preserve attribution/licence information. Respect provider terms and quotas; confirm the applicable Jamendo licence before public/commercial use.
