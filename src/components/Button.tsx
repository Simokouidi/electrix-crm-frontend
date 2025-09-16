import React from 'react'

export default function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>){
  // if caller provided explicit background or text color classes, don't apply defaults for those
  const hasBg = /(?:\bbg-[-\w/]+\b)/.test(className)
  const hasText = /(?:\btext-[-\w/]+\b)/.test(className)

  const base = 'px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const bg = hasBg ? '' : 'bg-indigo-600 hover:bg-indigo-500'
  const text = hasText ? '' : 'text-white'

  return (
    <button {...props} className={`${base} ${bg} ${text} ${className}`.trim()}>
      {children}
    </button>
  )
}
