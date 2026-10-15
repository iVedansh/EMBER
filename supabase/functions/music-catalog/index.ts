// Secure provider proxy for EMBER. Deploy with JWT verification enabled.
// Set JAMENDO_CLIENT_ID as a Supabase Edge Function secret.
// No provider credentials are sent to the browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const page = Math.max(1, Math.min(100, Number(url.searchParams.get("page") ?? "1") || 1));
  if (query.length < 2) return respond({ tracks: [], page, source: "jamendo" });

  const clientId = Deno.env.get("JAMENDO_CLIENT_ID");
  if (!clientId) return respond({ error: "Music catalogue is not configured yet." }, 503);

  const providerUrl = new URL("https://api.jamendo.com/v3.0/tracks/");
  providerUrl.search = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "20",
    offset: String((page - 1) * 20),
    namesearch: query,
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
    });

    return respond({ tracks, page, source: "jamendo" });
  } catch {
    return respond({ error: "Could not reach the music provider. Try again shortly." }, 502);
  }
});
