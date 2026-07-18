'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerAbsence } from '../../lib'
import GuideBox from '../../components/GuideBox'

export default function SummerAdminAbsencesPage() {
  const router = useRouter()
  const [absences, setAbsences] = useState<SummerAbsence[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | '欠席' | '遅刻'>('all')

  useEffect(() => { fetchAbsences() }, [])

  async function fetchAbsences() {
    const supabase = createClient()
    const { data } = await supabase
      .from('summer_absences')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setAbsences(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? absences : absences.filter(a => a.type === filter)
  const makeupCount = absences.filter(a => a.make_up_request === '希望する').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-black text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-black">欠席・遅刻連絡一覧</h1>
          <p className="text-xs text-black">夏期講習</p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        <GuideBox
          bullets={[
            '欠席・遅刻でフィルターして絞り込めます。',
            '各カードで振替希望の有無・連絡内容を確認できます。',
          ]}
        />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '欠席', count: absences.filter(a => a.type === '欠席').length, color: 'text-red-500', bg: 'bg-red-50' },
            { label: '遅刻', count: absences.filter(a => a.type === '遅刻').length, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: '振替希望', count: makeupCount, color: 'text-blue-500', bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-black mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {(['all', '欠席', '遅刻'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-black hover:bg-gray-50'}`}>
              {f === 'all' ? 'すべて' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-black py-10">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-black py-10">連絡はありません</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-black text-sm">{a.full_name}</div>
                    <div className="text-xs text-black mt-0.5">{a.date} {a.time}〜</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                      ${a.type === '欠席' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {a.type}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium
                      ${a.make_up_request === '希望する' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-black'}`}>
                      振替：{a.make_up_request}
                    </span>
                  </div>
                </div>
                {a.note && <div className="mt-2 text-xs text-black bg-gray-50 rounded-lg px-3 py-2">{a.note}</div>}
                <div className="mt-2 text-xs text-black">{new Date(a.created_at).toLocaleString('ja-JP')}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
