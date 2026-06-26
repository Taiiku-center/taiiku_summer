'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { getSession, TIME_SLOTS, toDateStr, SUMMER_START, SUMMER_END, type SummerStudent } from '../../lib'

export default function SummerAbsencePage() {
  const router = useRouter()
  const [student, setStudent]       = useState<SummerStudent | null>(null)
  const [date, setDate]             = useState('')
  const [time, setTime]             = useState(TIME_SLOTS[0])
  const [type, setType]             = useState<'谺蟶ｭ' | '驕・綾'>('谺蟶ｭ')
  const [makeUp, setMakeUp]         = useState<'蟶梧悍縺吶ｋ' | '蟶梧悍縺励↑縺・ | '譛ｪ螳・>('譛ｪ螳・)
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
    setDate(toDateStr(new Date()))
  }, [router])

  async function handleSubmit() {
    if (!student || !date || !time) { setError('縺吶∋縺ｦ縺ｮ鬆・岼繧貞・蜉帙＠縺ｦ縺上□縺輔＞'); return }
    if (date < SUMMER_START || date > SUMMER_END) { setError('螟乗悄隰帷ｿ偵・譛滄俣螟悶・譌･莉倥〒縺・); return }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    await supabase.from('summer_absences').insert({
      student_id: student.id,
      full_name: student.full_name,
      date,
      time,
      type,
      make_up_request: makeUp,
      note,
    })
    const notifType = type === '谺蟶ｭ' ? 'absence' : 'late'
    const notifTitle = type === '谺蟶ｭ' ? '谺蟶ｭ騾｣邨｡縺後≠繧翫∪縺励◆' : '驕・綾騾｣邨｡縺後≠繧翫∪縺励◆'
    await supabase.from('summer_notifications').insert({
      type: notifType,
      title: notifTitle,
      message: `${student.full_name}・・{date} ${time}縲懶ｼ荏,
      is_read: false,
    })
    if (makeUp === '蟶梧悍縺吶ｋ') {
      await supabase.from('summer_notifications').insert({
        type: 'makeup',
        title: '謖ｯ譖ｿ蟶梧悍縺後≠繧翫∪縺・,
        message: `${student.full_name}・・{date} ${time}縲懶ｼ荏,
        is_read: false,
      })
    }
    setDone(true)
    setSubmitting(false)
    setNote('')
  }

  if (!student) return null

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">笨・/div>
          <h2 className="text-xl font-bold text-gray-800">騾｣邨｡縺碁∽ｿ｡縺輔ｌ縺ｾ縺励◆</h2>
          <p className="text-sm text-gray-500">蝪ｾ縺ｫ{type}縺ｮ騾｣邨｡縺悟ｱ翫″縺ｾ縺励◆</p>
          <button onClick={() => router.push('/parent')}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">
            繝帙・繝縺ｫ謌ｻ繧・          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">窶ｹ</button>
        <div>
          <h1 className="text-base font-bold text-gray-800">谺蟶ｭ繝ｻ驕・綾騾｣邨｡</h1>
          <p className="text-xs text-gray-400">{student.full_name}</p>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">

        {/* 遞ｮ蛻･ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">騾｣邨｡縺ｮ遞ｮ鬘・/h2>
          <div className="grid grid-cols-2 gap-3">
            {(['谺蟶ｭ', '驕・綾'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`py-4 rounded-2xl text-base font-bold border-2 transition-all
                  ${type === t ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-100' : 'border-gray-200 text-gray-500 hover:border-orange-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 譌･莉倥・譎る俣 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">蟇ｾ雎｡縺ｮ譌･莉・/label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                min={SUMMER_START} max={SUMMER_END}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-400 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">蟇ｾ雎｡縺ｮ譎る俣</label>
              <select value={time} onChange={e => setTime(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-400 bg-white transition-colors">
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}縲・/option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 謖ｯ譖ｿ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">謖ｯ譖ｿ縺ｫ縺､縺・※</h2>
          <div className="space-y-2">
            {(['蟶梧悍縺吶ｋ', '蟶梧悍縺励↑縺・, '譛ｪ螳・] as const).map(opt => (
              <button key={opt} onClick={() => setMakeUp(opt)}
                className={`w-full py-3.5 rounded-xl text-sm font-medium border-2 transition-all text-left px-4
                  ${makeUp === opt ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                {opt === '蟶梧悍縺吶ｋ' ? '売 謖ｯ譖ｿ繧貞ｸ梧悍縺吶ｋ' : opt === '蟶梧悍縺励↑縺・ ? '笨・謖ｯ譖ｿ縺ｯ蟶梧悍縺励↑縺・ : '笶・縺ｾ縺譛ｪ螳・}
              </button>
            ))}
          </div>
        </div>

        {/* 蛯呵・*/}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-600 mb-2">蛯呵・ｼ井ｻｻ諢擾ｼ・/label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="騾｣邨｡莠矩・′縺ゅｌ縺ｰ縺碑ｨ伜・縺上□縺輔＞"
            rows={3}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none transition-colors" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !date}
          className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-orange-100">
          {submitting ? '騾∽ｿ｡荳ｭ...' : `${type}繧帝｣邨｡縺吶ｋ`}
        </button>
      </main>
    </div>
  )
}

