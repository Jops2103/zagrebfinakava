const allowedOrigin = "https://zagrebfinakava.pages.dev";
const adminEmail = "zagrebfinakava@proton.me";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return origin === allowedOrigin ? new Response("ok", { headers: corsHeaders }) : new Response("Forbidden origin", { status: 403 });
  if (origin !== allowedOrigin) return respond({ error: "Nedopušten izvor zahtjeva." }, 403);
  if (req.method !== "GET") return respond({ error: "Dopušten je samo GET." }, 405);
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return respond({ error: "Prijava je istekla. Prijavite se ponovno." }, 401);
  const secretValue = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretValue) return respond({ error: "Nedostaje konfiguracija baze." }, 500);
  let serviceKey = secretValue;
  try { const parsed = JSON.parse(secretValue); if (typeof parsed?.default === "string") serviceKey = parsed.default; } catch { /* raw secret */ }
  const supabaseUrl = "https://wbupmpqymavxjxatwzsh.supabase.co";
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${match[1]}` } });
  if (!userResponse.ok) return respond({ error: "Prijava nije valjana. Prijavite se ponovno." }, 401);
  const user = await userResponse.json();
  if (String(user.email ?? "").trim().toLowerCase() !== adminEmail) return respond({ error: "Ova e-mail adresa nema administratorski pristup." }, 403);
  async function readTable(path: string) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!response.ok) throw new Error(`Čitanje evidencije nije uspjelo (${response.status}).`);
    return await response.json();
  }
  try {
    const [customers, requests, aliases, changes, quantities, inventory] = await Promise.all([
      readTable("customers?select=id,email,full_name,current_machine,confirmed_monthly_capsules,confirmed_capsule_selection,created_at,updated_at&is_test=eq.false&order=full_name.asc"),
      readTable("customer_requests?select=id,customer_id,requested_machine,requested_monthly_capsules,capsule_selection,request_status,customer_note,created_at,confirmed_at,customer_name,customer_email&is_test=eq.false&order=created_at.desc"),
      readTable("customer_emails?select=id,customer_id,email_normalized,added_at&is_test=eq.false&order=added_at.desc"),
      readTable("customer_change_history?select=id,customer_id,request_id,changed_at,previous_machine,new_machine,previous_quantity,new_quantity,previous_capsule_selection,new_capsule_selection,change_type,note&is_test=eq.false&order=changed_at.desc"),
      readTable("quantity_history?select=id,customer_id,request_id,previous_quantity,new_quantity,changed_at,note&is_test=eq.false&order=changed_at.desc"),
      readTable("zfk_inventory?select=id,item_type,item_name,quantity,updated_at&order=item_type.asc,item_name.asc"),
    ]);
    return respond({ customers, requests, aliases, changes, quantities, inventory });
  } catch (error) { console.error("zfk-admin error", error); return respond({ error: "Nije moguće učitati administratorsku evidenciju." }, 502); }
});