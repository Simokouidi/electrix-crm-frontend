import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import Logo from '../Images/Logo_copy2.png'
import { User2, Lock, ArrowRight, Quote } from 'lucide-react'
import BgImage from '../Images/Background.png'

export default function LoginPage(){
  const { login } = useStore()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [debugStatus, setDebugStatus] = useState<string | null>(null)
  const [mounted,setMounted] = useState(false)

  useEffect(()=>{ requestAnimationFrame(()=>setMounted(true)) },[])

  async function submit(e?: React.FormEvent){
    e?.preventDefault()
    setError(null)
    try{
      console.debug('[LoginPage] submitting', { username, password })
      setDebugStatus('Submitting...')
      const ok = await login(username, password)
      console.debug('[LoginPage] login result', ok)
      setDebugStatus(ok ? 'Auth success (client)' : 'Auth failed (client)')
      if(ok){ nav('/dashboard') } else { setError('Invalid credentials') }
    }catch(err){
      console.error('Login error', err)
      setDebugStatus('Login exception: ' + String(err))
      setError('Login failed')
    }
  }

  // Rotating inspirational quotes (right panel)
  const quotes = useMemo(() => [
    { text: 'If everyone is moving forward together, then success takes care of itself.', author: 'Henry Ford' },
    { text: 'What gets measured gets improved.', author: 'Peter Drucker' },
    { text: 'Data beats emotions.', author: 'Sean Rad' },
    { text: 'In God we trust; all others must bring data.', author: 'W. Edwards Deming' },
    { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' }
  ], [])
  const [qIdx, setQIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setQIdx(i => (i + 1) % quotes.length), 7000)
    return () => clearInterval(id)
  }, [quotes.length])

  return (
  <div className="min-h-screen w-full" style={{ background: 'radial-gradient(1200px 800px at 10% 10%, rgba(99,102,241,0.12), rgba(0,0,0,0)), linear-gradient(135deg,#0b1220 0%, #0f172a 40%, #111827 100%)' }}>
      {/* Centering wrapper */}
      <div className={`min-h-screen grid place-items-center px-4 sm:px-6 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        {/* Framed container (rounded, shadow, subtle border) */}
        <div className="relative w-full max-w-6xl rounded-[28px] overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_40px_100px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Login panel */}
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-8">
                <img src={Logo} alt="ELECTRIX" className="w-10 h-10 object-contain" />
                <div>
                  <div className="text-xl font-bold text-white tracking-tight">ELECTRIX</div>
                  <div className="text-xs text-white/60">Signal‑to‑Action AI & Data Analytics</div>
                </div>
              </div>

              <div className="max-w-md">
                <h1 className="text-3xl md:text-4xl font-bold text-white">Welcome back.</h1>
                <p className="mt-2 text-slate-300">Access your ELECTRIX CRM workspace to manage clients, activities, and team performance.</p>

                <form onSubmit={submit} className="mt-8 space-y-5">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">Username</label>
                    <div className="mt-2 relative">
                      <User2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input
                        value={username}
                        onChange={e=>setUsername(e.target.value)}
                        placeholder="name@electrixspace.com"
                        autoFocus
                        className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/90 text-slate-900 placeholder-slate-500 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:border-indigo-400 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">Password</label>
                    <div className="mt-2 relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input
                        type="password"
                        value={password}
                        onChange={e=>setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/90 text-slate-900 placeholder-slate-500 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:border-indigo-400 transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button type="button" className="text-white/70 hover:text-white">Forgot password?</button>
                    <div className="text-white/50">Internal use only</div>
                  </div>

                  {error && <div className="text-sm text-rose-400">{error}</div>}
                  {debugStatus && <div className="text-xs text-yellow-300 mt-1">Debug: {debugStatus}</div>}

                  <button
                    type="submit"
                    aria-label="Log in to ELECTRIX CRM"
                    className="group w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:shadow-[0_12px_40px_rgba(99,102,241,0.45),0_0_18px_rgba(139,92,246,0.35)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40 active:translate-y-0"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      Log in
                      <ArrowRight className="opacity-90 group-hover:translate-x-0.5 transition-transform" size={18} />
                    </span>
                  </button>

                  <div className="pt-2 text-center text-sm text-white/60">© ELECTRIX 2025. All rights reserved.</div>
                </form>
              </div>
            </div>

            {/* Right: Decorative panel with quote carousel within the frame */}
            <div className="relative hidden lg:flex items-center justify-center">
              {/* Background image with cover fit */}
              <div className="absolute inset-0">
                <img src={BgImage} alt="Background" className="w-full h-full object-cover" />
              </div>
              {/* Overlay gradients to match brand and ensure legibility */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(2,6,23,0.4) 0%, rgba(2,6,23,0.15) 40%, rgba(2,6,23,0.4) 100%), radial-gradient(1200px 600px at 60% 30%, rgba(99,102,241,0.14), rgba(0,0,0,0))' }} />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\' viewBox=\'0 0 40 40\'><g fill=\'none\' stroke=\'rgba(255,255,255,0.04)\' stroke-width=\'1\'><path d=\'M0 20 H40\'/><path d=\'M20 0 V40\'/></g></svg>')] opacity-40" />

              {/* Glass quote card centered */}
              <div className="relative z-10 w-[min(560px,80%)] bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6">
                <div className="flex items-center gap-3 text-white/80">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                    <Quote size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wide">Inspiration</div>
                </div>
                <div className="mt-3 text-white/90 text-xl md:text-2xl leading-snug">
                  “{quotes[qIdx].text}”
                </div>
                <div className="mt-2 text-sm text-white/70">— {quotes[qIdx].author}</div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setQIdx(i => (i + 1) % quotes.length)}
                    className="px-3 py-1.5 rounded-full text-sm text-white/90 bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    Next quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Soft base drop shadow ellipse for a grounded, premium look */}
        <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 w-[60vw] max-w-[900px] h-20 rounded-[50%] blur-2xl opacity-30" style={{ background: 'radial-gradient(50% 60% at 50% 50%, rgba(0,0,0,0.55), rgba(0,0,0,0))' }} />
      </div>
    </div>
  )
}
