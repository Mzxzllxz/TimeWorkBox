'use client'
import { useEffect, useRef, useState } from 'react'
import { hhmm, monthStart, overlaps, today, weekStart } from '@/lib/dates.mjs'
import { supabase, type Api, type Task } from '@/lib/useTasks'
import TaskList, { Check, drag } from './TaskList'

const H = 52 // 1시간 높이(px). 30분 = 26px
const DAWN = 240 // 새벽을 접었을 때 그리드가 시작하는 시각(04:00)

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function Timer({ tasks, api }: { tasks: Task[]; api: Api }) {
  const [now, setNow] = useState(() => new Date())
  const [perm, setPerm] = useState('unsupported')
  useEffect(() => {
    if ('Notification' in window) setPerm(Notification.permission)
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const open = tasks.filter(t => t.start_min != null && !t.is_done)
  const cur = open.find(t => t.start_min! * 60 <= sec && sec < t.end_min! * 60)
  const next = open.filter(t => t.start_min! * 60 > sec).sort((a, b) => a.start_min! - b.start_min!)[0]
  const left = cur ? cur.end_min! * 60 - sec : 0

  // 블록이 시작된 직후 1분 안에만 알린다(새로고침할 때마다 울리지 않도록).
  useEffect(() => {
    if (cur && perm === 'granted' && sec - cur.start_min! * 60 < 60)
      new Notification(`시작: ${cur.text}`, { body: '지금 이 할 일에 집중할 시간이에요.' })
  }, [cur?.id, perm])

  return (
    <section className="card timer">
      <div
        className="dial"
        style={{ background: `conic-gradient(var(--accent) ${Math.min(left / 3600, 1) * 360}deg, var(--line) 0)` }}
      />
      {cur ? (
        <>
          <div className="countdown">{clock(left)}</div>
          <b>{cur.text}</b>
          <small>{hhmm(cur.start_min)} – {hhmm(cur.end_min)}</small>
          <button className="primary" onClick={() => api.toggle(cur)}>완료</button>
        </>
      ) : (
        <>
          <b>지금 시간대에 배치된 작업이 없어요</b>
          <small>{next ? `다음 · ${hhmm(next.start_min)} ${next.text}` : 'Time Box에 작업을 배치하면 타이머가 시작돼요'}</small>
        </>
      )}
      {perm === 'default' && (
        <button className="ghost" onClick={() => Notification.requestPermission().then(setPerm)}>시작 알림 켜기</button>
      )}
    </section>
  )
}

function TimeGrid({ tasks, api, isToday, picked, clearPick }: {
  tasks: Task[]; api: Api; isToday: boolean; picked: string | null; clearPick: () => void
}) {
  const placed = tasks.filter(t => t.start_min != null)
  const hasDawn = placed.some(t => t.start_min! < DAWN)
  const [dawn, setDawn] = useState(false)
  const from = dawn || hasDawn ? 0 : DAWN
  const ref = useRef<HTMLDivElement>(null)
  const grab = useRef(0) // 블록을 잡은 지점이 블록 시작에서 몇 분 떨어졌는지
  const [resize, setResize] = useState<{ id: string; end: number } | null>(null)
  const endRef = useRef(0)
  const [nowMin, setNowMin] = useState(-1)

  useEffect(() => {
    const tick = () => setNowMin(new Date().getHours() * 60 + new Date().getMinutes())
    tick()
    const i = setInterval(tick, 60_000)
    return () => clearInterval(i)
  }, [])
  // 오늘이면 현재 시각이 카드 가운데 오도록 카드 안에서만 스크롤한다.
  useEffect(() => {
    const card = ref.current?.parentElement
    if (card && isToday && nowMin >= 0) card.scrollTop = ((nowMin - from) / 60) * H - card.clientHeight / 2
  }, [isToday, nowMin >= 0])

  const slotAt = (y: number) =>
    from + Math.floor((y - ref.current!.getBoundingClientRect().top) / (H / 2)) * 30

  const place = (id: string, start: number) => {
    const t = tasks.find(t => t.id === id)
    if (!t) return
    const len = t.start_min != null ? t.end_min! - t.start_min : 30
    start = Math.max(0, Math.min(start, 1440 - len))
    if (overlaps(tasks, start, start + len, id)) return
    api.update(id, { start_min: start, end_min: start + len })
  }

  useEffect(() => {
    if (!resize) return
    const t = tasks.find(t => t.id === resize.id)!
    const move = (e: PointerEvent) => {
      const end = Math.max(t.start_min! + 30, Math.min(1440, slotAt(e.clientY) + 30))
      if (overlaps(tasks, t.start_min!, end, t.id)) return
      endRef.current = end
      setResize({ id: t.id, end })
    }
    const up = () => {
      if (endRef.current !== t.end_min) api.update(t.id, { end_min: endRef.current })
      setResize(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [resize?.id])

  return (
    <section className="card grid-card">
      <button className="ghost dawn" disabled={hasDawn} onClick={() => setDawn(d => !d)}>
        {from === 0 ? '새벽 접기' : '00 – 04 펼치기'}
      </button>
      <div
        ref={ref}
        className={'timegrid' + (picked ? ' picking' : '')}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          place(e.dataTransfer.getData('text/plain'), slotAt(e.clientY) - grab.current)
          grab.current = 0
        }}
        onClick={e => {
          if (!picked) return
          place(picked, slotAt(e.clientY))
          clearPick()
        }}
      >
        {Array.from({ length: 24 - from / 60 }, (_, i) => (
          <div key={i} className="hour" style={{ height: H }}><span>{from / 60 + i}</span></div>
        ))}
        {placed.map(t => {
          const end = resize?.id === t.id ? resize.end : t.end_min!
          return (
            <div
              key={t.id}
              className={'block' + (t.is_done ? ' done' : '') + (t.is_top3 ? ' top' : '')}
              style={{ top: ((t.start_min! - from) / 60) * H, height: ((end - t.start_min!) / 60) * H }}
              draggable={!resize}
              onClick={e => e.stopPropagation()}
              onDragStart={e => {
                drag(t.id)(e)
                grab.current = slotAt(e.clientY) - t.start_min!
              }}
              onDragEnd={() => (grab.current = 0)}
            >
              <Check t={t} api={api} />
              <b>{t.is_top3 && '★ '}{t.text}</b>
              <small>{hhmm(t.start_min)} – {hhmm(end)}</small>
              <button
                className="x"
                aria-label={`시간 배치 해제: ${t.text}`}
                title="시간 배치 해제"
                onClick={() => api.update(t.id, { start_min: null, end_min: null })}
              >✕</button>
              <span
                className="resize"
                title="아래로 끌어 시간 늘리기"
                onPointerDown={e => {
                  e.preventDefault()
                  endRef.current = t.end_min!
                  setResize({ id: t.id, end: t.end_min! })
                }}
              />
            </div>
          )
        })}
        {isToday && nowMin >= from && <div className="now" style={{ top: ((nowMin - from) / 60) * H }} />}
      </div>
    </section>
  )
}

export default function DayView({ date, tasks, api }: { date: string; tasks: Task[]; api: Api }) {
  const [picked, setPicked] = useState<string | null>(null)
  const day = tasks.filter(t => t.scope === 'day' && t.period === date)
  const isToday = date === today()

  const carryOver = async () => {
    if (!confirm('지난 날짜의 미완료 할 일을 모두 오늘로 옮길까요? (시간 배치는 해제됩니다)')) return
    const { data, error } = await supabase
      .from('tasks')
      .update({ period: date, start_min: null, end_min: null })
      .eq('scope', 'day').lt('period', date).eq('is_done', false)
      .select('id')
    if (error) return alert('가져오지 못했어요: ' + error.message)
    alert(data.length ? `${data.length}개를 오늘로 가져왔어요.` : '가져올 미완료 할 일이 없어요.')
    api.reload()
  }

  return (
    <div className="cols">
      <aside>
        {isToday && <Timer tasks={day} api={api} />}
        <TaskList
          title="Brain Dump" scope="day" period={date} tasks={tasks} api={api}
          pickedId={picked} onPick={id => setPicked(p => (p === id ? null : id))}
        />
        {isToday && <button className="ghost" onClick={carryOver}>지난 미완료 가져오기</button>}
        <TaskList title="이번 주 목표" scope="week" period={weekStart(date)} tasks={tasks} api={api} placeholder="주간 목표를 적고 Enter" />
        <TaskList title="이번 달 목표" scope="month" period={monthStart(date)} tasks={tasks} api={api} placeholder="월간 목표를 적고 Enter" />
      </aside>
      <TimeGrid tasks={day} api={api} isToday={isToday} picked={picked} clearPick={() => setPicked(null)} />
    </div>
  )
}
