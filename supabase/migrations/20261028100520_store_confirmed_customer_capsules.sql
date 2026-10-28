-- Zagreb Fina Kava: confirmed request -> customer synchronization.
-- Safe to re-run: schema/column/index/constraint and trigger creation are guarded.
CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS confirmed_capsule_selection jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_confirmed_capsule_selection_array'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_confirmed_capsule_selection_array
      CHECK (jsonb_typeof(confirmed_capsule_selection) = 'array');
  END IF;
END;
$block$;

CREATE INDEX IF NOT EXISTS customer_requests_customer_id_idx
  ON public.customer_requests (customer_id);
CREATE INDEX IF NOT EXISTS quantity_history_customer_id_idx
  ON public.quantity_history (customer_id);
CREATE INDEX IF NOT EXISTS quantity_history_request_id_idx
  ON public.quantity_history (request_id);

CREATE OR REPLACE FUNCTION private.sync_customer_request_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_is_existing boolean;
  v_is_appliance_request boolean;
  v_topic text;
  v_desired_machine_note text;
  v_customer_id uuid;
  v_previous_quantity integer;
  v_current_machine text;
  v_current_quantity integer;
  v_target_machine text;
  v_target_quantity integer;
  v_target_capsules jsonb;
BEGIN
  IF NEW.request_status IS DISTINCT FROM 'confirmed'
     OR OLD.request_status IS NOT DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  NEW.confirmed_at := COALESCE(NEW.confirmed_at, pg_catalog.now());

  v_is_existing := COALESCE(NEW.customer_note LIKE 'Vrsta zahtjeva: postojeći korisnik%', false);
  v_topic := pg_catalog.split_part(pg_catalog.split_part(COALESCE(NEW.customer_note, ''), 'Vrsta upita: ', 2), pg_catalog.chr(10), 1);
  v_desired_machine_note := pg_catalog.split_part(pg_catalog.split_part(COALESCE(NEW.customer_note, ''), 'Željeni aparat: ', 2), pg_catalog.chr(10), 1);

  v_is_appliance_request := v_is_existing
    OR (COALESCE(NEW.customer_note LIKE 'Vrsta zahtjeva: novi korisnik%', false)
        AND v_topic = 'Želim aparat uz mjesečnu kupnju kapsula');

  -- Capsule-only orders and general enquiries do not change recurring customer records.
  IF NOT v_is_appliance_request THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_email IS NULL OR pg_catalog.btrim(NEW.customer_email) = '' THEN
    RAISE EXCEPTION 'Za potvrdu zahtjeva za aparat potrebna je e-mail adresa kupca.';
  END IF;

  v_target_machine := NULLIF(pg_catalog.btrim(NEW.requested_machine), '');
  v_target_quantity := NEW.requested_monthly_capsules;
  v_target_capsules := CASE
    WHEN pg_catalog.jsonb_typeof(NEW.capsule_selection) = 'array' THEN NEW.capsule_selection
    ELSE '[]'::jsonb
  END;

  IF v_is_existing AND v_desired_machine_note = 'Bez promjene aparata' THEN
    v_target_machine := NULL;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT c.id, c.current_machine, c.confirmed_monthly_capsules
      INTO v_customer_id, v_current_machine, v_current_quantity
      FROM public.customers AS c
     WHERE c.id = NEW.customer_id
     FOR UPDATE;
  END IF;

  IF v_customer_id IS NULL THEN
    SELECT c.id, c.current_machine, c.confirmed_monthly_capsules
      INTO v_customer_id, v_current_machine, v_current_quantity
      FROM public.customers AS c
     WHERE pg_catalog.lower(c.email) = pg_catalog.lower(pg_catalog.btrim(NEW.customer_email))
     ORDER BY c.created_at
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF v_customer_id IS NULL THEN
    -- If an existing customer has no profile row yet, requested_machine contains
    -- their current machine when "Bez promjene aparata" was chosen.
    v_target_machine := COALESCE(v_target_machine, NULLIF(pg_catalog.btrim(NEW.requested_machine), ''));
    INSERT INTO public.customers
      (email, full_name, current_machine, confirmed_monthly_capsules, confirmed_capsule_selection)
    VALUES
      (
        pg_catalog.lower(pg_catalog.btrim(NEW.customer_email)),
        NULLIF(pg_catalog.btrim(NEW.customer_name), ''),
        v_target_machine,
        v_target_quantity,
        v_target_capsules
      )
    RETURNING id, current_machine, confirmed_monthly_capsules
      INTO v_customer_id, v_current_machine, v_current_quantity;

    NEW.customer_id := v_customer_id;

    IF v_target_quantity IS NOT NULL THEN
      INSERT INTO public.quantity_history
        (customer_id, request_id, previous_quantity, new_quantity, note)
      VALUES
        (v_customer_id, NEW.id, NULL, v_target_quantity, 'Početna potvrđena mjesečna količina iz zahtjeva.');
    END IF;

    RETURN NEW;
  END IF;

  v_previous_quantity := v_current_quantity;

  UPDATE public.customers AS c
     SET full_name = COALESCE(NULLIF(pg_catalog.btrim(NEW.customer_name), ''), c.full_name),
         current_machine = COALESCE(v_target_machine, c.current_machine),
         confirmed_monthly_capsules = COALESCE(v_target_quantity, c.confirmed_monthly_capsules),
         confirmed_capsule_selection = v_target_capsules,
         updated_at = pg_catalog.now()
   WHERE c.id = v_customer_id;

  NEW.customer_id := v_customer_id;

  IF v_target_quantity IS NOT NULL
     AND v_target_quantity IS DISTINCT FROM v_previous_quantity THEN
    INSERT INTO public.quantity_history
      (customer_id, request_id, previous_quantity, new_quantity, note)
    VALUES
      (
        v_customer_id,
        NEW.id,
        v_previous_quantity,
        v_target_quantity,
        CASE
          WHEN v_previous_quantity IS NULL THEN 'Početna potvrđena mjesečna količina iz zahtjeva.'
          ELSE 'Promjena mjesečne količine nakon potvrde zahtjeva.'
        END
      );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_customer_request_on_confirmation() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_customer_request_on_confirmation() FROM anon, authenticated;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_customer_request_on_confirmation'
      AND tgrelid = 'public.customer_requests'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER sync_customer_request_on_confirmation
    BEFORE UPDATE OF request_status ON public.customer_requests
    FOR EACH ROW
    WHEN (NEW.request_status = 'confirmed' AND OLD.request_status IS DISTINCT FROM NEW.request_status)
    EXECUTE FUNCTION private.sync_customer_request_on_confirmation();
  END IF;
END;
$block$;

-- The RLS auto-enable helper is a DDL event-trigger function, not an API endpoint.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
