import React, { useState, useMemo } from 'react'

type Props = {
  value?: string | null
  onSelect: (iso: string | null) => void
  onCancel?: () => void
}

function startOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0) }

export default function CalendarPicker({ value, onSelect, onCancel }: Props){
  const start = value ? new Date(value) : new Date()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(start))

  const weeks = useMemo(() => {
    const first = startOfMonth(currentMonth)
    const last = endOfMonth(currentMonth)
    const days: Date[] = []
    const startDay = first.getDay()
    for(let i = 0; i < startDay; i++) days.push(new Date(first.getFullYear(), first.getMonth(), first.getDate() - startDay + i))
    for(let d = 1; d <= last.getDate(); d++) days.push(new Date(first.getFullYear(), first.getMonth(), d))
    while(days.length % 7 !== 0) days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + (days.length % 7)))
    const rows: Date[][] = []
    for(let i = 0; i < days.length; i+=7) rows.push(days.slice(i, i+7))
    return rows
  }, [currentMonth])

  function selectDate(d: Date){
    const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    onSelect(iso)
  }

  return (
    <div className="w-64 bg-white border rounded shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{currentMonth.toLocaleString(undefined, { month: 'long' })} {currentMonth.getFullYear()}</div>
        <div className="flex gap-2">
          <button onClick={()=>setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))} className="text-slate-600">↑</button>
          <button onClick={()=>setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))} className="text-slate-600">↓</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm text-slate-600 mb-2">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=> <div key={x} className="py-1">{x}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weeks.flat().map((d, idx) => {
          const isCurrentMonth = d.getMonth() === currentMonth.getMonth()
          const isToday = new Date().toDateString() === d.toDateString()
          return (
            <button key={idx} onClick={() => selectDate(d)} className={`py-2 rounded ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'} ${isToday ? 'bg-slate-100 rounded-md font-semibold' : ''}`}>
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="flex gap-4">
          <button className="text-sky-600" onClick={() => onSelect(null)}>Clear</button>
          <button className="text-slate-500" onClick={() => onCancel && onCancel()}>Cancel</button>
        </div>
        <button className="text-sky-600" onClick={() => { const t = new Date(); onSelect(new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString()) }}>Today</button>
      </div>
    </div>
  )
}
