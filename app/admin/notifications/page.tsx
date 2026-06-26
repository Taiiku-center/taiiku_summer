'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerNotification } from '../../lib'

const TYPE_ICON: Record<string, string> = {
  lesson:  '套',
  absence: '笶・,
  late:    '竢ｰ',
  makeup:  '売',
  bug:     '肌',
}

const TYPE_COLOR: Record<string, string> = {
  lesson:  'border-blue-200 bg-blue-50',
  absence: 'border-red-200 bg-red-50',
  late:    'border-orange-200 bg-orange-50',
  makeup:  'border-purple-200 bg-purple-50',
  bug:     'border-gray-200 bg-gray-50',
}

export default function SummerAdminNotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs]   = useState<SummerNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchNotifs() }, [])

  async function fetchNotifs() {
    const supabase = createClient()
    const { data } = await supabase
      .from('summer_notifications')
      .select('*')
      .order('created_at', { ascending: false })
    setNotifs(data || [])
    setLoading(false)
  }

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('summer_notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const supabase = createClient()
    await supabase.from('summer_notifications').update({ is_read: true }).eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="text-gray-400 text-xl px-1">窶ｹ</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">騾夂衍荳隕ｧ</h1>
          <p className="text-xs text-gray-400">螟乗悄隰帷ｿ・/p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            縺吶∋縺ｦ譌｢隱ｭ
          </button>
        )}
      </header>

      <main className="px-4 md:px-6 py-4 max-w-3xl mx-auto space-y-3">

        {unread > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 font-semibold text-center">
            粕 譛ｪ遒ｺ隱阪・騾夂衍縺・{unread} 莉ｶ縺ゅｊ縺ｾ縺・          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-10">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>
        ) : notifs.length === 0 ? (
          <div className="text-center text-gray-400 py-10">騾夂衍縺ｯ縺ゅｊ縺ｾ縺帙ｓ</div>
        ) : (
          notifs.map(n => (
            <div key={n.id}
              className={`rounded-2xl border shadow-sm p-4 transition-colors ${n.is_read ? 'bg-white border-gray-100' : TYPE_COLOR[n.type] || 'bg-white border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] || '東'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-bold ${n.is_read ? 'text-gray-700' : 'text-gray-800'}`}>{n.title}</span>
                    {!n.is_read && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500">{n.message}</p>
                  <p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString('ja-JP')}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)}
                    className="flex-shrink-0 text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                    譌｢隱ｭ
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}

