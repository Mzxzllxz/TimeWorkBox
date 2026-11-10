'use client'
import { useEffect, useRef, useState } from 'react'
import { addDays, addMonths, hhmm, monthStart, overlaps, segments, today, weekStart } from '@/lib/dates.mjs'
import { supabase, type Api, type Task } from '@/lib/useTasks'
import TaskList, { drag, dragging } from './TaskList'

const H = 52 // 한 시간(한 행) 높이(px)
const LABEL = 46 // 시각 라벨 폭(px). globals.css의 --label과 같아야 한다
const DAWN = 240 // 새벽을 접었을 때 그리드가 시작하는 시각(04:00)

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
const minuteOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** 60분 다이얼. 남은 시간만큼 채워지고, 시간이 줄면 0 → 45 → 30 → 15 눈금 순으로 비워진다. */
function Dial({ left }: { left: number | null }) {
  const filled = left == null ? 0 : Math.min(left / 3600, 1)
  const cut = 360 - 360 * filled
  return (
    <div className={'dial' + (left == null ? ' empty' : '')} role="img" aria-label={left == null ? '타이머 대기' : `남은 시간 ${clock(left)}`}>
      <div
        className="disc"
        style={left == null ? undefined : { background: `conic-gradient(var(--line) 0deg ${cut}deg, var(--accent) ${cut}deg 360deg)` }}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} className={i % 3 ? '' : 'major'} style={{ transform: `rotate(${i * 30}deg)` }} />
      ))}
      {[0, 45, 30, 15].map(m => (
        <span key={m} className={`lb lb${m}` + (left != null && filled >= (m ? m / 60 : 1) ? ' covered' : '')}>{m}</span>
      ))}
      <div className="knob" />
    </div>
  )
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
  const min = Math.floor(sec / 60)
  const placed = tasks.filter(t => t.start_min != null)
  const cur = placed.find(t => !t.is_done && t.start_min! * 60 <= sec && sec < t.end_min! * 60)
  // 진행 중인 블록이 없으면: 이미 시작한 블록 중 가장 늦게 끝나는 완료 블록을 결과로 보여준다.
  const done = cur ? undefined : placed.filter(t => t.is_done && t.start_min! <= min).sort((a, b) => b.end_min! - a.end_min!)[0]
  const next = cur ? undefined : placed.filter(t => !t.is_done && t.start_min! > min).sort((a, b) => a.start_min! - b.start_min!)[0]
  const shown = cur ?? done

  let focus = 0, early = 0
  if (done) {
    const len = done.end_min! - done.start_min!
    const at = done.completed_at ? minuteOfDay(done.completed_at) : done.end_min!
    focus = clamp(Math.round(at - done.start_min!), 1, len)
    early = clamp(Math.round(done.end_min! - at), 0, len)
  }

  // 블록이 시작된 직후 1분 안에만 알린다(새로고침할 때마다 울리지 않도록).
  useEffect(() => {
    if (cur && perm === 'granted' && sec - cur.start_min! * 60 < 60)
      new Notification(`시작: ${cur.text} ⏰`, { body: '지금 이 할 일에 집중할 시간이에요!' })
  }, [cur?.id, perm])

  return (
    <section className="card timer">
      {shown && (
        <div className={'status' + (done ? ' ok' : '')}>
          <i />
          <b>{cur ? '진행 중' : '완료'}</b>
          <small>{hhmm(shown.start_min)} – {hhmm(shown.end_min)}</small>
        </div>
      )}
      {done ? (
        <div className="dial complete" role="img" aria-label="완료">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <Dial left={cur ? cur.end_min! * 60 - sec : null} />
      )}
      {cur ? (
        <>
          <div className="countdown">{clock(cur.end_min! * 60 - sec)}</div>
          <b className="title">{cur.text}</b>
        </>
      ) : done ? (
        <>
          <div className="countdown ok">{focus}분 집중</div>
          {early >= 1 && <span className="badge">↑ {early}분 일찍 완료</span>}
          <span className="sub">{done.text}</span>
        </>
      ) : (
        <>
          <b className="empty-title">지금 시간대에 배치된 작업이 없어요</b>
          <span className="sub">Time Box에 작업을 배치하면 그 시간에 타이머가 시작돼요</span>
          {next && <span className="next">다음 · {hhmm(next.start_min)} {next.text}</span>}
        </>
      )}
      {done && next && (
        <div className="next-footer">다음 세션 <b>{hhmm(next.start_min)} · {next.text}</b></div>
      )}
      {cur && <button className="wide" onClick={() => api.toggle(cur)}>완료</button>}
      {perm === 'default' && (
        <button className="wide" onClick={() => Notification.requestPermission().then(setPerm)}>시작 알림 켜기</button>
      )}
    </section>
  )
}

/** 완료한 일간 할 일. 지금 화면의 할 일은 즉시 반영하고, 다른 날짜의 기록은 따로 불러온다. */
function History({ tasks, userId }: { tasks: Task[]; userId: string }) {
  const [old, setOld] = useState<Task[]>([])
  useEffect(() => {
    supabase
      .from('tasks').select('*').eq('user_id', userId).eq('scope', 'day').eq('is_done', true)
      .order('completed_at', { ascending: false }).limit(100)
      .then(({ data }) => data && setOld(data))
  }, [])

  const ids = new Set(tasks.map(t => t.id))
  const items = [...old.filter(t => !ids.has(t.id)), ...tasks.filter(t => t.scope === 'day' && t.is_done)]
    .sort((a, b) => +new Date(b.completed_at ?? 0) - +new Date(a.completed_at ?? 0))

  return (
    <details className="card history">
      <summary>히스토리 <small>{items.length}</small></summary>
      {items.map(t => {
        const d = new Date(t.completed_at ?? t.period)
        return (
          <div key={t.id} className="hist">
            <i>✓</i>
            <span>{t.text}</span>
            <small>{d.getMonth() + 1}월 {d.getDate()}일</small>
          </div>
        )
      })}
      {!items.length && <p className="sub">완료한 할 일이 여기에 쌓여요</p>}
    </details>
  )
}

type Preview = { start: number; end: number; bad: boolean }

function TimeGrid({ tasks, api, isToday, picked, clearPick }: {
  tasks: Task[]; api: Api; isToday: boolean; picked: string | null; clearPick: () => void
}) {
  const placed = tasks.filter(t => t.start_min != null)
  const hasDawn = placed.some(t => t.start_min! < DAWN)
  const [dawn, setDawn] = useState(false)
  const from = dawn || hasDawn ? 0 : DAWN
  const firstHour = from / 60
  const ref = useRef<HTMLDivElement>(null)
  const grab = useRef(0) // 블록을 잡은 칸이 블록 시작에서 몇 분 떨어졌는지
  const endRef = useRef(0)
  const [resize, setResize] = useState<{ id: string; end: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
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
    if (card && isToday && nowMin >= 0) card.scrollTop = (nowMin / 60 - firstHour) * H - card.clientHeight / 2
  }, [isToday, nowMin >= 0])

  // 포인터 위치 → 30분 칸의 시작(분). 세로 = 시(행), 가로 = 왼쪽 :00 / 오른쪽 :30
  const slotAt = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect()
    const hour = clamp(firstHour + Math.floor((y - r.top) / H), firstHour, 23)
    return hour * 60 + (x >= r.left + LABEL + (r.width - LABEL) / 2 ? 30 : 0)
  }
  const fit = (id: string, start: number): Preview | null => {
    const t = tasks.find(t => t.id === id)
    if (!t) return null
    const len = t.start_min != null ? t.end_min! - t.start_min : 30
    start = clamp(start, from, 1440 - len)
    return { start, end: start + len, bad: overlaps(tasks, start, start + len, id) }
  }
  const place = (id: string, start: number) => {
    const f = fit(id, start)
    if (f && !f.bad) api.update(id, { start_min: f.start, end_min: f.end })
  }

  useEffect(() => {
    if (!resize) return
    const t = tasks.find(t => t.id === resize.id)!
    const move = (e: PointerEvent) => {
      const end = clamp(slotAt(e.clientX, e.clientY) + 30, t.start_min! + 30, 1440)
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

  const box = (s: { hour: number; span: number }) => ({ top: (s.hour - firstHour) * H + 2, height: s.span * H - 4 })
  const rank = new Map(tasks.filter(t => t.is_top3).map((t, i) => [t.id, i + 1]))

  return (
    <section className="card grid-card">
      <div className="tg-head"><span>:00</span><span>:30</span></div>
      <button className={from ? 'tg-dawn' : 'tg-dawn open'} disabled={hasDawn} onClick={() => setDawn(d => !d)}>
        {from ? '⌄ 00 – 04' : '⌃ 새벽 접기'}
      </button>
      <div
        ref={ref}
        className={'timegrid' + (picked ? ' picking' : '')}
        onDragOver={e => {
          e.preventDefault()
          const f = fit(dragging.id, slotAt(e.clientX, e.clientY) - grab.current)
          setPreview(p => (p && f && p.start === f.start && p.bad === f.bad ? p : f))
        }}
        onDragLeave={e => !e.currentTarget.contains(e.relatedTarget as Node) && setPreview(null)}
        onDrop={e => {
          e.preventDefault()
          place(e.dataTransfer.getData('text/plain'), slotAt(e.clientX, e.clientY) - grab.current)
          grab.current = 0
          setPreview(null)
        }}
        onClick={e => {
          if (!picked) return
          place(picked, slotAt(e.clientX, e.clientY))
          clearPick()
        }}
      >
        {Array.from({ length: 24 - firstHour }, (_, i) => (
          <div key={i} className="tg-row"><span>{firstHour + i}</span></div>
        ))}
        {placed.flatMap(t => {
          const end = resize?.id === t.id ? resize.end : t.end_min!
          const segs = segments(t.start_min, end)
          const active = isToday && !t.is_done && nowMin >= t.start_min! && nowMin < end
          const cls = 'seg'
            + (rank.has(t.id) ? ' top' : '') + (active ? ' active' : '') + (t.is_done ? ' done' : '')
            + (isToday && nowMin >= end ? ' past' : '') + (hover === t.id || resize?.id === t.id ? ' hov' : '')
          return segs.map((s, i) => (
            <div
              key={t.id + s.hour}
              className={`${cls} ${s.kind}`}
              style={box(s)}
              draggable={!resize}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(h => (h === t.id ? null : h))}
              onClick={e => e.stopPropagation()}
              onDragStart={e => {
                drag(t.id)(e)
                grab.current = slotAt(e.clientX, e.clientY) - t.start_min!
              }}
              onDragEnd={() => {
                grab.current = 0
                setPreview(null)
              }}
            >
              {i === 0 && (
                <>
                  {rank.has(t.id) && <span className="rank">{rank.get(t.id)}</span>}
                  <b>{t.text}</b>
                  {active
                    ? <small className={'remain' + (end - nowMin <= 5 ? ' urgent' : '')}>{end - nowMin}분 남음</small>
                    : <small className="range">{hhmm(t.start_min)} – {hhmm(end)}</small>}
                  <button
                    className="x"
                    aria-label={`시간 배치 해제: ${t.text}`}
                    title="시간 배치 해제"
                    onClick={() => api.update(t.id, { start_min: null, end_min: null })}
                  >✕</button>
                </>
              )}
              {i === segs.length - 1 && (
                <span
                  className="resize"
                  title="아래·오른쪽으로 드래그해 시간 늘리기"
                  onPointerDown={e => {
                    e.preventDefault()
                    endRef.current = t.end_min!
                    setResize({ id: t.id, end: t.end_min! })
                  }}
                />
              )}
            </div>
          ))
        })}
        {preview && segments(preview.start, preview.end).map(s => (
          <div key={s.hour} className={`tg-preview ${s.kind}` + (preview.bad ? ' bad' : '')} style={box(s)} />
        ))}
        {isToday && nowMin >= from && <div className="now" style={{ top: (nowMin / 60 - firstHour) * H }} />}
      </div>
    </section>
  )
}

export default function DayView({ date, tasks, api, userId, readOnly }: {
  date: string; tasks: Task[]; api: Api; userId: string; readOnly: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const day = tasks.filter(t => t.scope === 'day' && t.period === date)
  const isToday = date === today()

  const carryOver = async () => {
    if (!confirm('지난 날짜의 미완료 할 일을 모두 오늘로 옮길까요? (시간 배치는 해제됩니다)')) return
    const { data, error } = await supabase
      .from('tasks')
      .update({ period: date, start_min: null, end_min: null })
      .eq('user_id', userId).eq('scope', 'day').lt('period', date).eq('is_done', false)
      .select('id')
    if (error) return alert('가져오지 못했어요: ' + error.message)
    alert(data.length ? `${data.length}개를 오늘로 가져왔어요.` : '가져올 미완료 할 일이 없어요.')
    api.reload()
  }

  return (
    <div className="cols">
      <aside>
        <Timer tasks={isToday ? day : []} api={api} />
        <TaskList
          title="일일 목표" scope="day" period={date} tasks={tasks} api={api}
          pickedId={picked} onPick={id => setPicked(p => (p === id ? null : id))}
        />
        <History tasks={tasks} userId={userId} />
        {isToday && !readOnly && <button className="ghost" onClick={carryOver}>지난 미완료 가져오기</button>}
        <TaskList title="이번 주 목표" scope="week" period={weekStart(date)} tasks={tasks} api={api} syncDays={[weekStart(date), addDays(weekStart(date), 6)]} placeholder="주간 목표를 적고 Enter" />
        <TaskList title="이번 달 목표" scope="month" period={monthStart(date)} tasks={tasks} api={api} syncDays={[monthStart(date), addDays(addMonths(date, 1), -1)]} placeholder="월간 목표를 적고 Enter" />
      </aside>
      <TimeGrid tasks={day} api={api} isToday={isToday} picked={picked} clearPick={() => setPicked(null)} />
    </div>
  )
}
