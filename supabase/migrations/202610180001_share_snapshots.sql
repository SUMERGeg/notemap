-- Cloud contains only explicitly published, immutable archives. No personal-note tables.
create table public.notemap_shares (
  id uuid primary key,
  owner_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 41943040),
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.notemap_shares enable row level security;
revoke all on public.notemap_shares from anon, authenticated;
grant all on public.notemap_shares to service_role;
create index on public.notemap_shares(expires_at);
create index on public.notemap_shares(owner_id, created_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('notemap-shares','notemap-shares',false,41943040,array['application/json'])
on conflict(id) do nothing;
-- Deliberately no client storage policies: only the Edge Function may access this bucket.

create function public.notemap_reserve_share(_id uuid,_owner_id uuid,_token_hash text,_size_bytes bigint)
returns public.notemap_shares
language plpgsql security definer set search_path = '' as $$
declare result public.notemap_shares;
begin
  -- Serialise reservations so simultaneous uploads cannot overspend the storage allowance.
  perform pg_advisory_xact_lock(7483190);
  if (select coalesce(sum(size_bytes),0) from public.notemap_shares) + _size_bytes > 838860800 then
    raise exception 'share_storage_full';
  end if;
  if (select count(*) from public.notemap_shares where owner_id=_owner_id) >= 5
     or (select count(*) from public.notemap_shares where owner_id=_owner_id and created_at>now()-interval '1 day') >= 5 then
    raise exception 'share_limit';
  end if;
  insert into public.notemap_shares(id,owner_id,token_hash,size_bytes)
  values (_id,_owner_id,_token_hash,_size_bytes) returning * into result;
  return result;
end $$;
revoke all on function public.notemap_reserve_share(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.notemap_reserve_share(uuid,uuid,text,bigint) to service_role;
