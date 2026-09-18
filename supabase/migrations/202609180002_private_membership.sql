create table public.workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members where user_id = auth.uid()); $$;

create or replace function public.is_workspace_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.workspace_members where user_id = auth.uid() and role = 'owner'); $$;

drop policy "authenticated users manage workspace" on public.workspace_state;

create policy "members manage workspace"
  on public.workspace_state for all to authenticated
  using (public.is_workspace_member()) with check (public.is_workspace_member());

create policy "members view team"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member());

create or replace function public.register_workspace_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.workspace_members) then
    insert into public.workspace_members (user_id, email, role)
    values (new.id, coalesce(new.email, ''), 'owner');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.register_workspace_user();
