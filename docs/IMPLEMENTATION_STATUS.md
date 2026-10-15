# EMBER implementation status

## Chosen architecture
- React + Vite + TypeScript frontend / installable PWA target.
- Supabase Auth and managed PostgreSQL for profiles and user-owned library data.
- Supabase Edge Functions as the secure server-side boundary for music providers.
- Jamendo as the first provider, Audius as the second adapter.
- Browser streams directly from provider URLs; the server does not re-host copyrighted audio.
- Redis is deferred until measured catalogue traffic justifies a separate cache.

## Delivered in this increment
- Supabase client bootstrap, optional until environment values are configured.
- Browser-safe `.env.example` using the publishable key only.
- Initial SQL schema for profiles, catalogue metadata, favourites, favourite artists, playlists, playlist tracks, and play history.
- RLS enabled and ownership policies included for user-owned tables.
- Profile auto-creation trigger.
- JWT-protected `music-catalog` Edge Function scaffold that keeps the Jamendo client ID server-side.
- Current UI remains usable in preview mode without credentials.

## Configure locally
1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key from the Supabase Connect dialog.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Configure Supabase
1. Review and apply `supabase/migrations/20261015000100_music_library.sql` to a dedicated EMBER project.
2. Set Edge Function secrets: `JAMENDO_CLIENT_ID` and `APP_ORIGIN`.
3. Deploy `music-catalog` with JWT verification enabled.
4. Add sign-in UI and use the current Supabase session when invoking the function.
5. Test RLS using two separate user accounts before production use.

## Important limitations
- This increment does not connect to any existing Supabase project or apply SQL to a live database.
- The current visual track list is still mock data; the Edge Function is not wired into the UI.
- Authentication UI, real streaming/player state, provider adapter tests, Audius adapter, Redis, PWA offline support, and full history/playlist flows remain upcoming.
- Never put a Supabase secret/service-role key or music-provider secret in a `VITE_*` variable.
- Only expose downloads when the source explicitly allows it; preserve attribution and licence information.
