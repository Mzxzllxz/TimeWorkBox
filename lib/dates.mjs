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

/** [start, end) 구간이 다른 할 일의 시간 블록과 겹치는지. */
export const overlaps = (tasks, start, end, exceptId) =>
  tasks.some(t => t.id !== exceptId && t.start_min != null && start < t.end_min && t.start_min < end)
