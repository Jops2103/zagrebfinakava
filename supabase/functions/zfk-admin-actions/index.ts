const allowedOrigin = "https://jops2103.github.io";
const adminEmail = "zagrebfinakava@proton.me";
const supabaseUrl = "https://wbupmpqymavxjxatwzsh.supabase.co";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return origin === allowedOrigin ? new Response("ok", { headers: corsHeaders }) : new Response("Forbidden origin", { status: 403 });
  if (origin !== allowedOrigin) return respond({ error: "Nedopušten izvor zahtjeva." }, 403);
  if (req.method !== "POST") return respond({ error: "Dopušten je samo POST." }, 405);
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!match) return respond({ error: "Prijava je istekla. Prijavite se ponovno." }, 401);
  const secretValue = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretValue) return respond({ error: "Nedostaje konfiguracija baze." }, 500);
  let serviceKey = secretValue;
  try { const parsed = JSON.parse(secretValue); if (typeof parsed?.default === "string") serviceKey = parsed.default; } catch { /* raw secret */ }
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${match[1]}` } });
  if (!userResponse.ok) return respond({ error: "Prijava nije valjana. Prijavite se ponovno." }, 401);
  const user = await userResponse.json();
  if (String(user.email ?? "").trim().toLowerCase() !== adminEmail) return respond({ error: "Ova e-mail adresa nema administratorski pristup." }, 403);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return respond({ error: "Neispravan zahtjev." }, 400); }
  const allowed = ["link", "create_customer", "confirm", "reject", "inventory_upsert", "inventory_rename", "reset_pending"];
  if (!allowed.includes(String(input.action))) return respond({ error: "Nepoznata administratorska radnja." }, 400);
  if (input.action === "inventory_rename") {
    const type = input.item_type;
    const oldName = typeof input.old_item_name === "string" ? input.old_item_name.trim() : "";
    const newName = typeof input.item_name === "string" ? input.item_name.trim() : "";
    if ((type !== "machine" && type !== "capsule") || !oldName || !newName) return respond({ error: "Odaberi vrstu artikla te unesi postojeći i novi naziv." }, 400);
    const renameResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/zfk_admin_inventory_rename`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_item_type: type, p_old_name: oldName, p_new_name: newName }) });
    const renamePayload = await renameResponse.json().catch(() => null);
    if (!renameResponse.ok) {
      const raw = typeof renamePayload?.message === "string" ? renamePayload.message : "";
      const safe = ["Vrsta zalihe nije valjana.", "Unesi stari i novi naziv artikla.", "Novi naziv mora biti različit od postojećeg.", "Artikl s tim nazivom već postoji. Uredi postojeću stavku umjesto stvaranja duplikata.", "Postojeća stavka zaliha nije pronađena. Osvježi popis i pokušaj ponovno."];
      return respond({ error: safe.includes(raw) ? raw : "Promjena naziva nije uspjela. Osvježi popis i pokušaj ponovno." }, 400);
    }
    return respond({ ok: true, result: renamePayload });
  }
  if (input.action === "reset_pending") {
    if (typeof input.request_id !== "string") return respond({ error: "Nedostaje identifikator upita." }, 400);
    const resetResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/zfk_admin_reset_request_pending`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_request_id: input.request_id }) });
    const resetPayload = await resetResponse.json().catch(() => null);
    if (!resetResponse.ok) {
      const raw = typeof resetPayload?.message === "string" ? resetPayload.message : "";
      return respond({ error: raw === "Upit nije pronađen." || raw === "Na čekanje se može vratiti samo potvrđeni upit." ? raw : "Vraćanje upita na čekanje nije uspjelo." }, 400);
    }
    return respond({ ok: true, result: resetPayload });
  }
  if (input.action === "inventory_upsert") {
    const type = input.item_type;
    const name = typeof input.item_name === "string" ? input.item_name.trim() : "";
    const quantity = input.quantity;
    if ((type !== "machine" && type !== "capsule") || !name || !Number.isInteger(quantity) || Number(quantity) < 0) return respond({error:"Unesi vrstu artikla, naziv i cijelu količinu koja nije negativna."},400);
    const inventoryResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/zfk_admin_inventory_upsert`, {method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({p_item_type:type,p_item_name:name,p_quantity:quantity})});
    const inventoryPayload = await inventoryResponse.json().catch(()=>null);
    if (!inventoryResponse.ok) return respond({error:"Spremanje zalihe nije uspjelo. Provjeri unesene podatke."},400);
    return respond({ok:true,result:inventoryPayload});
  }
  if (typeof input.request_id !== "string") return respond({ error: "Nedostaje identifikator upita." }, 400);
  const args = {
    p_action: input.action,
    p_request_id: input.request_id,
    p_customer_id: typeof input.customer_id === "string" ? input.customer_id : null,
    p_machine: typeof input.machine === "string" ? input.machine : null,
    p_quantity: Number.isInteger(input.quantity) ? input.quantity : null,
    p_capsules: input.capsules && typeof input.capsules === "object" ? input.capsules : null,
    p_customer_name: typeof input.customer_name === "string" ? input.customer_name : null,
    p_customer_email: typeof input.customer_email === "string" ? input.customer_email : null,
    p_note: typeof input.note === "string" ? input.note.slice(0, 1000) : null,
  };
  const result = await fetch(`${supabaseUrl}/rest/v1/rpc/zfk_admin_request_action`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const payload = await result.json().catch(() => null);
  if (!result.ok) {
    const raw = typeof payload?.message === "string" ? payload.message : "";
    const safeMessages = [
      "Upit nije pronađen.", "Odaberi postojećeg kupca.", "Kupac nije pronađen.",
      "Moguće je odbiti samo upit koji čeka potvrdu.", "Povezivanje je dopušteno samo za upit koji čeka potvrdu.",
      "Novi kupac može se evidentirati samo iz upita koji čeka potvrdu.", "Upit nema valjanu e-mail adresu.",
      "Ova e-mail adresa već je povezana s kupcem. Odaberi postojećeg kupca.",
      "Moguće je potvrditi samo upit koji čeka potvrdu.", "Prvo poveži upit s postojećim ili novim kupcem.",
      "Potrebno je potvrditi aparat.", "Unesi valjanu potvrđenu mjesečnu količinu.",
      "Odabir kapsula mora biti popis.", "Odabran je nepoznat aparat.",
      "Potvrđena količina je ispod minimalne mjesečne količine za odabrani aparat.",
      "Aparat nije označen kao raspoloživ na zalihi. Ažuriraj zalihe ili predloži zamjenu.",
      "Povezani kupac nije pronađen.", "Nepoznata administratorska radnja."
    ];
    const isCapsuleStockError = raw.startsWith("Nedostupne kapsule:") || raw.startsWith("Nema dovoljno kutija na zalihi za kapsule:");
    const isInventoryError = raw.startsWith("Aparat nije dostupan na zalihi") || raw.startsWith("Prije potvrde odredi vrste kapsula") || raw.startsWith("Raspodjela kapsula mora sadržavati") || raw.startsWith("Unesi barem jednu kutiju") || raw.startsWith("Raspodjela kutija mora odgovarati");
    return respond({ error: safeMessages.includes(raw) || isCapsuleStockError || isInventoryError ? raw : "Radnja nije uspjela. Provjeri podatke i pokušaj ponovno." }, 400);
  }
  return respond({ ok: true, result: payload });
});