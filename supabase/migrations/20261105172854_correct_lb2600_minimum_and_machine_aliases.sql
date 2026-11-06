-- Source recovery for the already-applied production migration 20261105172854.

-- Reconstructed from the live production function definitions on 2026-11-06.

-- The database already records this migration version; this file restores the missing

-- version-controlled SQL source and is not intended to be re-applied to that database.



CREATE OR REPLACE FUNCTION private.sync_customer_request_on_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
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
  v_current_capsules jsonb;
  v_target_machine text;
  v_target_quantity integer;
  v_target_capsules jsonb;
  v_effective_machine text;
  v_effective_quantity integer;
  v_minimum_quantity integer;
  v_name_match uuid;
  v_match_count integer;
  v_email text;
  v_name text;
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
  IF NOT v_is_appliance_request THEN RETURN NEW; END IF;
  IF NEW.customer_email IS NULL OR pg_catalog.btrim(NEW.customer_email) = '' THEN
    RAISE EXCEPTION 'Za potvrdu zahtjeva za aparat potrebna je e-mail adresa kupca.';
  END IF;

  v_email := pg_catalog.lower(pg_catalog.btrim(NEW.customer_email));
  v_name := NULLIF(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(COALESCE(NEW.customer_name,'')), '\s+', ' ', 'g')), '');
  v_target_machine := NULLIF(pg_catalog.btrim(NEW.requested_machine), '');
  v_target_quantity := NEW.requested_monthly_capsules;
  v_target_capsules := CASE WHEN pg_catalog.jsonb_typeof(NEW.capsule_selection) = 'array' THEN NEW.capsule_selection ELSE '[]'::jsonb END;
  IF v_is_existing AND v_desired_machine_note = 'Bez promjene aparata' THEN v_target_machine := NULL; END IF;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT c.id,c.current_machine,c.confirmed_monthly_capsules,c.confirmed_capsule_selection
      INTO v_customer_id,v_current_machine,v_current_quantity,v_current_capsules
    FROM public.customers c WHERE c.id=NEW.customer_id FOR UPDATE;
  END IF;
  IF v_customer_id IS NULL THEN
    SELECT c.id,c.current_machine,c.confirmed_monthly_capsules,c.confirmed_capsule_selection
      INTO v_customer_id,v_current_machine,v_current_quantity,v_current_capsules
    FROM public.customers c
    WHERE pg_catalog.lower(pg_catalog.btrim(c.email))=v_email
       OR EXISTS (SELECT 1 FROM public.customer_emails ce WHERE ce.customer_id=c.id AND ce.email_normalized=v_email)
    ORDER BY c.created_at LIMIT 1 FOR UPDATE;
  END IF;
  IF v_customer_id IS NULL AND v_name IS NOT NULL THEN
    SELECT count(*), min(c.id::text)::uuid INTO v_match_count,v_name_match
    FROM public.customers c
    WHERE pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(COALESCE(c.full_name,'')), '\s+', ' ', 'g'))=v_name;
    IF v_match_count=1 THEN
      SELECT c.id,c.current_machine,c.confirmed_monthly_capsules,c.confirmed_capsule_selection
        INTO v_customer_id,v_current_machine,v_current_quantity,v_current_capsules
      FROM public.customers c WHERE c.id=v_name_match FOR UPDATE;
    ELSIF v_match_count>1 THEN
      RAISE EXCEPTION 'Postoji više kupaca s istim imenom ili nazivom tvrtke. Zahtjev treba ručno povezati s ispravnim kupcem prije potvrde.';
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    v_effective_machine := v_target_machine;
    v_effective_quantity := v_target_quantity;
  ELSE
    v_effective_machine := COALESCE(v_target_machine,v_current_machine);
    v_effective_quantity := COALESCE(v_target_quantity,v_current_quantity);
  END IF;
  v_minimum_quantity := CASE v_effective_machine
    WHEN 'Lavazza LB 1300 Classy Soul' THEN 200
    WHEN 'Lavazza LB 1300C Soul' THEN 200
    WHEN 'Lavazza LB2600' THEN 400
    WHEN 'Lavazza LB 2600 Magystra' THEN 400
    ELSE NULL
  END;
  IF v_minimum_quantity IS NULL THEN RAISE EXCEPTION 'Aparat nije prepoznat za potvrdu: %',COALESCE(v_effective_machine,'(prazno)'); END IF;
  IF v_effective_quantity IS NULL OR v_effective_quantity<v_minimum_quantity THEN
    RAISE EXCEPTION 'Za potvrdu zahtjeva aparat % zahtijeva najmanje % kapsula mjesečno. Odaberite odgovarajuću količinu prije potvrde.',v_effective_machine,v_minimum_quantity;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers(email,full_name,current_machine,confirmed_monthly_capsules,confirmed_capsule_selection)
    VALUES(v_email,NULLIF(pg_catalog.btrim(NEW.customer_name),''),v_effective_machine,v_effective_quantity,v_target_capsules)
    RETURNING id,current_machine,confirmed_monthly_capsules,confirmed_capsule_selection
    INTO v_customer_id,v_current_machine,v_current_quantity,v_current_capsules;
    NEW.customer_id:=v_customer_id;
    INSERT INTO public.quantity_history(customer_id,request_id,previous_quantity,new_quantity,note,is_test)
    VALUES(v_customer_id,NEW.id,NULL,v_effective_quantity,'Početna potvrđena mjesečna količina iz zahtjeva.',COALESCE(NEW.is_test,false));
    INSERT INTO public.customer_change_history(customer_id,request_id,previous_machine,new_machine,previous_quantity,new_quantity,previous_capsule_selection,new_capsule_selection,change_type,note,is_test)
    VALUES(v_customer_id,NEW.id,NULL,v_effective_machine,NULL,v_effective_quantity,NULL,v_target_capsules,'initial_confirmation','Početno potvrđeni uvjeti kupca.',COALESCE(NEW.is_test,false));
  ELSE
    INSERT INTO public.customer_change_history(customer_id,request_id,previous_machine,new_machine,previous_quantity,new_quantity,previous_capsule_selection,new_capsule_selection,change_type,note,is_test)
    SELECT v_customer_id,NEW.id,v_current_machine,v_effective_machine,v_current_quantity,v_effective_quantity,v_current_capsules,v_target_capsules,
      'confirmed_update','Potvrđena promjena uvjeta kupca.',COALESCE(NEW.is_test,false)
    WHERE v_effective_machine IS DISTINCT FROM v_current_machine
       OR v_effective_quantity IS DISTINCT FROM v_current_quantity
       OR v_target_capsules IS DISTINCT FROM COALESCE(v_current_capsules,'[]'::jsonb);

    UPDATE public.customers c
      SET full_name=COALESCE(NULLIF(pg_catalog.btrim(NEW.customer_name),''),c.full_name),
          current_machine=v_effective_machine,confirmed_monthly_capsules=v_effective_quantity,
          confirmed_capsule_selection=v_target_capsules,updated_at=pg_catalog.now()
    WHERE c.id=v_customer_id;
    NEW.customer_id:=v_customer_id;
    IF v_effective_quantity IS DISTINCT FROM v_current_quantity THEN
      INSERT INTO public.quantity_history(customer_id,request_id,previous_quantity,new_quantity,note,is_test)
      VALUES(v_customer_id,NEW.id,v_current_quantity,v_effective_quantity,
        CASE WHEN v_current_quantity IS NULL THEN 'Početna potvrđena mjesečna količina iz zahtjeva.' ELSE 'Promjena mjesečne količine nakon potvrde zahtjeva.' END,
        COALESCE(NEW.is_test,false));
    END IF;
  END IF;

  IF v_customer_id IS NOT NULL AND v_email IS NOT NULL THEN
    INSERT INTO public.customer_emails(customer_id,email_normalized,source_request_id,is_test)
    VALUES(v_customer_id,v_email,NEW.id,COALESCE(NEW.is_test,false))
    ON CONFLICT(email_normalized) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.zfk_admin_request_action(p_action text, p_request_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_machine text DEFAULT NULL::text, p_quantity integer DEFAULT NULL::integer, p_capsules jsonb DEFAULT NULL::jsonb, p_customer_name text DEFAULT NULL::text, p_customer_email text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_request public.customer_requests%rowtype;
 v_customer public.customers%rowtype;
 v_email text;
 v_machine text;
 v_quantity integer;
 v_capsules jsonb;
 v_missing text;
begin
 if p_action not in ('link','create_customer','confirm','reject') then raise exception 'Nepoznata administratorska radnja.'; end if;
 select * into v_request from public.customer_requests where id=p_request_id and coalesce(is_test,false)=false for update;
 if not found then raise exception 'Upit nije pronađen.'; end if;
 if p_action='reject' then
  if v_request.request_status<>'pending' then raise exception 'Moguće je odbiti samo upit koji čeka potvrdu.'; end if;
  update public.customer_requests set request_status='rejected' where id=p_request_id;
  return jsonb_build_object('ok',true,'action','reject','request_id',p_request_id);
 end if;
 if p_action='link' then
  if p_customer_id is null then raise exception 'Odaberi postojećeg kupca.'; end if;
  select * into v_customer from public.customers where id=p_customer_id and coalesce(is_test,false)=false for update;
  if not found then raise exception 'Kupac nije pronađen.'; end if;
  if v_request.request_status<>'pending' then raise exception 'Povezivanje je dopušteno samo za upit koji čeka potvrdu.'; end if;
  update public.customer_requests set customer_id=p_customer_id where id=p_request_id;
  v_email:=lower(trim(coalesce(v_request.customer_email,'')));
  if length(v_email)>3 and v_email<>lower(trim(coalesce(v_customer.email,''))) then
   insert into public.customer_emails(customer_id,email_normalized,source_request_id,is_test) values(p_customer_id,v_email,p_request_id,false) on conflict(email_normalized) do nothing;
  end if;
  return jsonb_build_object('ok',true,'action','link','request_id',p_request_id,'customer_id',p_customer_id);
 end if;
 if p_action='create_customer' then
  if v_request.request_status<>'pending' then raise exception 'Novi kupac može se evidentirati samo iz upita koji čeka potvrdu.'; end if;
  v_email:=lower(trim(coalesce(v_request.customer_email,'')));
  if length(v_email)<4 then raise exception 'Upit nema valjanu e-mail adresu.'; end if;
  if exists(select 1 from public.customers where lower(trim(email))=v_email and coalesce(is_test,false)=false) or exists(select 1 from public.customer_emails where email_normalized=v_email and coalesce(is_test,false)=false) then raise exception 'Ova e-mail adresa već je povezana s kupcem. Odaberi postojećeg kupca.'; end if;
  insert into public.customers(email,full_name,is_test,confirmed_capsule_selection) values(v_email,coalesce(nullif(trim(v_request.customer_name),''),'Novi kupac'),false,'[]'::jsonb) returning * into v_customer;
  update public.customer_requests set customer_id=v_customer.id where id=p_request_id;
  return jsonb_build_object('ok',true,'action','create_customer','request_id',p_request_id,'customer_id',v_customer.id);
 end if;
 if p_action='confirm' then
  if v_request.request_status<>'pending' then raise exception 'Moguće je potvrditi samo upit koji čeka potvrdu.'; end if;
  if v_request.customer_id is null then raise exception 'Prvo poveži upit s postojećim ili novim kupcem.'; end if;
  v_machine:=nullif(trim(coalesce(p_machine,'')),''); v_quantity:=p_quantity; v_capsules:=coalesce(p_capsules,v_request.capsule_selection,'[]'::jsonb);
  if v_machine is null then raise exception 'Potrebno je potvrditi aparat.'; end if;
  if v_quantity is null or v_quantity<0 then raise exception 'Unesi valjanu potvrđenu mjesečnu količinu.'; end if;
  if jsonb_typeof(v_capsules)<>'array' then raise exception 'Odabir kapsula mora biti popis.'; end if;
  if v_machine not in ('Lavazza LB 1300 Classy Soul','Lavazza LB2600') then raise exception 'Odabran je nepoznat aparat.'; end if;
  if (v_machine='Lavazza LB 1300 Classy Soul' and v_quantity<200) or (v_machine='Lavazza LB2600' and v_quantity<400) then raise exception 'Potvrđena količina je ispod minimalne mjesečne količine za odabrani aparat.'; end if;
  if not exists(
    select 1 from public.zfk_inventory i
    where i.item_type='machine' and i.quantity>0
      and (
        lower(trim(i.item_name))=lower(v_machine)
        or (v_machine='Lavazza LB 1300 Classy Soul' and lower(trim(i.item_name))='lavazza lb 1300c soul')
        or (v_machine='Lavazza LB2600' and lower(trim(i.item_name))='lavazza lb 2600 magystra')
      )
  ) then raise exception 'Aparat nije označen kao raspoloživ na zalihi. Ažuriraj zalihe ili predloži zamjenu.'; end if;
  select string_agg(distinct capsule_name, ', ') into v_missing
  from (
    select lower(trim(regexp_replace(coalesce(e.value->>'name',e.value->>'title',e.value#>>'{}'), '\s*100.?kom\s*$', '', 'i'))) as capsule_name
    from jsonb_array_elements(v_capsules) e(value)
  ) s
  where capsule_name<>'' and not exists(
    select 1 from public.zfk_inventory i
    where i.item_type='capsule' and i.quantity>0
      and lower(trim(regexp_replace(i.item_name, '\s*100.?kom\s*$', '', 'i')))=s.capsule_name
  );
  if v_missing is not null then raise exception 'Nedostupne kapsule: %. Ne potvrđuj upit; ažuriraj zalihu i predloži zamjenu.',v_missing; end if;
  select * into v_customer from public.customers where id=v_request.customer_id and coalesce(is_test,false)=false for update;
  if not found then raise exception 'Povezani kupac nije pronađen.'; end if;
  insert into public.customer_change_history(customer_id,request_id,previous_machine,new_machine,previous_quantity,new_quantity,previous_capsule_selection,new_capsule_selection,change_type,note,is_test)
  values(v_customer.id,p_request_id,v_customer.current_machine,v_machine,v_customer.confirmed_monthly_capsules,v_quantity,v_customer.confirmed_capsule_selection,v_capsules,'admin_confirmation',nullif(trim(coalesce(p_note,'')),''),false);
  if v_customer.confirmed_monthly_capsules is distinct from v_quantity then
   insert into public.quantity_history(customer_id,request_id,previous_quantity,new_quantity,note,is_test) values(v_customer.id,p_request_id,v_customer.confirmed_monthly_capsules,v_quantity,nullif(trim(coalesce(p_note,'')),''),false);
  end if;
  update public.customers set current_machine=v_machine,confirmed_monthly_capsules=v_quantity,confirmed_capsule_selection=v_capsules,updated_at=now() where id=v_customer.id;
  update public.customer_requests set request_status='confirmed',confirmed_at=now(),requested_machine=v_machine,requested_monthly_capsules=v_quantity,capsule_selection=v_capsules,customer_id=v_customer.id where id=p_request_id;
  return jsonb_build_object('ok',true,'action','confirm','request_id',p_request_id,'customer_id',v_customer.id);
 end if;
end;
$function$;

