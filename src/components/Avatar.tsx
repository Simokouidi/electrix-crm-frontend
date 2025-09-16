import React from 'react'

export default function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }){
  const initial = name?.charAt(0).toUpperCase() || '?'
  const bg = `bg-indigo-200`
  return (
    <div className={`rounded-full flex items-center justify-center text-sm font-medium ${bg}`} style={{ width: size, height: size }} aria-hidden>
      {src ? <img alt={name} src={src} className="w-full h-full rounded-full object-cover"/> : <span>{initial}</span>}
    </div>
  )
}
