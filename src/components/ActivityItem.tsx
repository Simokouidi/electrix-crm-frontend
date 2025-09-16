import React from 'react'
import Avatar from './Avatar'
import { ChevronRight } from 'lucide-react'

export default function ActivityItem({ actorName, text, time }: { actorName: string; text: string; time?: string }){
  return (
    <div className="flex items-center justify-between card my-2 p-3 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3">
        <Avatar name={actorName} />
        <div>
          <div><span className="font-semibold">{actorName}</span> <span className="text-slate-600">{text}</span></div>
          <div className="text-xs text-slate-400 mt-1">{time || 'now'}</div>
        </div>
      </div>
      <div className="text-slate-400"><ChevronRight size={18} /></div>
    </div>
  )
}
