'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { getSession, type SummerStudent } from '../../lib'

const SCREENS = [
  '繝ｭ繧ｰ繧､繝ｳ逕ｻ髱｢',
  '繝帙・繝逕ｻ髱｢',
  '謗域･ｭ逕ｳ霎ｼ縺ｿ逕ｻ髱｢',
  '谺蟶ｭ繝ｻ驕・綾騾｣邨｡逕ｻ髱｢',
  '謗域･ｭ遒ｺ隱阪き繝ｬ繝ｳ繝繝ｼ',
  '縺昴・莉・,
]

export default function SummerBugReportPage() {
  const router = useRouter()
  const [student, setStudent]         = useState<SummerStudent | null>(null)
  const [screenName, setScreenName]   = useState(SCREENS[0])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [done, setDone]               = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
  }, [router])

  async function handleSubmit() {
    if (!student || !description.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.from('summer_bug_reports').insert({
      student_id: student.id,
      full_name: student.full_name,
      screen_name: screenName,
      description: description.trim(),
      status: 'unread',
    })
    await supabase.from('summer_notifications').insert({
      type: 'bug',
      title: '荳榊・蜷亥ｱ蜻翫′螻翫″縺ｾ縺励◆',
      message: `${student.full_name}・・{screenName}・荏,
      is_read: false,
    })
    setDone(true)
    setSubmitting(false)
  }

  if (!student) return null

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">肌</div>
          <h2 className="text-xl font-bold text-gray-800">蝣ｱ蜻翫′騾∽ｿ｡縺輔ｌ縺ｾ縺励◆</h2>
          <p className="text-sm text-gray-500">縺比ｸ堺ｾｿ繧偵♀縺九￠縺励∪縺励◆縲ら｢ｺ隱榊ｾ後↓蟇ｾ蠢懊＞縺溘＠縺ｾ縺吶・/p>
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
        <button onClick={() => router.back()} className="text-gray-400 text-xl px-1">窶ｹ</button>
        <div>
          <h1 className="text-base font-bold text-gray-800">荳榊・蜷医ｒ蝣ｱ蜻翫☆繧・/h1>
          <p className="text-xs text-gray-400">{student.full_name}</p>
        </div>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500">
          繧｢繝励Μ縺ｧ蝗ｰ縺｣縺溘％縺ｨ繧・ｸ榊・蜷医′縺ゅｌ縺ｰ縺顔衍繧峨○縺上□縺輔＞縲ょｾ後⊇縺ｩ蟇ｾ蠢懊＞縺溘＠縺ｾ縺吶・        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">荳榊・蜷医′襍ｷ縺阪◆逕ｻ髱｢</label>
            <div className="space-y-2">
              {SCREENS.map(s => (
                <button key={s} onClick={() => setScreenName(s)}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all text-left
                    ${screenName === s ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">荳榊・蜷医・蜀・ｮｹ</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="縺ｩ縺ｮ繧医≧縺ｪ蝠城｡後′襍ｷ縺阪◆縺九√〒縺阪ｋ縺縺題ｩｳ縺励￥謨吶∴縺ｦ縺上□縺輔＞"
              rows={5}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none transition-colors" />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="w-full bg-gray-700 text-white font-bold text-lg py-5 rounded-2xl disabled:opacity-40 active:scale-95 transition-all">
          {submitting ? '騾∽ｿ｡荳ｭ...' : '荳榊・蜷医ｒ蝣ｱ蜻翫☆繧・}
        </button>
      </main>
    </div>
  )
}

