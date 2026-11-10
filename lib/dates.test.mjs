import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, addMonths, hhmm, monthGrid, monthStart, overlaps, weekDays, weekStart } from './dates.mjs'

test('날짜 계산', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-03-01', -1), '2028-02-29') // 윤년
  assert.equal(monthStart('2026-11-10'), '2026-11-01')
  assert.equal(addMonths('2026-12-31', 1), '2027-01-01')
  assert.equal(addMonths('2026-01-15', -1), '2025-12-01')
})

test('주는 월요일에 시작한다', () => {
  assert.equal(weekStart('2026-11-10'), '2026-11-09') // 화 → 월
  assert.equal(weekStart('2026-11-09'), '2026-11-09') // 월 → 그대로
  assert.equal(weekStart('2026-11-15'), '2026-11-09') // 일 → 그 주 월요일
  assert.deepEqual(weekDays('2026-11-15').at(-1), '2026-11-15')
})

test('월 달력은 월 전체를 덮는다', () => {
  const nov = monthGrid('2026-11-10') // 11/1 = 일요일, 11/30 = 월요일
  assert.equal(nov[0][0], '2026-10-26')
  assert.equal(nov.at(-1)[6], '2026-12-06')
  assert.equal(nov.length, 6)
  const feb = monthGrid('2027-02-01') // 2/1 = 월요일, 28일 → 정확히 4주
  assert.equal(feb.length, 4)
  assert.equal(feb[0][0], '2027-02-01')
  assert.equal(feb[3][6], '2027-02-28')
})

test('시간 표기와 겹침 판정', () => {
  assert.equal(hhmm(570), '09:30')
  const tasks = [{ id: 'a', start_min: 540, end_min: 600 }, { id: 'b', start_min: null, end_min: null }]
  assert.equal(overlaps(tasks, 600, 630), false) // 맞닿는 것은 겹침이 아님
  assert.equal(overlaps(tasks, 570, 630), true)
  assert.equal(overlaps(tasks, 500, 700), true) // 완전히 감싸는 경우
  assert.equal(overlaps(tasks, 570, 630, 'a'), false) // 자기 자신 제외
})
