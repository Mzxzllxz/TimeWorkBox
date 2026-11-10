'use client'
import { createClient } from '@supabase/supabase-js'
import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export type Scope = 'day' | 'week' | 'month'
export type Task = {
  id: string
  user_id: string
  scope: Scope
  period: string
  text: string
  is_top3: boolean
  is_done: boolean
  completed_at: string | null
  start_min: number | null
  end_min: number | null
  created_at: string
}
export type Api = ReturnType<typeof useTasks>

/**
 * userId의 할 일 중 period가 [from, to]에 드는 것을 불러오고, 낙관적 갱신으로 수정한다.
 * readOnly(공유받은 남의 일정)면 수정 함수는 아무 일도 하지 않는다. 실제 차단은 DB의 RLS가 한다.
 */
export function useTasks(from: string, to: string, userId: string, readOnly = false) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const reloadRef = useRef(() => {})

  useEffect(() => {
    let live = true
    setTasks(ts => ts.filter(t => t.user_id === userId)) // 보는 계정이 바뀌면 이전 계정의 할 일을 바로 치운다
    const run = async () => {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('user_id', userId).gte('period', from).lte('period', to).order('created_at')
      if (!live) return
      setError(error ? error.message : '')
      if (data) setTasks(data)
    }
    run()
    reloadRef.current = run
    window.addEventListener('focus', run)
    return () => {
      live = false
      window.removeEventListener('focus', run)
    }
  }, [from, to, userId])

  const reload = () => reloadRef.current()
  // 저장 실패 시 화면을 서버 상태로 되돌린다.
  const settle = ({ error }: { error: { message: string } | null }) => {
    if (!error) return
    alert('저장에 실패했어요: ' + error.message)
    reload()
  }

  const add = async (t: Pick<Task, 'scope' | 'period' | 'text'>) => {
    const row: Task = {
      id: crypto.randomUUID(), user_id: userId, is_top3: false, is_done: false, completed_at: null,
      start_min: null, end_min: null, created_at: new Date().toISOString(), ...t,
    }
    setTasks(ts => [...ts, row])
    settle(await supabase.from('tasks').insert(row))
  }
  const update = async (id: string, patch: Partial<Task>) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
    settle(await supabase.from('tasks').update(patch).eq('id', id))
  }
  const remove = async (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id))
    settle(await supabase.from('tasks').delete().eq('id', id))
  }
  const toggle = (t: Task) => {
    if (!t.is_done)
      confetti({
        particleCount: 80, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true,
        colors: ['#1570ef', '#12b76a', '#f79009', '#f04438', '#ee46bc', '#9e77ed'],
      })
    return update(t.id, { is_done: !t.is_done, completed_at: t.is_done ? null : new Date().toISOString() })
  }

  const api = { tasks, error, reload, add, update, remove, toggle }
  const deny = async () => {}
  return readOnly ? { ...api, add: deny, update: deny, remove: deny, toggle: deny } as typeof api : api
}
