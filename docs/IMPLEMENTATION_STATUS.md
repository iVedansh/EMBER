# EMBER implementation status

## Product direction
EMBER is a responsive web app for desktop and mobile browsers. The target is a cohesive music-streaming website, with PWA support planned after the main product flows are stable.

## Architecture
- React + Vite + TypeScript frontend.
- Supabase Auth and managed PostgreSQL for accounts and user-owned library data.
- Supabase Edge Functions as the secure server-side boundary for music providers.
- Jamendo is the first catalogue adapter; Audius is planned as a second adapter.
- Browser audio playback uses the HTML audio element and provider stream URLs.
- Redis is deferred until measured traffic justifies a separate cache.

## Implemented in the current branch
- Responsive EMBER interface and dark/light theme.
- Sign-in and account-creation form using Supabase email/password auth.
- Session detection and sign-out.
- Authenticated Jamendo search through the `music-catalog` Edge Function.
- Search results map to track title, artist, album art, duration, licence URL and stream URL.
- Browser audio playback, seek and volume controls, next/previous track controls, queue panel.
- Browser-persisted theme and liked-track preferences for the current device.
- Initial SQL schema for profiles, tracks, favourites, favourite artists, playlists, playlist tracks and play history.
- RLS policies on user-owned tables.
- Profile auto-creation trigger.

## Required setup before live testing
1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase URL and publishable key.
3. Review and apply `supabase/migrations/20261015000100_music_library.sql`.
4. Set Edge Function secrets `JAMENDO_CLIENT_ID` and `APP_ORIGIN`.
5. Deploy `music-catalog` with JWT verification enabled.
6. Enable email/password authentication in Supabase.
7. Run `npm install` and `npm run build`, then test the live app.

## Known limitations / next work
- Current favourite state is stored in browser storage, not yet synced to the Supabase favourites table.
- Playlist creation/editing and play history are not wired to the database yet.
- Provider search currently starts after entering at least two characters.
- Demo catalogue tracks are UI previews and have no audio stream.
- Track availability and playback depend on the provider response and the track's permitted stream URL.
- Audius integration, PWA install/offline support, richer queue behavior, tests and deployment are still upcoming.
- Build status has not been verified in this environment.
- No SQL has been applied to a live Supabase project by this repository update.

## Security and licensing
- Keep provider credentials in Edge Function secrets.
- Never expose a Supabase secret/service-role key in a frontend environment variable.
- Keep JWT verification enabled for the catalogue function.
- Preserve provider attribution/licence information and expose downloads only when explicitly permitted.
