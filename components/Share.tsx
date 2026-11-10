'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/useTasks'

export type Profile = { id: string; email: string; name: string; color: string }
export type Share = { owner_id: string; viewer_id: string }
export const nameOf = (p?: Profile) => (p ? p.name || p.email : '알 수 없는 계정')

/** 공유 설정: 내 표시 이름·색, 이메일로 공유 추가, 공유 해제. */
export default function ShareDialog({ me, people, shares, reload }: {
  me: string; people: Profile[]; shares: Share[]; reload: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [msg, setMsg] = useState('')
  const mine = people.find(p => p.id === me)
  const who = (id: string) => people.find(p => p.id === id)

  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await q
    setMsg(error ? error.message : '')
    reload()
    return !error
  }
  const person = (id: string, action: string, s: Share) => (
    <div key={id} className="row">
      <i className="dot" style={{ background: who(id)?.color }} />
      <span>{nameOf(who(id))}</span>
      <button className="ghost" onClick={() => run(supabase.from('shares').delete().eq('owner_id', s.owner_id).eq('viewer_id', s.viewer_id))}>
        {action}
      </button>
    </div>
  )
  const iShare = shares.filter(s => s.owner_id === me)
  const sharedToMe = shares.filter(s => s.viewer_id === me)

  return (
    <>
      <button className="ghost" onClick={() => ref.current?.showModal()}>공유</button>
      <dialog ref={ref} className="card share" aria-label="공유 설정">
        <h3>공유 설정<button className="x" aria-label="닫기" onClick={() => ref.current?.close()}>✕</button></h3>

        <label>내 표시 이름
          <input
            key={mine?.name} defaultValue={mine?.name} maxLength={40} placeholder={mine?.email}
            onBlur={e => {
              const name = e.target.value.trim()
              if (mine && name !== mine.name) run(supabase.from('profiles').update({ name }).eq('id', me))
            }}
          />
        </label>
        <label>내 일정 색 (다른 사람이 내 일정을 볼 때 이 색으로 보여요)
          <input
            type="color" key={mine?.color} defaultValue={mine?.color}
            onBlur={e => mine && e.target.value !== mine.color && run(supabase.from('profiles').update({ color: e.target.value }).eq('id', me))}
          />
        </label>

        <h4>내 일정을 볼 수 있는 계정</h4>
        {iShare.map(s => person(s.viewer_id, '공유 해제', s))}
        {!iShare.length && <p className="sub">아직 아무에게도 공유하지 않았어요</p>}
        <form
          onSubmit={async e => {
            e.preventDefault()
            const el = e.currentTarget.elements.namedItem('email') as HTMLInputElement
            if (await run(supabase.rpc('share_with', { target_email: el.value }))) el.value = ''
          }}
        >
          <input name="email" type="email" required placeholder="공유할 계정의 이메일" aria-label="공유할 계정의 이메일" />
          <button className="primary">공유</button>
        </form>
        <p className="sub">상대는 내 일정을 볼 수만 있고 고칠 수 없어요.</p>

        <h4>나에게 일정을 공유한 계정</h4>
        {sharedToMe.map(s => person(s.owner_id, '그만 보기', s))}
        {!sharedToMe.length && <p className="sub">아직 공유받은 일정이 없어요</p>}

        {msg && <p role="alert">{msg}</p>}
      </dialog>
    </>
  )
}
