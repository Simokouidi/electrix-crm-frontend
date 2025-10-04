import React from 'react'

export default function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>){
  // if caller provided explicit background or text color classes, don't apply defaults for those
  const hasBg = /(?:\bbg-[-\w/]+\b)/.test(className)
  const hasText = /(?:\btext-[-\w/]+\b)/.test(className)

  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold focus:outline-none focus:ring-4 focus:ring-[#8B5CF6]/40 transition-all duration-200'
  const bg = hasBg ? '' : 'text-white bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] shadow-[0_6px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_10px_30px_rgba(99,102,241,0.45),0_0_12px_rgba(139,92,246,0.35)] hover:-translate-y-0.5'
  const text = hasText ? '' : ''

  return (
    <button {...props} className={`${base} ${bg} ${text} ${className}`.trim()}>
      {children}
    </button>
  )
}
