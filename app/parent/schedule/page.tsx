'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { getSession, TIME_SLOTS, endTime, toDateStr, SUMMER_START, SUMMER_END, type SummerLesson, type SummerStudent } from '../../lib'

const AM_SLOTS = TIME_SLOTS.filter(s => s.startsWith('10') || s.startsWith('11'))
const PM_SLOTS = TIME_SLOTS.filter(s => !s.startsWith('10') && !s.startsWith('11'))
const DOW = ['月','火','水','木','金','土','日']

export default function SummerSchedulePage() {
  const router = useRouter()
  const [student, setStudent]     = useState<SummerStudent | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })
  const [selectedDate, setSelectedDate]   = useState<string>('')
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())
  const [existingLessons, setExistingLessons] = useState<SummerLesson[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
  }, [router])

  useEffect(() => { if (student) fetchLessons() }, [student, weekStart])

  async function fetchLessons() {
    if (!student) return
    const supabase = createClient()
    const end = new Date(weekStart); end.setDate(end.getDate() + 6)
    const { data } = await supabase
      .from('summer_lessons').select('*')
      .eq('student_id', student.id)
      .gte('date', toDateStr(weekStart)).lte('date', toDateStr(end))
      .neq('status', 'cancelled')
    setExistingLessons(data || [])
  }

  function weekDates(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
    })
  }

  function isInSummer(d: Date) { const s = toDateStr(d); return s >= SUMMER_START && s <= SUMMER_END }
  function isBooked(slot: string) { return existingLessons.some(l => l.date === selectedDate && l.start_time === slot) }

  function toggleSlot(slot: string) {
    if (isBooked(slot)) return
    setSelectedSlots(prev => { const n = new Set(prev); n.has(slot) ? n.delete(slot) : n.add(slot); return n })
  }

  async function handleSubmit() {
    if (!student || selectedSlots.size === 0 || !selectedDate) return
    setSubmitting(true)
    const supabase = createClient()
    const records = Array.from(selectedSlots).sort().map(slot => ({
      student_id: student.id, full_name: student.full_name,
      date: selectedDate, start_time: slot, end_time: endTime(slot), status: 'pending',
    }))
    await supabase.from('summer_lessons').insert(records)
    await supabase.from('summer_notifications').insert({
      type: 'lesson', title: '新しい授業申込みがありました',
      message: `${student.full_name}（${selectedDate}）${records.length}コマ`, is_read: false,
    })
    setDone(true); setSubmitting(false); setSelectedSlots(new Set())
    await fetchLessons()
    setTimeout(() => setDone(false), 3000)
  }

  if (!student) return null

  const weekDays = weekDates()
  const today    = toDateStr(new Date())

  const SlotBtn = ({ slot }: { slot: string }) => {
    const booked = isBooked(slot)
    const sel    = selectedSlots.has(slot)
    return (
      <button disabled={booked} onClick={() => toggleSlot(slot)}
        className={`h-12 sm:h-14 rounded-xl text-sm font-bold transition-all active:scale-95 hover:scale-[1.02]
          ${booked ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : ''}
          ${!booked && sel ? 'bg-blue-600 text-white shadow-md' : ''}
          ${!booked && !sel ? 'bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50' : ''}
        `}>
        {booked ? '申込済' : slot}
      </button>
    )
  }

  const CalendarPanel = () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); setSelectedDate(''); setSelectedSlots(new Set()) }}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-200 active:scale-95 transition-all">‹</button>
        <span className="text-sm font-bold text-gray-700">
          {weekDays[0].getMonth()+1}/{weekDays[0].getDate()} 〜 {weekDays[6].getMonth()+1}/{weekDays[6].getDate()}
        </span>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); setSelectedDate(''); setSelectedSlots(new Set()) }}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-xl hover:bg-gray-200 active:scale-95 transition-all">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(d => {
          const ds = toDateStr(d); const inS = isInSummer(d)
          const isToday = ds === today; const isSel = selectedDate === ds
          const bookedCount = existingLessons.filter(l => l.date === ds).length
          return (
            <button key={ds} disabled={!inS}
              onClick={() => { setSelectedDate(ds); setSelectedSlots(new Set()) }}
              className={`flex flex-col items-center justify-center h-12 sm:h-14 rounded-xl text-sm font-bold transition-all
                ${!inS ? 'text-gray-200 cursor-not-allowed' : 'hover:scale-105'}
                ${inS && !isSel && !isToday ? 'text-gray-600 hover:bg-blue-50' : ''}
                ${isToday && !isSel ? 'bg-blue-50 text-blue-600' : ''}
                ${isSel ? 'bg-blue-600 text-white shadow-md' : ''}`}>
              <span>{d.getDate()}</span>
              {bookedCount > 0 && inS && (
                <span className={`text-[9px] font-bold mt-0.5 ${isSel ? 'text-blue-200' : 'text-blue-500'}`}>{bookedCount}コマ</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const SlotsPanel = () => (
    selectedDate ? (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-800">
            {new Date(selectedDate+'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">希望の時間帯を選んでください（複数OK）</p>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">午前</div>
          <div className="grid grid-cols-4 gap-2">
            {AM_SLOTS.map(slot => <SlotBtn key={slot} slot={slot} />)}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">午後</div>
          <div className="grid grid-cols-4 gap-2">
            {PM_SLOTS.map(slot => <SlotBtn key={slot} slot={slot} />)}
          </div>
        </div>
        {selectedSlots.size > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-sm text-gray-600 mb-3">
              選択中：<span className="font-bold text-blue-600">{selectedSlots.size}コマ</span>
              <span className="text-xs text-gray-400 ml-1.5">（{Array.from(selectedSlots).sort().join('・')}）</span>
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-blue-600 text-white font-bold text-base h-14 rounded-2xl disabled:opacity-50 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 cursor-pointer">
              {submitting ? '申込み中...' : `${selectedSlots.size}コマを申し込む`}
            </button>
          </div>
        )}
      </div>
    ) : (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
        左のカレンダーから日付を選んでください
      </div>
    )
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div>
          <h1 className="text-base font-bold text-gray-800">授業を申し込む</h1>
          <p className="text-xs text-gray-400">{student.full_name}</p>
        </div>
      </header>
      <main className="px-4 py-5 max-w-4xl mx-auto">
        {done && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-center text-green-700 font-bold text-base mb-4">
            ✅ 申込みが完了しました！
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-96 flex-shrink-0"><CalendarPanel /></div>
          <div className="flex-1"><SlotsPanel /></div>
        </div>
      </main>
    </div>
  )
}
