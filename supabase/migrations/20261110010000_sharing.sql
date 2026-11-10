-- 계정 간 일정 공유(읽기 전용).
-- profiles: 계정의 표시 이름과 색. shares: owner가 viewer에게 자기 일정을 보여준다.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '' check (char_length(name) <= 40),
  color text not null default '#1570ef' check (color ~ '^#[0-9a-fA-F]{6}$')
);
-- 고유 인덱스가 아니다: 이메일 없는 계정이 여럿 생겨도 가입 트리거가 실패하지 않게 한다(이메일 중복은 auth가 막는다).
create index profiles_email on public.profiles (lower(email));

create table public.shares (
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);
create index shares_viewer on public.shares (viewer_id);

-- 가입 시 프로필을 만든다. 색은 계정 id로 6색 중 하나를 고른다.
-- ponytail: 이메일을 나중에 바꿔도 profiles.email은 따라가지 않는다. 이메일 변경 기능을 넣을 때 auth.users update 트리거 추가.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, color)
  values (
    new.id,
    coalesce(new.email, ''),
    (array['#1570ef', '#12b76a', '#f79009', '#f04438', '#ee46bc', '#9e77ed'])[1 + get_byte(decode(md5(new.id::text), 'hex'), 0) % 6]
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 계정의 프로필
insert into public.profiles (id, email, color)
select id, coalesce(email, ''),
  (array['#1570ef', '#12b76a', '#f79009', '#f04438', '#ee46bc', '#9e77ed'])[1 + get_byte(decode(md5(id::text), 'hex'), 0) % 6]
from auth.users
on conflict (id) do nothing;

-- 이메일을 정확히 아는 계정에게만 공유한다(계정 목록을 노출하지 않기 위해 함수로만 추가).
create function public.share_with(target_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  select id into target from public.profiles
  where email <> '' and lower(email) = lower(trim(target_email)) limit 1;
  if target is null then
    raise exception '가입된 계정을 찾지 못했어요';
  end if;
  if target = auth.uid() then
    raise exception '자기 자신에게는 공유할 수 없어요';
  end if;
  insert into public.shares (owner_id, viewer_id) values (auth.uid(), target) on conflict do nothing;
  return target;
end $$;
revoke execute on function public.share_with(text) from public, anon;
grant execute on function public.share_with(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.shares enable row level security;

-- shares: 당사자(공유한 사람, 받은 사람)만 보고 해제할 수 있다. 추가는 share_with()로만.
create policy "see own shares" on public.shares for select to authenticated
  using ((select auth.uid()) in (owner_id, viewer_id));
create policy "end own shares" on public.shares for delete to authenticated
  using ((select auth.uid()) in (owner_id, viewer_id));
revoke all on public.shares from anon, authenticated;
grant select, delete on public.shares to authenticated;

-- profiles: 본인과, 공유로 연결된 상대만 볼 수 있다. 수정은 본인의 이름·색만(이메일은 바꿀 수 없다).
create policy "see self and connected" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.shares s
      where (s.owner_id = profiles.id and s.viewer_id = (select auth.uid()))
         or (s.viewer_id = profiles.id and s.owner_id = (select auth.uid()))
    )
  );
create policy "edit self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, color) on public.profiles to authenticated;

-- tasks: 나에게 공유한 사람의 할 일을 읽을 수 있다(쓰기는 기존 "own tasks" 정책대로 본인만).
create policy "read shared tasks" on public.tasks for select to authenticated
  using (
    exists (
      select 1 from public.shares s
      where s.owner_id = tasks.user_id and s.viewer_id = (select auth.uid())
    )
  );
