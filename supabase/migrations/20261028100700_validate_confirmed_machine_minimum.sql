-- Validate the chosen machine's minimum monthly capsule quantity on confirmation.
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
  v_effective_machine text;
  v_effective_quantity integer;
  v_minimum_quantity integer;
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
    v_target_machine := COALESCE(v_target_machine, NULLIF(pg_catalog.btrim(NEW.requested_machine), ''));
    v_effective_machine := v_target_machine;
    v_effective_quantity := v_target_quantity;
  ELSE
    v_effective_machine := COALESCE(v_target_machine, v_current_machine);
    v_effective_quantity := COALESCE(v_target_quantity, v_current_quantity);
  END IF;

  v_minimum_quantity := CASE v_effective_machine
    WHEN 'Lavazza LB 1300 Classy Soul' THEN 200
    WHEN 'Lavazza LB2600' THEN 300
    ELSE NULL
  END;

  IF v_minimum_quantity IS NULL THEN
    RAISE EXCEPTION 'Aparat nije prepoznat za potvrdu: %', COALESCE(v_effective_machine, '(prazno)');
  END IF;

  IF v_effective_quantity IS NULL OR v_effective_quantity < v_minimum_quantity THEN
    RAISE EXCEPTION 'Za potvrdu zahtjeva aparat % zahtijeva najmanje % kapsula mjesečno. Odaberite odgovarajuću količinu prije potvrde.',
      v_effective_machine, v_minimum_quantity;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers
      (email, full_name, current_machine, confirmed_monthly_capsules, confirmed_capsule_selection)
    VALUES
      (
        pg_catalog.lower(pg_catalog.btrim(NEW.customer_email)),
        NULLIF(pg_catalog.btrim(NEW.customer_name), ''),
        v_effective_machine,
        v_effective_quantity,
        v_target_capsules
      )
    RETURNING id, current_machine, confirmed_monthly_capsules
      INTO v_customer_id, v_current_machine, v_current_quantity;

    NEW.customer_id := v_customer_id;

    INSERT INTO public.quantity_history
      (customer_id, request_id, previous_quantity, new_quantity, note)
    VALUES
      (v_customer_id, NEW.id, NULL, v_effective_quantity, 'Početna potvrđena mjesečna količina iz zahtjeva.');
    RETURN NEW;
  END IF;

  v_previous_quantity := v_current_quantity;

  UPDATE public.customers AS c
     SET full_name = COALESCE(NULLIF(pg_catalog.btrim(NEW.customer_name), ''), c.full_name),
         current_machine = v_effective_machine,
         confirmed_monthly_capsules = v_effective_quantity,
         confirmed_capsule_selection = v_target_capsules,
         updated_at = pg_catalog.now()
   WHERE c.id = v_customer_id;

  NEW.customer_id := v_customer_id;

  IF v_effective_quantity IS DISTINCT FROM v_previous_quantity THEN
    INSERT INTO public.quantity_history
      (customer_id, request_id, previous_quantity, new_quantity, note)
    VALUES
      (
        v_customer_id,
        NEW.id,
        v_previous_quantity,
        v_effective_quantity,
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
