'use client'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import DayView from '@/components/DayView'
import MonthView from '@/components/MonthView'
import WeekView from '@/components/WeekView'
import { addDays, addMonths, fmt, monthGrid, monthStart, parse, today, weekStart } from '@/lib/dates.mjs'
import { supabase, useTasks } from '@/lib/useTasks'

type View = 'day' | 'week' | 'month'
const VIEWS: [View, string][] = [['day', '일간'], ['week', '주간'], ['month', '월간']]

function ThemeButton() {
  const toggle = () => {
    const el = document.documentElement
    el.dataset.theme = el.dataset.theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('theme', el.dataset.theme) } catch {} // 저장이 막혀 있어도 이번 화면에는 적용된다
  }
  return <button type="button" className="ghost theme" onClick={toggle} title="라이트 / 다크 모드 전환" aria-label="라이트 / 다크 모드 전환">◐ 테마</button>
}

function Auth() {
  const [signUp, setSignUp] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const cred = { email: String(f.get('email')), password: String(f.get('password')) }
    setBusy(true)
    const { data, error } = signUp
      ? await supabase.auth.signUp({ ...cred, options: { emailRedirectTo: location.origin } })
      : await supabase.auth.signInWithPassword(cred)
    setBusy(false)
    setMsg(error ? error.message : signUp && !data.session ? '확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.' : '')
  }

  return (
    <main className="auth">
      <ThemeButton />
      <form className="card" onSubmit={submit}>
        <h1>TimeWorkBox</h1>
        <p>일간·주간·월간 타임박싱 플래너</p>
        <label>이메일<input name="email" type="email" required autoComplete="email" /></label>
        <label>비밀번호<input name="password" type="password" required minLength={6} autoComplete={signUp ? 'new-password' : 'current-password'} /></label>
        <button className="primary" disabled={busy}>{signUp ? '회원가입' : '로그인'}</button>
        <button type="button" className="ghost" onClick={() => { setSignUp(s => !s); setMsg('') }}>
          {signUp ? '이미 계정이 있어요 — 로그인' : '계정이 없어요 — 회원가입'}
        </button>
        {msg && <p role="alert">{msg}</p>}
      </form>
    </main>
  )
}

// 현재 화면은 주소의 해시(#week/2026-11-10)에 둔다. 새로고침·뒤로가기가 그대로 동작한다.
const readNav = () => {
  const m = location.hash.match(/^#(day|week|month)\/(\d{4}-\d{2}-\d{2})$/)
  const date = m ? parse(m[2]) : new Date()
  return { view: (m ? m[1] : 'day') as View, date: fmt(isNaN(+date) ? new Date() : date) }
}
const go = (view: View, date: string) => { location.hash = `${view}/${date}` }

function Planner({ email }: { email: string }) {
  const [{ view, date }, setNav] = useState(readNav)
  useEffect(() => {
    const onHash = () => setNav(readNav())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // 어느 화면이든 이번 주·이번 달 목표가 함께 보이도록 조회 범위에 포함한다.
  const grid = monthGrid(date)
  const [start, end] =
    // 일간: 이번 주·이번 달 카드에 그 기간의 일일 목표도 보여주므로 주와 달 전체를 불러온다.
    view === 'day' ? [date, [addDays(weekStart(date), 6), addDays(addMonths(date, 1), -1)].sort()[1]]
    : view === 'week' ? [weekStart(date), addDays(weekStart(date), 6)]
    : [grid[0][0], grid.at(-1)![6]]
  const from = [start, weekStart(date), monthStart(date)].sort()[0]
  const api = useTasks(from, end)

  const step = (n: number) =>
    go(view, view === 'day' ? addDays(date, n) : view === 'week' ? addDays(date, 7 * n) : addMonths(date, n))
  const d = parse(date)
  const short = (s: string) => `${parse(s).getMonth() + 1}.${parse(s).getDate()}`
  const label =
    view === 'day' ? d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
    : view === 'week' ? `${short(start)} – ${short(end)}`
    : `${d.getFullYear()}년 ${d.getMonth() + 1}월`

  return (
    <main>
      <header>
        <h1>TimeWorkBox</h1>
        <nav>
          {VIEWS.map(([v, name]) => (
            <button key={v} aria-current={v === view ? 'page' : undefined} onClick={() => go(v, date)}>{name}</button>
          ))}
        </nav>
        <div className="pager">
          <button aria-label="이전" onClick={() => step(-1)}>‹</button>
          <b>{label}</b>
          <input type="date" className="datepick" value={date} aria-label="날짜 선택" title="날짜 선택" onChange={e => e.target.value && go(view, e.target.value)} />
          <button aria-label="다음" onClick={() => step(1)}>›</button>
          <button className="ghost" onClick={() => go(view, today())}>오늘</button>
        </div>
        <span className="user">
          {email}
          <ThemeButton />
          <button className="ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </span>
      </header>
      {api.error && <p role="alert" className="error">불러오지 못했어요: {api.error}</p>}
      {view === 'day' && <DayView key={date} date={date} tasks={api.tasks} api={api} />}
      {view === 'week' && <WeekView date={date} tasks={api.tasks} api={api} go={go} />}
      {view === 'month' && <MonthView date={date} tasks={api.tasks} api={api} go={go} />}
    </main>
  )
}

export default function Page() {
  // undefined = 세션 확인 중
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  return session ? <Planner key={session.user.id} email={session.user.email ?? ''} /> : <Auth />
}
