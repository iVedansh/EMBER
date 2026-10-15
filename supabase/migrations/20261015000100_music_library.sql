-- EMBER personal music library
-- Run with Supabase CLI migrations or review/apply in the Supabase SQL Editor.
-- Every user-owned table uses RLS and ownership checks.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  theme text not null default 'system' check (theme in ('system', 'dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('jamendo', 'audius')),
  source_track_id text not null,
  title text not null,
  artist_id text,
  artist_name text not null,
  album text,
  cover_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  genre_tags text[] not null default '{}',
  licence_url text,
  download_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source, source_track_id)
);

create table if not exists public.favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.favourite_artists (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('jamendo', 'audius')),
  source_artist_id text not null,
  artist_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source, source_artist_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  cover_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null check (position >= 0),
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id),
  unique (playlist_id, position)
);

create table if not exists public.play_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  played_at timestamptz not null default now(),
  listened_seconds integer not null default 0 check (listened_seconds >= 0)
);

create index if not exists play_history_user_played_at_idx
  on public.play_history (user_id, played_at desc);
create index if not exists play_history_user_track_idx
  on public.play_history (user_id, track_id);

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.favourites enable row level security;
alter table public.favourite_artists enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.play_history enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "tracks_read_catalogue" on public.tracks
  for select to anon, authenticated using (true);

create policy "favourites_read_own" on public.favourites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favourites_insert_own" on public.favourites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favourites_delete_own" on public.favourites
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "favourite_artists_read_own" on public.favourite_artists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favourite_artists_insert_own" on public.favourite_artists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favourite_artists_delete_own" on public.favourite_artists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "playlists_read_own_or_public" on public.playlists
  for select to anon, authenticated
  using (is_public or (select auth.uid()) = user_id);
create policy "playlists_insert_own" on public.playlists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "playlists_update_own" on public.playlists
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "playlists_delete_own" on public.playlists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "playlist_tracks_read_visible_playlist" on public.playlist_tracks
  for select to anon, authenticated using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and (p.is_public or p.user_id = (select auth.uid()))
    )
  );
create policy "playlist_tracks_insert_owned_playlist" on public.playlist_tracks
  for insert to authenticated with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  );
create policy "playlist_tracks_update_owned_playlist" on public.playlist_tracks
  for update to authenticated using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  );
create policy "playlist_tracks_delete_owned_playlist" on public.playlist_tracks
  for delete to authenticated using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  );

create policy "play_history_read_own" on public.play_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "play_history_insert_own" on public.play_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "play_history_delete_own" on public.play_history
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant select on public.tracks to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.favourites to authenticated;
grant select, insert, delete on public.favourite_artists to authenticated;
grant select, insert, update, delete on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;
grant select, insert, delete on public.play_history to authenticated;
