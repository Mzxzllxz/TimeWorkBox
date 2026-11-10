'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { hhmm, monthGrid, monthStart, parse, today } from '@/lib/dates.mjs'
import { supabase, type Task } from '@/lib/useTasks'
import { nameOf, type Profile } from './Share'
import { DOW } from './WeekView'

/** 공유일정 달력: 나와 나에게 공유한 계정들의 일일 목표를 계정 색 막대로 한 달력에 모아 보여준다. */
export default function SharedView({ date, me, owners, people, open }: {
  date: string
  me: string
  /** 나에게 일정을 공유한 계정 id */
  owners: string[]
  people: Profile[]
  /** 막대를 누르면 그 계정의 그날 일간 화면으로 이동 */
  open: (userId: string, date: string) => void
}) {
  const grid = monthGrid(date)
  const from = grid[0][0], to = grid.at(-1)![6]
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState<string[]>([])

  // user_id로 거르지 않는다: RLS가 내 것과 나에게 공유된 것만 돌려준다.
  useEffect(() => {
    let live = true
    supabase
      .from('tasks').select('*').eq('scope', 'day').gte('period', from).lte('period', to)
      .order('start_min', { nullsFirst: false }).order('created_at')
      .then(({ data, error }) => {
        if (!live) return
        setError(error ? error.message : '')
        if (data) setTasks(data)
      })
    return () => { live = false }
  }, [from, to])

  const who = (id: string) => people.find(p => p.id === id)
  const color = (id: string) => who(id)?.color ?? '#98a2b3'
  const label = (id: string) => (id === me ? `나 (${nameOf(who(id))})` : nameOf(who(id)))
  const shown = tasks.filter(t => !hidden.includes(t.user_id))

  return (
    <>
      <div className="legend">
        {[me, ...owners].map(id => (
          <label key={id}>
            <input
              type="checkbox"
              checked={!hidden.includes(id)}
              onChange={() => setHidden(h => (h.includes(id) ? h.filter(x => x !== id) : [...h, id]))}
            />
            <i className="dot" style={{ background: color(id) }} />
            {label(id)}
          </label>
        ))}
        {!owners.length && <span className="sub">아직 공유받은 일정이 없어요. 상대가 "공유"에서 내 이메일을 추가하면 여기에 함께 보여요.</span>}
      </div>
      {error && <p role="alert">불러오지 못했어요: {error}</p>}
      <section className="card shared-cal">
        {DOW.map((d, i) => <b key={d} className={'dow' + (i === 5 ? ' sat' : i === 6 ? ' sun' : '')}>{d}</b>)}
        {grid.flat().map((d, i) => (
          <div key={d} className={'scell' + (monthStart(d) !== monthStart(date) ? ' out' : '') + (d === today() ? ' today' : '')}>
            <span className={'snum' + (i % 7 === 5 ? ' sat' : i % 7 === 6 ? ' sun' : '')}>{parse(d).getDate()}</span>
            {shown.filter(t => t.period === d).map(t => (
              <button
                key={t.id}
                className={'ev' + (t.is_done ? ' done' : '')}
                style={{ '--c': color(t.user_id) } as CSSProperties}
                title={`${label(t.user_id)} · ${t.text}`}
                onClick={() => open(t.user_id, d)}
              >
                {t.start_min != null && <b>{hhmm(t.start_min)} </b>}
                {t.text}
              </button>
            ))}
          </div>
        ))}
      </section>
    </>
  )
}
