-- ARNOLD · schéma abonnements, quotas et paiements
-- À exécuter une fois dans le SQL Editor Supabase (ou via supabase db push).

-- ── Abonnements ─────────────────────────────────────────────
-- plan : 'pass5'   = 4 analyses valables 5 jours (2 000 XAF)
--        'monthly' = 10 analyses valables 30 jours (13 000 XAF)
create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan        text not null check (plan in ('pass5', 'monthly')),
  quota       int  not null check (quota > 0),
  used        int  not null default 0 check (used >= 0),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, ends_at);

-- ── Journal des analyses (sert au quota gratuit par jour) ───
create table if not exists public.analysis_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('subscription', 'free')),
  created_at  timestamptz not null default now()
);
create index if not exists analysis_log_user_day_idx on public.analysis_log (user_id, created_at);

-- ── Paiements (Stripe + CamPay) ─────────────────────────────
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null check (provider in ('stripe', 'campay')),
  provider_ref text not null unique,
  plan         text not null check (plan in ('pass5', 'monthly')),
  amount       int  not null,
  currency     text not null default 'XAF',
  status       text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── RLS : chaque utilisateur ne lit que ses lignes ──────────
-- Aucune politique d'écriture : seules les fonctions serveur (clé service_role) écrivent.
alter table public.subscriptions enable row level security;
alter table public.analysis_log  enable row level security;
alter table public.payments      enable row level security;

drop policy if exists "own subscriptions" on public.subscriptions;
create policy "own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "own analyses" on public.analysis_log;
create policy "own analyses" on public.analysis_log
  for select using (auth.uid() = user_id);

drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments
  for select using (auth.uid() = user_id);

-- ── Consommation atomique d'une analyse ─────────────────────
-- 1. Utilise un abonnement actif avec quota restant.
-- 2. Sinon, applique le gratuit : 2 analyses par jour (jour UTC).
-- 3. Sinon, refuse ('denied').
create or replace function public.consume_analysis(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  today_count int;
begin
  select * into s
  from public.subscriptions
  where user_id = p_user and now() < ends_at and used < quota
  order by ends_at
  limit 1
  for update;

  if found then
    update public.subscriptions set used = used + 1 where id = s.id;
    insert into public.analysis_log (user_id, source) values (p_user, 'subscription');
    return 'subscription';
  end if;

  select count(*) into today_count
  from public.analysis_log
  where user_id = p_user
    and source = 'free'
    and created_at >= date_trunc('day', now());

  if today_count < 2 then
    insert into public.analysis_log (user_id, source) values (p_user, 'free');
    return 'free';
  end if;

  return 'denied';
end;
$$;

-- Seul le serveur (service_role) peut appeler la fonction.
revoke all on function public.consume_analysis(uuid) from public, anon, authenticated;
grant execute on function public.consume_analysis(uuid) to service_role;
