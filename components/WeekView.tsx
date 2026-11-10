'use client'
import { hhmm, monthStart, overlaps, parse, today, weekDays, weekStart } from '@/lib/dates.mjs'
import type { Api, Task } from '@/lib/useTasks'
import TaskList, { AddInput, Check, drag } from './TaskList'

export const DOW = ['월', '화', '수', '목', '금', '토', '일']

export function Progress({ tasks, label }: { tasks: Task[]; label: string }) {
  const done = tasks.filter(t => t.is_done).length
  return (
    <section className="card">
      <h3>{label}<small>{done}/{tasks.length}</small></h3>
      <progress value={done} max={tasks.length || 1} aria-label={label} />
    </section>
  )
}

export default function WeekView({ date, tasks, api, go }: {
  date: string; tasks: Task[]; api: Api; go: (view: 'day', date: string) => void
}) {
  const days = weekDays(date)
  const of = (d: string) =>
    tasks.filter(t => t.scope === 'day' && t.period === d).sort((a, b) => (a.start_min ?? 1e9) - (b.start_min ?? 1e9))

  // 다른 요일로 옮긴다. 옮긴 날의 시간과 겹치면 시간 배치만 해제한다.
  const move = (id: string, d: string) => {
    const t = tasks.find(t => t.id === id)
    if (!t || t.scope !== 'day' || t.period === d) return
    const clash = t.start_min != null && overlaps(of(d), t.start_min, t.end_min, id)
    api.update(id, { period: d, ...(clash && { start_min: null, end_min: null }) })
  }

  return (
    <div className="cols">
      <aside>
        <Progress label="이번 주 진행" tasks={days.flatMap(of)} />
        <TaskList title="주간 목표" scope="week" period={weekStart(date)} tasks={tasks} api={api} placeholder="주간 목표를 적고 Enter" />
        <TaskList title="이번 달 목표" scope="month" period={monthStart(date)} tasks={tasks} api={api} placeholder="월간 목표를 적고 Enter" />
      </aside>
      <div className="week">
        {days.map((d, i) => {
          const list = of(d)
          return (
            <section
              key={d}
              className={'card daycol' + (d === today() ? ' today' : '')}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                move(e.dataTransfer.getData('text/plain'), d)
              }}
            >
              <button className="dayhead" onClick={() => go('day', d)} title="일간 보기로 이동">
                <b>{DOW[i]} {parse(d).getDate()}</b>
                <small>{list.filter(t => t.is_done).length}/{list.length}</small>
              </button>
              {list.map(t => (
                <div key={t.id} className={'wtask' + (t.is_done ? ' done' : '')} draggable onDragStart={drag(t.id)}>
                  <Check t={t} api={api} />
                  <span>
                    {t.start_min != null && <small>{hhmm(t.start_min)} </small>}
                    {t.is_top3 && '★ '}{t.text}
                  </span>
                  <button className="x" aria-label={`삭제: ${t.text}`} onClick={() => api.remove(t.id)}>✕</button>
                </div>
              ))}
              <AddInput placeholder="+ 할 일" onAdd={text => api.add({ scope: 'day', period: d, text })} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
