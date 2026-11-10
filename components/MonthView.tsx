'use client'
import { addDays, addMonths, monthGrid, monthStart, parse, today } from '@/lib/dates.mjs'
import type { Api, Task } from '@/lib/useTasks'
import TaskList from './TaskList'
import { DOW, Progress } from './WeekView'

export default function MonthView({ date, tasks, api, go }: {
  date: string; tasks: Task[]; api: Api; go: (view: 'day' | 'week', date: string) => void
}) {
  const month = monthStart(date)
  const dayTasks = tasks.filter(t => t.scope === 'day')
  const of = (d: string) => dayTasks.filter(t => t.period === d).sort((a, b) => +b.is_top3 - +a.is_top3)

  return (
    <div className="cols">
      <aside>
        <Progress label="이번 달 진행" tasks={dayTasks.filter(t => monthStart(t.period) === month)} />
        <TaskList title="월간 목표" scope="month" period={month} tasks={tasks} api={api} syncDays={[month, addDays(addMonths(month, 1), -1)]} placeholder="월간 목표를 적고 Enter" />
      </aside>
      <section className="card month">
        <span />
        {DOW.map(d => <b key={d} className="dow">{d}</b>)}
        {monthGrid(date).map(week => [
          <button key={'w' + week[0]} className="weekjump" onClick={() => go('week', week[0])} title="주간 보기로 이동" aria-label={`${week[0]} 주간 보기`}>주</button>,
          ...week.map(d => {
            const list = of(d)
            const done = list.filter(t => t.is_done).length
            return (
              <button
                key={d}
                className={'cell' + (monthStart(d) !== month ? ' out' : '') + (d === today() ? ' today' : '')}
                onClick={() => go('day', d)}
                aria-label={`${d}, 할 일 ${list.length}개 중 ${done}개 완료`}
              >
                <span className="num">
                  <b>{parse(d).getDate()}</b>
                  {list.length > 0 && <small>{done}/{list.length}</small>}
                </span>
                {list.slice(0, 3).map(t => (
                  <span key={t.id} className={'chip' + (t.is_done ? ' done' : '') + (t.is_top3 ? ' top' : '')}>{t.text}</span>
                ))}
                {list.length > 3 && <small>+{list.length - 3}</small>}
              </button>
            )
          }),
        ])}
      </section>
    </div>
  )
}
