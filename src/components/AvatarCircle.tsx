import React from 'react'

type Props = {
  name: string
  avatarUrl?: string
  unread?: number
  online?: boolean
  onClick?: () => void
}

export default function AvatarCircle({ name, avatarUrl, unread = 0, online = true, onClick }: Props){
  const initials = name ? name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() : ''
  return (
    <button
      aria-label="Account menu"
      title={name}
      onClick={onClick}
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {avatarUrl ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={avatarUrl} alt={`${name} avatar`} className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-slate-800">{initials}</span>
      )}

      {/* presence dot */}
      <span
        aria-hidden
        className={`absolute right-0 bottom-0 block w-2.5 h-2.5 rounded-full ring-2 ring-white ${online ? 'bg-green-400' : 'bg-gray-400'}`}
      />

      {/* unread badge */}
      {unread > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
