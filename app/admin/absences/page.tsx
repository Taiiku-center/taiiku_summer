'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerAbsence } from '../../lib'

export default function SummerAdminAbsencesPage() {
  const router = useRouter()
  const [absences, setAbsences] = useState<SummerAbsence[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | '谺蟶ｭ' | '驕・綾'>('all')

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
  const makeupCount = absences.filter(a => a.make_up_request === '蟶梧悍縺吶ｋ').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="text-gray-400 text-xl px-1">窶ｹ</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">谺蟶ｭ繝ｻ驕・綾騾｣邨｡荳隕ｧ</h1>
          <p className="text-xs text-gray-400">螟乗悄隰帷ｿ・/p>
        </div>
      </header>

      <main className="px-4 md:px-6 py-4 max-w-3xl mx-auto space-y-4">

        {/* 繧ｵ繝槭Μ繝ｼ */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '谺蟶ｭ', count: absences.filter(a => a.type === '谺蟶ｭ').length, color: 'text-red-500', bg: 'bg-red-50' },
            { label: '驕・綾', count: absences.filter(a => a.type === '驕・綾').length, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: '謖ｯ譖ｿ蟶梧悍', count: makeupCount, color: 'text-blue-500', bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 繝輔ぅ繝ｫ繧ｿ繝ｼ */}
        <div className="flex gap-2">
          {(['all', '谺蟶ｭ', '驕・綾'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? '縺吶∋縺ｦ' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-10">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-10">騾｣邨｡縺ｯ縺ゅｊ縺ｾ縺帙ｓ</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{a.full_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {a.date} {a.time}縲・                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                      ${a.type === '谺蟶ｭ' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {a.type}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium
                      ${a.make_up_request === '蟶梧悍縺吶ｋ' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      謖ｯ譖ｿ・嘴a.make_up_request}
                    </span>
                  </div>
                </div>
                {a.note && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{a.note}</div>
                )}
                <div className="mt-2 text-xs text-gray-300">{new Date(a.created_at).toLocaleString('ja-JP')}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

