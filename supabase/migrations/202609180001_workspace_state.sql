create table public.workspace_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.workspace_state enable row level security;

create policy "authenticated users manage workspace"
  on public.workspace_state for all to authenticated
  using (true) with check (true);

alter publication supabase_realtime add table public.workspace_state;
