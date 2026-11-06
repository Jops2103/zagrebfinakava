// Supabase Edge Function: zfk-customer-requests
// Stores submitted requests as pending. It never changes the confirmed customer record.
const allowedOrigins = new Set([
    "https://zagrebfinakava.pages.dev",
]);
function corsHeadersFor(origin: string | null) {
  return {
    ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const machineMinimums: Record<string, number> = {
  "Lavazza LB 1300 Classy Soul": 200,
  "Lavazza LB 1300C Soul": 200,
  "Lavazza LB2600": 400,
  "Lavazza LB 2600 Magystra": 400,
};

function jsonResponse(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin ?? "")) {
      return new Response("Forbidden origin", { status: 403 });
    }
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  if (!allowedOrigins.has(origin ?? "")) {
    return jsonResponse({ success: false, message: "Nedopušten izvor zahtjeva." }, 403, origin);
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Dopušten je samo POST zahtjev." }, 405, origin);
  }

  try {
    const secretValue = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!secretValue) {
      return jsonResponse({ success: false, message: "Nedostaje konfiguracija baze." }, 500, origin);
    }

    let serviceKey = secretValue;
    try {
      const parsed = JSON.parse(secretValue);
      if (parsed && typeof parsed.default === "string") serviceKey = parsed.default;
    } catch {
      // Secret may be stored directly as a string.
    }

    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 20000) {
      return jsonResponse({ success: false, message: "Zahtjev je prevelik." }, 413, origin);
    }
    const rawBody = await req.text();
    if (rawBody.length > 20000) {
      return jsonResponse({ success: false, message: "Zahtjev je prevelik." }, 413, origin);
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid payload");
    } catch {
      return jsonResponse({ success: false, message: "Neispravan sadržaj zahtjeva." }, 400, origin);
    }
    const turnstileToken = typeof payload.turnstile_token === "string" ? payload.turnstile_token : "";
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileToken || !turnstileSecret) {
      return jsonResponse({ success: false, message: "Molimo dovršite sigurnosnu provjeru prije slanja." }, 400, origin);
    }
    const verificationResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: turnstileSecret,
        response: turnstileToken,
        remoteip: req.headers.get("CF-Connecting-IP") ?? undefined,
      }),
    });
    const verification = await verificationResponse.json();
    if (!verificationResponse.ok || verification.success !== true || verification.hostname !== new URL(origin!).hostname) {
      return jsonResponse({ success: false, message: "Sigurnosna provjera nije potvrđena. Osvježite provjeru i pokušajte ponovno." }, 403, origin);
    }

    // Test-only mode: verifies the real production Turnstile path, then exits before any database write.
    if (payload.test_only === true) {
      return jsonResponse({
        success: true,
        test_mode: true,
        message: "Cloudflare Turnstile potvrđen je u produkcijskoj funkciji. Narudžba nije spremljena i e-mail nije poslan.",
      }, 200, origin);
    }

    const requestType = payload.request_type;
    const requestTopic = typeof payload.request_topic === "string" ? payload.request_topic.trim() : "";
    const isExisting = requestType === "existing";
    const isApplianceOrder = isExisting || requestTopic === "Želim aparat uz mjesečnu kupnju kapsula";
    const isCapsuleOrder = !isExisting && requestTopic === "Želim naručiti kapsule";
    const isGeneralInquiry = !isExisting && requestTopic === "Imam pitanje o ponudi";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const machine = typeof payload.machine === "string" ? payload.machine.trim() : "";
    const quantity = payload.quantity === null || payload.quantity === undefined || payload.quantity === ""
      ? null
      : Number(payload.quantity);
    const capsuleSelection = Array.isArray(payload.capsule_selection)
      ? payload.capsule_selection.flatMap((item: unknown) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 100)] : [])
      : [];
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 5000) : "";

    if (payload.honeypot === true) {
      return jsonResponse({ success: false, message: "Neispravan zahtjev." }, 400, origin);
    }
    if (!["new", "existing"].includes(requestType)) {
      return jsonResponse({ success: false, message: "Vrsta zahtjeva nije prepoznata." }, 400, origin);
    }
    if (!name || name.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return jsonResponse({ success: false, message: "Provjerite ime i e-mail adresu." }, 400, origin);
    }
    if (requestType === "new" && ![ "Želim aparat uz mjesečnu kupnju kapsula", "Želim naručiti kapsule", "Imam pitanje o ponudi" ].includes(requestTopic)) {
      return jsonResponse({ success: false, message: "Odaberite vrstu upita." }, 400, origin);
    }
    if (isApplianceOrder && !(machine in machineMinimums)) {
      return jsonResponse({ success: false, message: "Odabrani aparat nije prepoznat." }, 400, origin);
    }
    if (isApplianceOrder && (capsuleSelection.length === 0 || capsuleSelection.length > 30)) {
      return jsonResponse({ success: false, message: "Odaberite barem jednu vrstu kapsula." }, 400, origin);
    }
    if (isCapsuleOrder && (capsuleSelection.length === 0 || capsuleSelection.length > 30)) {
      return jsonResponse({ success: false, message: "Odaberite barem jednu vrstu kapsula." }, 400, origin);
    }
    if (isGeneralInquiry && capsuleSelection.length > 30) {
      return jsonResponse({ success: false, message: "Odabir kapsula nije valjan." }, 400, origin);
    }
    if (isApplianceOrder) {
      const minimum = machineMinimums[machine];
      if (requestType === "new" && (!Number.isInteger(quantity) || quantity! < minimum || quantity! > 2000 || quantity! % 100 !== 0)) {
        return jsonResponse({ success: false, message: "Količina kapsula nije valjana za odabrani aparat." }, 400, origin);
      }
      if (requestType === "existing" && quantity !== null &&
          (!Number.isInteger(quantity) || quantity < minimum || quantity > 2000 || quantity % 100 !== 0)) {
        return jsonResponse({ success: false, message: "Nova količina kapsula nije valjana za odabrani aparat." }, 400, origin);
      }
    } else if (isCapsuleOrder) {
      if (!Number.isInteger(quantity) || quantity! < 100 || quantity! > 2000 || quantity! % 100 !== 0) {
        return jsonResponse({ success: false, message: "Količina kapsula nije valjana." }, 400, origin);
      }
    } else if (isGeneralInquiry && quantity !== 0) {
      return jsonResponse({ success: false, message: "Opći upit ne smije sadržavati količinu kapsula." }, 400, origin);
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
        customer_note: `Vrsta zahtjeva: ${requestType === "new" ? "novi korisnik" : "postojeći korisnik"}${requestType === "new" ? `\nVrsta upita: ${requestTopic}` : ""}\n${note}`.trim(),
        request_status: "pending",
      }),
    });

    if (!insertResponse.ok) {
      const details = await insertResponse.text();
      console.error("customer_requests insert failed", insertResponse.status, details);
      return jsonResponse({ success: false, message: "Spremanje zahtjeva u evidenciju nije uspjelo." }, 502, origin);
    }

    const rows = await insertResponse.json();
    return jsonResponse({
      success: true,
      request_id: Array.isArray(rows) ? rows[0]?.id ?? null : null,
      message: "Zahtjev je zaprimljen i čeka potvrdu.",
    }, 201, origin);
  } catch (error) {
    console.error("zfk-customer-requests error", error);
    return jsonResponse({ success: false, message: "Došlo je do pogreške pri spremanju zahtjeva." }, 500, origin);
  }
});