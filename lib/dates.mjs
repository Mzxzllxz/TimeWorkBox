// 로컬 날짜 문자열(YYYY-MM-DD)과 분 단위 시간 유틸. 주는 월요일에 시작한다.
const pad = n => String(n).padStart(2, '0')

export const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = s => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => fmt(new Date())
export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
export const monthStart = s => s.slice(0, 8) + '01'
export const addMonths = (s, n) => {
  const d = parse(s)
  return fmt(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
export const weekStart = s => addDays(s, -((parse(s).getDay() + 6) % 7))
export const weekDays = s => Array.from({ length: 7 }, (_, i) => addDays(weekStart(s), i))

/** 해당 월을 덮는 주(월요일 시작)들의 날짜를 7개씩 묶어 돌려준다. */
export const monthGrid = s => {
  const lastDay = addDays(addMonths(s, 1), -1)
  const weeks = []
  for (let w = weekStart(monthStart(s)); w <= lastDay; w = addDays(w, 7)) weeks.push(weekDays(w))
  return weeks
}

export const hhmm = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

/**
 * 가로형 타임 테이블용: [start, end) 블록을 시간 행 단위 조각으로 나눈다.
 * 한 행은 왼쪽(:00)·오른쪽(:30) 두 칸. 두 칸을 다 채운 행이 이어지면 한 조각(span)으로 합친다.
 */
export const segments = (start, end) => {
  const out = []
  for (let h = Math.floor(start / 60); h <= Math.floor((end - 1) / 60); h++) {
    const left = start <= h * 60 && end >= h * 60 + 30
    const right = start <= h * 60 + 30 && end >= h * 60 + 60
    const kind = left && right ? 'full' : left ? 'left' : 'right'
    const last = out.at(-1)
    if (kind === 'full' && last?.kind === 'full' && last.hour + last.span === h) last.span++
    else out.push({ hour: h, span: 1, kind })
  }
  return out
}

/** [start, end) 구간이 다른 할 일의 시간 블록과 겹치는지. */
export const overlaps = (tasks, start, end, exceptId) =>
  tasks.some(t => t.id !== exceptId && t.start_min != null && start < t.end_min && t.start_min < end)
