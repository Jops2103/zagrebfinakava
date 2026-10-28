-- Track inventory deductions made by request confirmation.
-- Capsule inventory quantities represent boxes of 100 capsules; machine quantities represent individual machines.

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
