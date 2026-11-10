-- 일간/주간/월간 할 일을 한 테이블에 저장한다.
-- scope='day'   : period = 해당 날짜, start_min/end_min = Time Box 배치(분 단위, 30분 간격)
-- scope='week'  : period = 그 주의 월요일 (주간 목표)
-- scope='month' : period = 그 달의 1일 (월간 목표)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('day', 'week', 'month')),
  period date not null,
  text text not null check (char_length(text) between 1 and 500),
  is_top3 boolean not null default false,
  is_done boolean not null default false,
  completed_at timestamptz,
  start_min int check (start_min between 0 and 1410),
  end_min int check (end_min between 30 and 1440),
  created_at timestamptz not null default now(),
  check ((start_min is null) = (end_min is null)),
  check (start_min is null or start_min < end_min)
);

create index tasks_user_period on public.tasks (user_id, period);

alter table public.tasks enable row level security;

create policy "own tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tasks to authenticated;
