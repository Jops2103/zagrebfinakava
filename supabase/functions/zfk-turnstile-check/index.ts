const allowedOrigin = "https://zagrebfinakava.pages.dev";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};
Deno.serve((req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin !== allowedOrigin) return new Response("Forbidden origin", { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Nedopušten izvor zahtjeva." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
    });
  }
  return new Response(JSON.stringify({
    error: "Ova testna funkcija je trajno onesposobljena. Koristite glavni obrazac za upite."
  }), {
    status: 410, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
});
