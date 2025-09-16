import React from 'react'

type Props = { label: string; value: number | string; className?: string }

export default function KPIStat({ label, value, className = '' }: Props){
  return (
    <div className={`card ${className}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="kpi-value mt-2 text-slate-800">{value}</div>
    </div>
  )
}
