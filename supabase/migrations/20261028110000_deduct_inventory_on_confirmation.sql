-- Track inventory deductions made by request confirmation.
-- Capsule inventory quantities represent boxes of 100 capsules; machine quantities represent individual machines.

-- Fix capsule-name matching in the confirmation RPC and pass the exact per-type allocation to the stock trigger.
CREATE OR REPLACE FUNCTION public.zfk_admin_request_action(
  p_action text,
  p_request_id uuid,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_machine text DEFAULT NULL::text,
  p_quantity integer DEFAULT NULL::integer,
  p_capsules jsonb DEFAULT NULL::jsonb,
  p_customer_name text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text
)
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
  if (v_machine='Lavazza LB 1300 Classy Soul' and v_quantity<200) or (v_machine='Lavazza LB2600' and v_quantity<300) then raise exception 'Potvrđena količina je ispod minimalne mjesečne količine za odabrani aparat.'; end if;
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

create table if not exists public.zfk_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.customer_requests(id) on delete restrict,
  item_type text not null check (item_type in ('machine','capsule')),
  item_name text not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('confirmation','release')),
  created_at timestamptz not null default now(),
  is_test boolean not null default false
);

create table if not exists public.zfk_request_inventory_deductions (
  request_id uuid not null references public.customer_requests(id) on delete restrict,
  item_type text not null check (item_type in ('machine','capsule')),
  item_name text not null,
  quantity_deducted integer not null check (quantity_deducted > 0),
  created_at timestamptz not null default now(),
  primary key (request_id, item_type, item_name)
);

alter table public.zfk_inventory_movements enable row level security;
alter table public.zfk_request_inventory_deductions enable row level security;
revoke all on public.zfk_inventory_movements from anon, authenticated;
revoke all on public.zfk_request_inventory_deductions from anon, authenticated;

create or replace function public.zfk_apply_request_inventory()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inventory_id uuid;
  v_inventory_name text;
  v_stock integer;
  v_machine_name text;
  v_capsule jsonb;
  v_capsule_name text;
  v_boxes integer;
  v_total_capsules integer := 0;
  v_deduction record;
begin
  if old.request_status = 'pending' and new.request_status = 'confirmed' then
    -- Deduct exactly one machine, matching the canonical name or known stock label.
    select i.id, i.item_name, i.quantity
      into v_inventory_id, v_inventory_name, v_stock
    from public.zfk_inventory i
    where i.item_type = 'machine'
      and i.quantity > 0
      and (
        lower(trim(i.item_name)) = lower(trim(new.requested_machine))
        or (new.requested_machine = 'Lavazza LB 1300 Classy Soul' and lower(trim(i.item_name)) = 'lavazza lb 1300c soul')
        or (new.requested_machine = 'Lavazza LB2600' and lower(trim(i.item_name)) = 'lavazza lb 2600 magystra')
      )
    order by i.updated_at desc
    limit 1
    for update;
    if not found then
      raise exception 'Aparat nije dostupan na zalihi u trenutku potvrde.';
    end if;

    update public.zfk_inventory set quantity = quantity - 1, updated_at = now() where id = v_inventory_id;
    insert into public.zfk_request_inventory_deductions(request_id,item_type,item_name,quantity_deducted)
      values(new.id,'machine',v_inventory_name,1);
    insert into public.zfk_inventory_movements(request_id,item_type,item_name,quantity_delta,reason,is_test)
      values(new.id,'machine',v_inventory_name,-1,'confirmation',coalesce(new.is_test,false));

    if jsonb_typeof(new.capsule_selection) <> 'array' or jsonb_array_length(new.capsule_selection) = 0 then
      raise exception 'Prije potvrde odredi vrste kapsula i broj kutija.';
    end if;

    for v_capsule in select value from jsonb_array_elements(new.capsule_selection)
    loop
      if jsonb_typeof(v_capsule) <> 'object'
         or nullif(trim(v_capsule->>'name'),'') is null
         or coalesce(v_capsule->>'boxes','') !~ '^[0-9]+$' then
        raise exception 'Raspodjela kapsula mora sadržavati naziv vrste i cijeli broj kutija.';
      end if;

      v_capsule_name := trim(v_capsule->>'name');
      v_boxes := (v_capsule->>'boxes')::integer;
      if v_boxes <= 0 then
        raise exception 'Unesi barem jednu kutiju za svaku odabranu vrstu kapsula.';
      end if;
      v_total_capsules := v_total_capsules + (v_boxes * 100);

      select i.id, i.item_name, i.quantity
        into v_inventory_id, v_inventory_name, v_stock
      from public.zfk_inventory i
      where i.item_type = 'capsule'
        and lower(trim(regexp_replace(i.item_name, '100.?kom$', '', 'i'))) =
            lower(trim(regexp_replace(v_capsule_name, '100.?kom$', '', 'i')))
        and i.quantity >= v_boxes
      order by i.updated_at desc
      limit 1
      for update;

      if not found then
        raise exception 'Nema dovoljno kutija na zalihi za kapsule: %.', v_capsule_name;
      end if;

      update public.zfk_inventory set quantity = quantity - v_boxes, updated_at = now() where id = v_inventory_id;
      insert into public.zfk_request_inventory_deductions(request_id,item_type,item_name,quantity_deducted)
        values(new.id,'capsule',v_inventory_name,v_boxes);
      insert into public.zfk_inventory_movements(request_id,item_type,item_name,quantity_delta,reason,is_test)
        values(new.id,'capsule',v_inventory_name,-v_boxes,'confirmation',coalesce(new.is_test,false));
    end loop;

    if v_total_capsules <> new.requested_monthly_capsules then
      raise exception 'Raspodjela kutija mora odgovarati potvrđenoj mjesečnoj količini (% kapsula).', new.requested_monthly_capsules;
    end if;

  elsif old.request_status = 'confirmed' and new.request_status = 'pending' then
    -- Reopening a confirmed request releases its reservation once, using the exact original stock rows.
    for v_deduction in
      select * from public.zfk_request_inventory_deductions
      where request_id = old.id
      for update
    loop
      update public.zfk_inventory
      set quantity = quantity + v_deduction.quantity_deducted, updated_at = now()
      where item_type = v_deduction.item_type and item_name = v_deduction.item_name
      returning item_name into v_inventory_name;

      if not found then
        raise exception 'Ne mogu vratiti zalihu za artikl %; prvo obnovi ili vrati naziv artikla.', v_deduction.item_name;
      end if;

      insert into public.zfk_inventory_movements(request_id,item_type,item_name,quantity_delta,reason,is_test)
        values(old.id,v_deduction.item_type,v_deduction.item_name,v_deduction.quantity_deducted,'release',coalesce(old.is_test,false));
    end loop;

    delete from public.zfk_request_inventory_deductions where request_id = old.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists zfk_request_inventory_status_trigger on public.customer_requests;
create trigger zfk_request_inventory_status_trigger
after update of request_status on public.customer_requests
for each row
when (old.request_status is distinct from new.request_status)
execute function public.zfk_apply_request_inventory();

revoke all on function public.zfk_apply_request_inventory() from public, anon, authenticated;
