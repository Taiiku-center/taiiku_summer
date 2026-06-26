'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { getSession, toDateStr, SUMMER_START, SUMMER_END, type SummerLesson, type SummerAbsence, type SummerStudent } from '../../lib'

export default function SummerCalendarPage() {
  const router = useRouter()
  const [student, setStudent]     = useState<SummerStudent | null>(null)
  const [lessons, setLessons]     = useState<SummerLesson[]>([])
  const [absences, setAbsences]   = useState<SummerAbsence[]>([])
  const [viewMonth, setViewMonth] = useState(() => new Date(SUMMER_START + 'T00:00:00'))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
    fetchData(s.id)
  }, [router])

  async function fetchData(studentId: string) {
    const supabase = createClient()
    const [l, a] = await Promise.all([
      supabase.from('summer_lessons').select('*').eq('student_id', studentId).neq('status', 'cancelled').order('date').order('start_time'),
      supabase.from('summer_absences').select('*').eq('student_id', studentId).order('date'),
    ])
    setLessons(l.data || [])
    setAbsences(a.data || [])
    setLoading(false)
  }

  function calendarDays(): (Date | null)[] {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const first = new Date(year, month, 1)
    const last  = new Date(year, month + 1, 0)
    const startDow = (first.getDay() + 6) % 7 // 譛域屆蟋九∪繧・    const days: (Date | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }

  function lessonsOn(ds: string) { return lessons.filter(l => l.date === ds) }
  function absencesOn(ds: string) { return absences.filter(a => a.date === ds) }

  function inSummer(ds: string) { return ds >= SUMMER_START && ds <= SUMMER_END }

  const days = calendarDays()
  const today = toDateStr(new Date())

  const selectedLessons  = selectedDate ? lessonsOn(selectedDate) : []
  const selectedAbsences = selectedDate ? absencesOn(selectedDate) : []

  if (!student) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">窶ｹ</button>
        <div>
          <h1 className="text-base font-bold text-gray-800">謗域･ｭ莠亥ｮ壹ｒ遒ｺ隱阪☆繧・/h1>
          <p className="text-xs text-gray-400">{student.full_name}</p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-4xl mx-auto">

        {loading ? (
          <div className="text-center text-gray-400 py-10">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* 譛医き繝ｬ繝ｳ繝繝ｼ */}
          <div className="lg:w-96 flex-shrink-0 space-y-4">
            {/* 譛医リ繝・*/}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">窶ｹ</button>
                <span className="text-sm font-bold text-gray-700">
                  {viewMonth.getFullYear()}蟷ｴ{viewMonth.getMonth() + 1}譛・                </span>
                <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">窶ｺ</button>
              </div>

              {/* 譖懈律繝倥ャ繝繝ｼ */}
              <div className="grid grid-cols-7 mb-1">
                {['譛・,'轣ｫ','豌ｴ','譛ｨ','驥・,'蝨・,'譌･'].map(d => (
                  <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* 譌･莉倥げ繝ｪ繝・ラ */}
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((d, i) => {
                  if (!d) return <div key={i} />
                  const ds = toDateStr(d)
                  const inS = inSummer(ds)
                  const lCount = lessonsOn(ds).length
                  const aCount = absencesOn(ds).length
                  const isToday = ds === today
                  const isSel = selectedDate === ds
                  return (
                    <button key={ds}
                      disabled={!inS}
                      onClick={() => setSelectedDate(isSel ? null : ds)}
                      className={`relative py-2 rounded-xl text-sm font-medium transition-colors
                        ${!inS ? 'text-gray-200' : ''}
                        ${inS && !isSel && !isToday ? 'text-gray-600 hover:bg-gray-50' : ''}
                        ${isToday && !isSel ? 'bg-blue-50 text-blue-600' : ''}
                        ${isSel ? 'bg-blue-600 text-white' : ''}
                      `}>
                      {d.getDate()}
                      {(lCount > 0 || aCount > 0) && (
                        <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                          {lCount > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-blue-500'}`} />}
                          {aCount > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-orange-400'}`} />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> 逕ｳ霎ｼ縺ゅｊ
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> 谺蟶ｭ繝ｻ驕・綾騾｣邨｡
                </div>
              </div>
            </div>

            {/* 繧ｵ繝槭Μ繝ｼ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">逕ｳ霎ｼ縺ｿ繧ｵ繝槭Μ繝ｼ</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{lessons.length}</div>
                  <div className="text-xs text-blue-500 mt-0.5">逕ｳ霎ｼ縺ｿ繧ｳ繝樊焚</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-orange-500">{absences.length}</div>
                  <div className="text-xs text-orange-400 mt-0.5">谺蟶ｭ繝ｻ驕・綾騾｣邨｡</div>
                </div>
              </div>
            </div>
          </div>{/* end left column */}

          {/* 蜿ｳ繧ｫ繝ｩ繝・夐∈謚樊律隧ｳ邏ｰ */}
          <div className="flex-1 w-full">
            {selectedDate ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <h2 className="text-sm font-bold text-gray-700">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                </h2>
                {selectedLessons.length === 0 && selectedAbsences.length === 0 && (
                  <p className="text-sm text-gray-400">縺薙・譌･縺ｯ莠亥ｮ壹′縺ゅｊ縺ｾ縺帙ｓ</p>
                )}
                {selectedLessons.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-blue-600 mb-2">套 謗域･ｭ逕ｳ霎ｼ縺ｿ</div>
                    <div className="space-y-1.5">
                      {selectedLessons.map(l => (
                        <div key={l.id} className="flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2.5">
                          <span className="text-sm font-medium text-blue-700">{l.start_time}縲悳l.end_time}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${l.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                            {l.status === 'confirmed' ? '遒ｺ螳・ : '逕ｳ霎ｼ貂・}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedAbsences.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-orange-600 mb-2">討 谺蟶ｭ繝ｻ驕・綾騾｣邨｡</div>
                    <div className="space-y-1.5">
                      {selectedAbsences.map(a => (
                        <div key={a.id} className="bg-orange-50 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-orange-700">{a.type}・・a.time}縲懶ｼ・/span>
                            <span className="text-xs text-orange-500">謖ｯ譖ｿ・嘴a.make_up_request}</span>
                          </div>
                          {a.note && <p className="text-xs text-orange-600">{a.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex bg-white rounded-2xl border border-gray-100 shadow-sm p-8 items-center justify-center text-gray-400 text-sm h-48">
                蟾ｦ縺ｮ繧ｫ繝ｬ繝ｳ繝繝ｼ縺九ｉ譌･莉倥ｒ驕ｸ繧薙〒縺上□縺輔＞
              </div>
            )}
          </div>
          </div>{/* end flex row */}
        )}
      </main>
    </div>
  )
}

