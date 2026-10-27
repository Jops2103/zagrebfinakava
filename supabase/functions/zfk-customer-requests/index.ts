// Supabase Edge Function: zfk-customer-requests
// Stores submitted requests as pending. It never changes the confirmed customer record.
const allowedOrigin = "https://jops2103.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const machineMinimums: Record<string, number> = {
  "Lavazza LB 1300 Classy Soul": 200,
  "Lavazza LB2600": 300,
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin !== allowedOrigin) {
      return new Response("Forbidden origin", { status: 403 });
    }
    return new Response("ok", { headers: corsHeaders });
  }
  if (origin !== allowedOrigin) {
    return jsonResponse({ success: false, message: "Nedopušten izvor zahtjeva." }, 403);
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Dopušten je samo POST zahtjev." }, 405);
  }

  try {
    const secretValue = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!secretValue) {
      return jsonResponse({ success: false, message: "Nedostaje konfiguracija baze." }, 500);
    }

    let serviceKey = secretValue;
    try {
      const parsed = JSON.parse(secretValue);
      if (parsed && typeof parsed.default === "string") serviceKey = parsed.default;
    } catch {
      // Secret may be stored directly as a string.
    }

    const payload = await req.json();
    const requestType = payload.request_type;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const machine = typeof payload.machine === "string" ? payload.machine.trim() : "";
    const quantity = payload.quantity === null || payload.quantity === undefined || payload.quantity === ""
      ? null
      : Number(payload.quantity);
    const capsuleSelection = Array.isArray(payload.capsule_selection)
      ? payload.capsule_selection.filter((item: unknown) => typeof item === "string" && item.trim()).map((item: string) => item.trim())
      : [];
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 5000) : "";

    if (!["new", "existing"].includes(requestType)) {
      return jsonResponse({ success: false, message: "Vrsta zahtjeva nije prepoznata." }, 400);
    }
    if (!name || name.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return jsonResponse({ success: false, message: "Provjerite ime i e-mail adresu." }, 400);
    }
    if (!(machine in machineMinimums)) {
      return jsonResponse({ success: false, message: "Odabrani aparat nije prepoznat." }, 400);
    }
    if (capsuleSelection.length === 0 || capsuleSelection.length > 30) {
      return jsonResponse({ success: false, message: "Odaberite barem jednu vrstu kapsula." }, 400);
    }
    if (requestType === "new") {
      if (!Number.isInteger(quantity) || quantity! < machineMinimums[machine] || quantity! > 2000 || quantity! % 100 !== 0) {
        return jsonResponse({ success: false, message: "Količina kapsula nije valjana za odabrani aparat." }, 400);
      }
    } else if (quantity !== null) {
      if (!Number.isInteger(quantity) || quantity < machineMinimums[machine] || quantity > 2000 || quantity % 100 !== 0) {
        return jsonResponse({ success: false, message: "Nova količina kapsula nije valjana za odabrani aparat." }, 400);
      }
    }

    const supabaseUrl = "https://wbupmpqymavxjxatwzsh.supabase.co";
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/customer_requests`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        customer_name: name,
        customer_email: email,
        requested_machine: machine,
        requested_monthly_capsules: quantity,
        capsule_selection: capsuleSelection,
        customer_note: `Vrsta zahtjeva: ${requestType === "new" ? "novi korisnik" : "postojeći korisnik"}\n${note}`.trim(),
        request_status: "pending",
      }),
    });

    if (!insertResponse.ok) {
      const details = await insertResponse.text();
      console.error("customer_requests insert failed", insertResponse.status, details);
      return jsonResponse({ success: false, message: "Spremanje zahtjeva u evidenciju nije uspjelo." }, 502);
    }

    const rows = await insertResponse.json();
    return jsonResponse({
      success: true,
      request_id: Array.isArray(rows) ? rows[0]?.id ?? null : null,
      message: "Zahtjev je zaprimljen i čeka potvrdu.",
    }, 201);
  } catch (error) {
    console.error("zfk-customer-requests error", error);
    return jsonResponse({ success: false, message: "Došlo je do pogreške pri spremanju zahtjeva." }, 500);
  }
});
