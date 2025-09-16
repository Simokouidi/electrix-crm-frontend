import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import Logo from '../Images/Logo_copy2.png'

export default function LoginPage(){
  const { login } = useStore()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mounted,setMounted] = useState(false)

  useEffect(()=>{ requestAnimationFrame(()=>setMounted(true)) },[])

  function submit(e?: React.FormEvent){
    e?.preventDefault()
    const ok = login(username, password)
    if(ok){ nav('/dashboard') } else { setError('Invalid credentials') }
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
              <label className="text-sm text-white/70">Username</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                <input
                  value={username}
                  onChange={e=>setUsername(e.target.value)}
                  placeholder=""
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-sm text-white/70">Password</label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder=""
                  className="w-full pl-11 pr-3 py-3 rounded-xl bg-white text-black placeholder-black/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-white/70 hover:text-white">Forgot password?</button>
              <div className="text-white/60 text-sm">Secure login 🔒</div>
            </div>

            {error && <div className="text-sm text-rose-400">{error}</div>}

            <div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:scale-105 transform transition-shadow shadow-lg"
              >
                Sign in
              </button>
            </div>

            <div className="text-center mt-2">
              <a className="text-sm text-white/70 hover:text-white" href="#">Request access</a>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">© 2025 ELECTRIX. All rights reserved.</div>
        </div>
      </div>
    </div>
  )
}
