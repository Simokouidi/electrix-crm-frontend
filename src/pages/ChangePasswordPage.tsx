import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../Images/Logo_copy2.png'

export default function ChangePasswordPage(){
  const [mounted,setMounted] = useState(false)
  useEffect(()=>{ requestAnimationFrame(()=>setMounted(true)) },[])

  const [email, setEmail] = useState<string>(()=>{
    try{ const u = new URL(window.location.href); return u.searchParams.get('email') || '' }catch{ return '' }
  })
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apiBase = (import.meta as any)?.env?.VITE_API_URL || (window.location.port === '4000' ? '' : 'http://127.0.0.1:4000')
  async function submit(e?: React.FormEvent){
    e?.preventDefault()
    setErr(null); setMsg(null)
    if(!email) return setErr('Email is required')
    if(!next || next.length < 8) return setErr('New password must be at least 8 characters')
    if(next !== confirm) return setErr('Passwords do not match')
    setBusy(true)
    try{
      const res = await fetch(`${apiBase}/api/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, current, next }) })
      const j = await res.json().catch(()=>null)
      if(!res.ok){ return setErr(j?.error || j?.message || 'Failed to change password') }
      setMsg('Password updated successfully — you can now sign in with your new password.')
      setCurrent(''); setNext(''); setConfirm('')
    }catch{
      setErr('Network error — please try again later')
    }finally{ setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b,#334155)' }}>
      <div className={`w-full max-w-xl p-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="relative bg-white/6 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/6" style={{ boxShadow: '0 10px 30px rgba(2,6,23,0.6), inset 0 1px 0 rgba(255,255,255,0.02)' }}>

          {/* Logo centered */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-400 flex items-center justify-center shadow-xl ring-4 ring-indigo-500/20">
              <img src={Logo} alt="ELECTRIX" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white">ELECTRIX</h1>
            <div className="mt-1 text-sm italic text-white/70">Signal‑to‑Action AI & Data Analytics</div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <label className="text-sm text-white/70">Email</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                <input
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-sm text-white/70">Current password</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input
                  type="password"
                  value={current}
                  onChange={e=>setCurrent(e.target.value)}
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-sm text-white/70">New password</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input
                  type="password"
                  value={next}
                  onChange={e=>setNext(e.target.value)}
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-sm text-white/70">Confirm new password</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={e=>setConfirm(e.target.value)}
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div />
              <div className="text-white/60 text-sm">Secure password 🔒</div>
            </div>

            {err && <div className="text-sm text-rose-400">{err}</div>}
            {msg && <div className="text-sm text-emerald-300">{msg}</div>}

            <div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:scale-105 transform transition-shadow shadow-lg disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save password'}
              </button>
            </div>

            <div className="text-center mt-2">
              <Link to="/login" className="text-sm text-white/70 hover:text-white">Back to login</Link>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">© 2025 ELECTRIX. All rights reserved.</div>
        </div>
      </div>
    </div>
  )
}
