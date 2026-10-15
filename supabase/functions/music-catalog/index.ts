// Secure provider proxy for EMBER. Deploy with JWT verification enabled.
// Jamendo credentials and catalogue writes stay on the server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return respond({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: "Catalogue service is not configured." }, 503);
  }

  // Verify the calling user's identity before allowing catalogue requests.
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Please sign in to search the catalogue." }, 401);

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const sourceTrackId = (url.searchParams.get("id") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(100, Number(url.searchParams.get("page") ?? "1") || 1));
  if (!sourceTrackId && query.length < 2) return respond({ tracks: [], page, source: "jamendo" });

  const clientId = Deno.env.get("JAMENDO_CLIENT_ID");
  if (!clientId) return respond({ error: "Music catalogue is not configured yet." }, 503);

  const providerUrl = new URL("https://api.jamendo.com/v3.0/tracks/");
  providerUrl.search = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "20",
    offset: String((page - 1) * 20),
    ...(sourceTrackId ? { id: sourceTrackId } : { namesearch: query }),
    audioformat: "mp32",
    include: "licenses,musicinfo",
  }).toString();

  try {
    const providerResponse = await fetch(providerUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!providerResponse.ok) return respond({ error: "Music provider temporarily unavailable." }, 502);

    const payload = await providerResponse.json();
    const tracks = (payload.results ?? []).map((t: Record<string, unknown>) => {
      const allowed = t.audiodownload_allowed === true || t.audiodownload_allowed === "true";
      const musicInfo = t.musicinfo as Record<string, unknown> | undefined;
      const tagInfo = musicInfo?.tags as Record<string, unknown> | undefined;
      const genres = Array.isArray(tagInfo?.genres) ? tagInfo.genres.map(String).slice(0, 8) : [];
      return {
        source: "jamendo",
        sourceTrackId: String(t.id ?? ""),
        title: String(t.name ?? "Untitled"),
        artistId: String(t.artist_id ?? ""),
        artistName: String(t.artist_name ?? "Unknown artist"),
        album: String(t.album_name ?? ""),
        coverUrl: String(t.album_image ?? t.image ?? ""),
        audioUrl: String(t.audio ?? ""),
        durationSeconds: Number(t.duration ?? 0),
        genreTags: genres,
        licenceUrl: String(t.license_ccurl ?? ""),
        downloadAllowed: allowed,
      };
    }).filter((track: { sourceTrackId: string }) => track.sourceTrackId.length > 0);

    // Persist safe catalogue metadata so authenticated users can save favourites.
    // The provider's stream URL is deliberately not stored in the public catalogue table.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rows = tracks.map((track: Record<string, unknown>) => ({
      source: "jamendo",
      source_track_id: String(track.sourceTrackId),
      title: String(track.title),
      artist_id: String(track.artistId),
      artist_name: String(track.artistName),
      album: String(track.album),
      cover_url: String(track.coverUrl),
      duration_seconds: Number(track.durationSeconds),
      genre_tags: Array.isArray(track.genreTags) ? track.genreTags : [],
      licence_url: String(track.licenceUrl),
      download_allowed: track.downloadAllowed === true,
    }));

    let databaseIds = new Map<string, string>();
    if (rows.length > 0) {
      const { data: stored, error: storeError } = await admin
        .from("tracks")
        .upsert(rows, { onConflict: "source,source_track_id" })
        .select("id,source_track_id");
      if (storeError) return respond({ error: "Could not save catalogue metadata." }, 502);
      databaseIds = new Map((stored ?? []).map((row: { id: string; source_track_id: string }) => [row.source_track_id, row.id]));
    }

    const resultTracks = tracks.map((track: Record<string, unknown>) => ({
      ...track,
      databaseId: databaseIds.get(String(track.sourceTrackId)) ?? null,
    }));
    return respond({ tracks: resultTracks, page, source: "jamendo" });
  } catch {
    return respond({ error: "Could not reach the music provider. Try again shortly." }, 502);
  }
});
