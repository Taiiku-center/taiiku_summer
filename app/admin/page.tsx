'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { TIME_SLOTS, endTime, toDateStr, SUMMER_START, SUMMER_END, type SummerLesson, type SummerAbsence, type SummerNotification } from '../lib'

export default function SummerAdminPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })
  const [lessons, setLessons]           = useState<SummerLesson[]>([])
  const [absences, setAbsences]         = useState<SummerAbsence[]>([])
  const [notifs, setNotifs]             = useState<SummerNotification[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()))
  const [selectedCell, setSelectedCell] = useState<{ date: string; slot: string } | null>(null)

  useEffect(() => { fetchAll() }, [weekStart])

  async function fetchAll() {
    setLoading(true)
    const supabase = createClient()
    const end = new Date(weekStart); end.setDate(end.getDate() + 6)
    const [l, a, n] = await Promise.all([
      supabase.from('summer_lessons').select('*').gte('date', toDateStr(weekStart)).lte('date', toDateStr(end)).neq('status', 'cancelled').order('date').order('start_time'),
      supabase.from('summer_absences').select('*').gte('date', toDateStr(weekStart)).lte('date', toDateStr(end)).order('date'),
      supabase.from('summer_notifications').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(20),
    ])
    setLessons(l.data || [])
    setAbsences(a.data || [])
    setNotifs(n.data || [])
    setLoading(false)
  }

  function weekDates(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
    })
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  function lessonsAt(date: string, slot: string) { return lessons.filter(l => l.date === date && l.start_time === slot) }
  function absencesAt(date: string, slot: string) { return absences.filter(a => a.date === date && a.time === slot) }
  function dailyCount(date: string) { return new Set(lessons.filter(l => l.date === date).map(l => l.full_name)).size }
  function isInSummer(d: Date) { const s = toDateStr(d); return s >= SUMMER_START && s <= SUMMER_END }

  const weekDays  = weekDates()
  const today     = toDateStr(new Date())
  const DOW       = ['月','火','水','木','金','土','日']
  const statusColor: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-green-100 text-green-800' }
  const statusLabel: Record<string, string> = { pending: '申請中', confirmed: '確定' }

  const daySlots = TIME_SLOTS.filter(slot => lessonsAt(selectedDate, slot).length > 0 || absencesAt(selectedDate, slot).length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-base font-bold text-gray-800">☀️ 夏期講習 管理</h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
        {notifs.length > 0 && (
          <button onClick={() => router.push('/admin/notifications')}
            className="relative flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-bold">
            🔔 <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{notifs.length}</span>
          </button>
        )}
      </header>

      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {[
          { label: '📋 カレンダー', href: '/admin', active: true },
          { label: '📢 欠席・遅刻', href: '/admin/absences' },
          { label: '🔧 不具合', href: '/admin/bugs' },
          { label: '🔔 通知', href: '/admin/notifications' },
        ].map(l => (
          <button key={l.href} onClick={() => router.push(l.href)}
            className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors
              ${l.active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <main className="px-3 py-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevWeek} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50">‹</button>
          <span className="text-sm font-bold text-gray-700">
            {weekDays[0].getMonth()+1}/{weekDays[0].getDate()} 〜 {weekDays[6].getMonth()+1}/{weekDays[6].getDate()}
          </span>
          <button onClick={nextWeek} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50">›</button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
          {weekDays.map(d => {
            const ds = toDateStr(d)
            const inS = isInSummer(d)
            const count = dailyCount(ds)
            const isToday = ds === today
            const isSel = selectedDate === ds
            const dow = DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]
            return (
              <button key={ds} disabled={!inS} onClick={() => { setSelectedDate(ds); setSelectedCell(null) }}
                className={`flex-shrink-0 flex flex-col items-center w-12 py-2 rounded-2xl transition-colors
                  ${!inS ? 'opacity-30' : ''}
                  ${isSel ? 'bg-blue-600 text-white shadow-md' : isToday ? 'bg-blue-50 text-blue-600' : 'bg-white border border-gray-200 text-gray-600'}`}>
                <span className="text-xs font-medium">{dow}</span>
                <span className="text-base font-bold">{d.getDate()}</span>
                {count > 0 && (
                  <span className={`text-xs font-bold mt-0.5 ${isSel ? 'text-blue-100' : 'text-blue-600'}`}>{count}名</span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">読み込み中...</div>
        ) : (
          <>
            {/* モバイル：日別リスト */}
            <div className="md:hidden space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                  <span className="text-blue-600 ml-2">{dailyCount(selectedDate)}名</span>
                </h2>
              </div>
              {daySlots.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
                  この日の申込みはありません
                </div>
              ) : (
                daySlots.map(slot => {
                  const sLessons  = lessonsAt(selectedDate, slot)
                  const sAbsences = absencesAt(selectedDate, slot)
                  return (
                    <div key={slot} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700">{slot}〜{endTime(slot)}</span>
                        <span className="text-xs text-blue-600 font-semibold">{sLessons.length}名</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {sLessons.map(l => {
                          const abs = sAbsences.find(a => a.full_name === l.full_name)
                          return (
                            <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-bold text-gray-800">{l.full_name}</div>
                                {abs && <div className="text-xs text-orange-600 mt-0.5">⚠ {abs.type}・振替：{abs.make_up_request}</div>}
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[l.status] || 'bg-gray-100 text-gray-600'}`}>
                                {statusLabel[l.status] || l.status}
                              </span>
                            </div>
                          )
                        })}
                        {sAbsences.filter(a => !sLessons.some(l => l.full_name === a.full_name)).map(a => (
                          <div key={a.id} className="px-4 py-3 flex items-center justify-between bg-orange-50">
                            <div>
                              <div className="text-sm font-bold text-orange-800">{a.full_name}</div>
                              <div className="text-xs text-orange-600 mt-0.5">振替：{a.make_up_request}</div>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-700">{a.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* デスクトップ：週グリッド */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="w-16 sticky left-0 bg-gray-50 z-10 border border-gray-200 text-xs text-gray-500 py-2 px-1">時間</th>
                    {weekDays.map(d => {
                      const ds = toDateStr(d); const inS = isInSummer(d)
                      const count = dailyCount(ds); const isToday = ds === today
                      const dow = DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]
                      return (
                        <th key={ds} onClick={() => setSelectedDate(ds)}
                          className={`border border-gray-200 py-2 px-1 text-xs font-semibold cursor-pointer min-w-[80px]
                            ${isToday ? 'bg-blue-50 text-blue-700' : selectedDate === ds ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}
                            ${!inS ? 'opacity-30' : ''}`}>
                          <div>{d.getMonth()+1}/{d.getDate()}（{dow}）</div>
                          {count > 0 && inS && <div className={`font-bold mt-0.5 ${selectedDate === ds ? 'text-white' : 'text-blue-600'}`}>{count}名</div>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map(slot => (
                    <tr key={slot}>
                      <td className="sticky left-0 bg-white border border-gray-200 text-xs font-semibold text-gray-500 text-center py-1 px-1 z-10 whitespace-nowrap">{slot}</td>
                      {weekDays.map(d => {
                        const ds = toDateStr(d); const inS = isInSummer(d)
                        const cL = lessonsAt(ds, slot); const cA = absencesAt(ds, slot)
                        const isSel = selectedCell?.date === ds && selectedCell?.slot === slot
                        const hasData = cL.length > 0 || cA.length > 0
                        return (
                          <td key={ds}
                            onClick={() => hasData && inS && setSelectedCell(isSel ? null : { date: ds, slot })}
                            className={`border border-gray-200 p-1 align-top text-xs min-h-[40px]
                              ${!inS ? 'bg-gray-50' : ''}
                              ${isSel ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}
                              ${hasData && inS ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                            <div className="space-y-0.5">
                              {cL.map(l => (
                                <div key={l.id} className={`rounded px-1 py-0.5 leading-tight font-medium ${l.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {l.full_name}{cA.some(a => a.full_name === l.full_name) && <span className="text-orange-500 ml-0.5">⚠</span>}
                                </div>
                              ))}
                              {cA.filter(a => !cL.some(l => l.full_name === a.full_name)).map(a => (
                                <div key={a.id} className="rounded px-1 py-0.5 bg-orange-100 text-orange-800 leading-tight font-medium">{a.full_name}（{a.type}）</div>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedCell && (lessonsAt(selectedCell.date, selectedCell.slot).length > 0 || absencesAt(selectedCell.date, selectedCell.slot).length > 0) && (
              <div className="hidden md:block mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-700">
                    {new Date(selectedCell.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })} {selectedCell.slot}〜{endTime(selectedCell.slot)}
                  </h2>
                  <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="space-y-2">
                  {lessonsAt(selectedCell.date, selectedCell.slot).map(l => {
                    const abs = absencesAt(selectedCell.date, selectedCell.slot).find(a => a.full_name === l.full_name)
                    return (
                      <div key={l.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">{l.full_name}</div>
                          {abs && <div className="text-xs text-orange-600 mt-0.5">{abs.type}・振替：{abs.make_up_request}{abs.note && `（${abs.note}）`}</div>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[l.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel[l.status] || l.status}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
