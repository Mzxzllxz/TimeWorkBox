'use client'
import { Fragment, type DragEvent } from 'react'
import { hhmm, parse } from '@/lib/dates.mjs'
import type { Api, Scope, Task } from '@/lib/useTasks'

export function AddInput({ onAdd, placeholder }: { onAdd: (text: string) => void; placeholder: string }) {
  return (
    <input
      className="add"
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={500}
      onKeyDown={e => {
        const el = e.currentTarget
        const text = el.value.trim()
        // isComposing: 한글 조합 중 Enter가 두 번 처리되는 것을 막는다.
        if (e.key !== 'Enter' || e.nativeEvent.isComposing || !text) return
        onAdd(text)
        el.value = ''
      }}
    />
  )
}

export function Check({ t, api }: { t: Task; api: Api }) {
  return (
    <button
      className={'check' + (t.is_done ? ' on' : '')}
      role="checkbox"
      aria-checked={t.is_done}
      aria-label={`완료: ${t.text}`}
      onClick={() => api.toggle(t)}
    >
      {t.is_done && '✓'}
    </button>
  )
}

/** 지금 끌고 있는 할 일. dragover 중에는 dataTransfer를 읽을 수 없어서 미리보기용으로 따로 둔다. */
export const dragging = { id: '' }
export const drag = (id: string) => (e: DragEvent) => {
  dragging.id = id
  e.dataTransfer.setData('text/plain', id)
}

type Props = {
  title: string
  scope: Scope
  period: string
  tasks: Task[]
  api: Api
  placeholder?: string
  /** 주어지면 Time Box에 놓을 수 있는 손잡이를 보여준다. */
  onPick?: (id: string) => void
  pickedId?: string | null
  /** [시작일, 종료일]. 이 기간의 일일 목표를 같은 카드에 함께 보여준다(같은 데이터라 어디서 고쳐도 반영된다). */
  syncDays?: [string, string]
}

export default function TaskList({ title, scope, period, tasks, api, placeholder, onPick, pickedId, syncDays }: Props) {
  const list = tasks
    .filter(t => t.scope === scope && t.period === period)
    .sort((a, b) => +b.is_top3 - +a.is_top3)
  const synced = syncDays
    ? tasks.filter(t => t.scope === 'day' && t.period >= syncDays[0] && t.period <= syncDays[1]).sort((a, b) => a.period.localeCompare(b.period))
    : []
  const all = [...list, ...synced]
  const top3Full = list.filter(t => t.is_top3).length >= 3

  return (
    <section className="card">
      <h3>
        {title}
        <small>{all.filter(t => t.is_done).length}/{all.length}</small>
      </h3>
      {all.map((t, i) => (
        <Fragment key={t.id}>
        {i === list.length && <p className="sub synced">일일 목표에서</p>}
        <div className={'row' + (t.is_done ? ' done' : '') + (pickedId === t.id ? ' picked' : '')}>
          {onPick && (
            <span
              className="grip"
              role="button"
              tabIndex={0}
              draggable
              title="Time Box로 드래그하거나, 누른 뒤 원하는 시간을 누르세요"
              aria-label={`시간 배치: ${t.text}`}
              aria-pressed={pickedId === t.id}
              onClick={() => onPick(t.id)}
              onKeyDown={e => e.key === 'Enter' && onPick(t.id)}
              onDragStart={e => {
                drag(t.id)(e)
                e.dataTransfer.setDragImage(e.currentTarget.parentElement!, 0, 0)
              }}
            >
              ⠿
            </span>
          )}
          <Check t={t} api={api} />
          <input
            key={t.text}
            defaultValue={t.text}
            maxLength={500}
            aria-label="할 일"
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
            onBlur={e => {
              const text = e.target.value.trim()
              if (!text) api.remove(t.id)
              else if (text !== t.text) api.update(t.id, { text })
            }}
          />
          {i >= list.length
            ? <small className="time">{parse(t.period).getMonth() + 1}.{parse(t.period).getDate()}</small>
            : t.start_min != null && <small className="time">{hhmm(t.start_min)}</small>}
          {i < list.length && <button
            className={'star' + (t.is_top3 ? ' on' : '')}
            aria-pressed={t.is_top3}
            aria-label="Top 3"
            title={t.is_top3 ? 'Top 3에서 빼기' : top3Full ? 'Top 3는 3개까지' : 'Top 3로 지정'}
            disabled={!t.is_top3 && top3Full}
            onClick={() => api.update(t.id, { is_top3: !t.is_top3 })}
          >
            ★
          </button>}
          <button className="x" aria-label={`삭제: ${t.text}`} onClick={() => api.remove(t.id)}>✕</button>
        </div>
        </Fragment>
      ))}
      <AddInput placeholder={placeholder ?? '할 일을 적고 Enter'} onAdd={text => api.add({ scope, period, text })} />
    </section>
  )
}
