'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerBugReport } from '../../lib'
import GuideBox from '../../components/GuideBox'

export default function SummerAdminBugsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<SummerBugReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    const supabase = createClient()
    const { data } = await supabase
      .from('summer_bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  async function markRead(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('summer_bug_reports').update({ status: 'read' }).eq('id', id)
    if (error) { console.error('mark read failed:', error); return }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'read' } : r))
  }

  const unread = reports.filter(r => r.status === 'unread').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-black text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-black">不具合報告一覧</h1>
          <p className="text-xs text-black">夏期講習</p>
        </div>
        {unread > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{unread}件 未確認</span>
        )}
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-3">
        <GuideBox
          bullets={[
            '枠が赤い報告は未確認です。',
            '「確認済みにする」を押すと既読になります。',
          ]}
        />
        {loading ? (
          <div className="text-center text-black py-10">読み込み中...</div>
        ) : reports.length === 0 ? (
          <div className="text-center text-black py-10">不具合報告はありません</div>
        ) : (
          reports.map(r => (
            <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${r.status === 'unread' ? 'border-red-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-black text-sm">{r.full_name}</span>
                    <span className="text-xs text-black bg-gray-100 px-2 py-0.5 rounded-full">{r.screen_name}</span>
                    {r.status === 'unread' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">未確認</span>
                    )}
                  </div>
                  <p className="text-sm text-black leading-relaxed">{r.description}</p>
                  <div className="text-xs text-black mt-2">{new Date(r.created_at).toLocaleString('ja-JP')}</div>
                </div>
                {r.status === 'unread' && (
                  <button onClick={() => markRead(r.id)}
                    className="flex-shrink-0 text-xs bg-gray-100 text-black px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">
                    確認済みにする
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
