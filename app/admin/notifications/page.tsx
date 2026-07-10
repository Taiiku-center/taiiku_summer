'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerNotification } from '../../lib'
import GuideBox from '../../components/GuideBox'

const TYPE_ICON: Record<string, string> = {
  lesson:  '📅',
  absence: '❌',
  late:    '⏰',
  makeup:  '🔄',
  bug:     '🔧',
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
    const { error } = await supabase.from('summer_notifications').update({ is_read: true }).eq('id', id)
    if (error) { console.error('mark read failed:', error); return }
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const supabase = createClient()
    const { error } = await supabase.from('summer_notifications').update({ is_read: true }).eq('is_read', false)
    if (error) { console.error('mark all read failed:', error); return }
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">通知一覧</h1>
          <p className="text-xs text-gray-400">夏期講習</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            すべて既読
          </button>
        )}
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-3">
        <GuideBox
          bullets={[
            '新しい予約・欠席連絡・不具合報告が届くとここに表示されます。',
            'タップで個別に既読、右上の「すべて既読」でまとめて既読にできます。',
          ]}
        />
        {unread > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 font-semibold text-center">
            🔔 未確認の通知が {unread} 件あります
          </div>
        )}
        {loading ? (
          <div className="text-center text-gray-400 py-10">読み込み中...</div>
        ) : notifs.length === 0 ? (
          <div className="text-center text-gray-400 py-10">通知はありません</div>
        ) : (
          notifs.map(n => (
            <div key={n.id}
              className={`rounded-2xl border shadow-sm p-4 transition-colors ${n.is_read ? 'bg-white border-gray-100' : TYPE_COLOR[n.type] || 'bg-white border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] || '📌'}</div>
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
                    既読
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
