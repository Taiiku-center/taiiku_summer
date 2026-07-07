'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import {
  getSession, TIME_SLOTS, endTime, toDateStr, SUMMER_START, SUMMER_END,
  SLOT_CAPACITY, ELEMENTARY_COURSES, JUNIOR_COURSES,
  type SummerStudent, type SummerCourse,
} from '../../lib'

const NOTIFY_EMAIL = 'kusunoki.infinite@gmail.com'
async function sendEmail(subject: string, body: string) {
  try {
    await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ _subject: subject, message: body, _captcha: 'false' }),
    })
  } catch {}
}

const DOW = ['月', '火', '水', '木', '金', '土', '日']
const MORNING = ['10:00', '10:30', '11:00', '11:30']

// 受講可能な時間帯か（日曜なし／月・木の午前なし）
function slotAvailable(d: Date, slot: string) {
  const dow = d.getDay()
  if (dow === 0) return false
  if ((dow === 1 || dow === 4) && MORNING.includes(slot)) return false
  return true
}

type Step = 'course' | 'schedule' | 'confirm' | 'done'

function keyOf(ds: string, slot: string) { return `${ds}__${slot}` }
function fmtHours(h: number) { return Number.isInteger(h) ? `${h}H` : `${h}H` }

export default function SummerApplyPage() {
  const router = useRouter()
  const [student, setStudent]   = useState<SummerStudent | null>(null)
  const [step, setStep]         = useState<Step>('course')
  const [category, setCategory] = useState<'小学生' | '中学生' | null>(null)
  const [course, setCourse]     = useState<SummerCourse | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [slotCounts, setSlotCounts] = useState<Map<string, number>>(new Map())
  const [myExisting, setMyExisting] = useState<Set<string>>(new Set())
  const [weekStart, setWeekStart]   = useState<Date>(() => {
    const d = new Date(SUMMER_START + 'T00:00:00')
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })
  const [selectedDay, setSelectedDay] = useState<string>(SUMMER_START)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
    fetchData(s)
  }, [router])

  async function fetchData(s: SummerStudent) {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('summer_lessons')
        .select('student_id, date, start_time')
        .neq('status', 'cancelled')
        .gte('date', SUMMER_START).lte('date', SUMMER_END)
      const counts = new Map<string, number>()
      const mine = new Set<string>()
      ;(data || []).forEach(r => {
        const k = keyOf(r.date, r.start_time)
        counts.set(k, (counts.get(k) || 0) + 1)
        if (r.student_id === s.id) mine.add(k)
      })
      setSlotCounts(counts)
      setMyExisting(mine)
    } catch {
      // 取得に失敗しても画面は表示（満席・予約済の判定のみ無効）
    }
  }

  const requiredHours = course?.hours ?? 0
  const requiredSlots = requiredHours * 2          // 30分=0.5H
  const selectedHours = selected.size * 0.5
  const canProceed = course != null && selected.size === requiredSlots

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  }), [weekStart])

  const inPeriod = (ds: string) => ds >= SUMMER_START && ds <= SUMMER_END
  const canPrevWeek = toDateStr(weekStart) > SUMMER_START
  const canNextWeek = (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); return toDateStr(d) <= SUMMER_END })()

  function selectCourse(cat: '小学生' | '中学生', c: SummerCourse) {
    setCategory(cat); setCourse(c); setSelected(new Set())
  }

  function cellState(ds: string, slot: string): 'blocked' | 'booked' | 'full' | 'selected' | 'open' {
    const d = new Date(ds + 'T00:00:00')
    if (!inPeriod(ds) || !slotAvailable(d, slot)) return 'blocked'
    const k = keyOf(ds, slot)
    if (myExisting.has(k)) return 'booked'
    if (selected.has(k)) return 'selected'
    if ((slotCounts.get(k) || 0) >= SLOT_CAPACITY) return 'full'
    return 'open'
  }

  function toggleSlot(ds: string, slot: string) {
    const st = cellState(ds, slot)
    if (st === 'blocked' || st === 'booked' || st === 'full') return
    const k = keyOf(ds, slot)
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(k)) { n.delete(k); return n }
      if (n.size >= requiredSlots) return n   // 必要時間数を超える選択は不可
      n.add(k); return n
    })
  }

  async function handleSubmit() {
    if (!student || !course || !category || !canProceed) return
    setSaving(true); setError('')
    const supabase = createClient()

    const { data: app, error: appErr } = await supabase.from('summer_course_applications').insert({
      student_id: student.id, full_name: student.full_name,
      course_category: category, course_name: course.name,
      required_hours: requiredHours, total_hours: selectedHours, status: 'pending',
    }).select('id').single()

    if (appErr || !app) { setError('申込みに失敗しました。時間をおいて再度お試しください。'); setSaving(false); return }

    const rows = Array.from(selected).map(k => {
      const [ds, slot] = k.split('__')
      return {
        student_id: student.id, full_name: student.full_name,
        date: ds, start_time: slot, end_time: endTime(slot), status: 'pending',
        application_id: app.id, course_name: course.name,
      }
    })
    const { error: lessonErr } = await supabase.from('summer_lessons').insert(rows)
    if (lessonErr) {
      await supabase.from('summer_course_applications').delete().eq('id', app.id)
      setError('日程の登録に失敗しました。時間をおいて再度お試しください。'); setSaving(false); return
    }

    await supabase.from('summer_notifications').insert({
      type: 'lesson', title: '夏期講習のコース申込みがありました',
      message: `${student.full_name}（${category} ${course.name}／${requiredHours}H）`, is_read: false,
    })
    sendEmail(
      `【コース申込】${student.full_name} ${category} ${course.name}`,
      `${student.full_name} さんが夏期講習を申し込みました。\nコース：${category} ${course.name}\n必要時間数：${requiredHours}H\n日程：\n` +
        rows.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time < b.start_time ? -1 : 1)
          .map(r => `・${r.date} ${r.start_time}〜${r.end_time}`).join('\n') +
        `\n合計：${selectedHours}H\n管理画面でご確認ください。`,
    )
    setSaving(false); setStep('done')
  }

  if (!student) return null

  // ── 完了画面 ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">夏期講習のお申込みを受け付けました</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            お申込みありがとうございます。<br />
            内容を確認のうえ、必要に応じて教室よりご連絡いたします。
          </p>
          <div className="bg-blue-50 rounded-2xl p-4 text-left text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">コース</span><span className="font-bold text-blue-700">{category} {course?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">合計時間数</span><span className="font-bold text-blue-700">{selectedHours}H</span></div>
          </div>
          <button onClick={() => router.push('/parent')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700">ホームに戻る</button>
          <button onClick={() => router.push('/parent/calendar')} className="w-full border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">授業予定を確認する</button>
        </div>
      </div>
    )
  }

  const sortedSelected = Array.from(selected).map(k => { const [ds, slot] = k.split('__'); return { ds, slot } })
    .sort((a, b) => a.ds < b.ds ? -1 : a.ds > b.ds ? 1 : a.slot < b.slot ? -1 : 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => {
          if (step === 'course') router.push('/parent')
          else if (step === 'schedule') setStep('course')
          else if (step === 'confirm') setStep('schedule')
        }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">夏期講習の申込み</h1>
          <p className="text-xs text-gray-400">{student.full_name} さん</p>
        </div>
        <div className="flex gap-1">
          {(['course', 'schedule', 'confirm'] as Step[]).map((s, i) => (
            <span key={s} className={`w-6 h-1.5 rounded-full ${['course', 'schedule', 'confirm'].indexOf(step) >= i ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4 pb-28">

        {/* ══ ③ コース選択 ══ */}
        {step === 'course' && (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-800">コースを選択してください</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                ご希望のコースを1つ選択してください。<br />
                コースによって、受講時間・日数が異なります。<br />
                どのコースがよいか迷われる場合は、先にご相談ください。
              </p>
            </div>

            {([['小学生', ELEMENTARY_COURSES, '1日1時間〜2時間'], ['中学生', JUNIOR_COURSES, '1日2時間〜3時間']] as const).map(([cat, list, hint]) => (
              <div key={cat}>
                <div className={`flex items-center gap-2 mt-2 mb-2 px-1`}>
                  <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-lg ${cat === '小学生' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>{cat}コース</span>
                  <span className="text-xs text-gray-400">{hint}</span>
                </div>
                <div className="space-y-2.5">
                  {list.map(c => {
                    const sel = category === cat && course?.id === c.id
                    return (
                      <button key={c.id} onClick={() => selectCourse(cat, c)}
                        className={`w-full text-left bg-white rounded-2xl border-2 px-4 py-4 transition-all active:scale-[0.99]
                          ${sel ? (cat === '小学生' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-indigo-500 ring-2 ring-indigo-100') : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                              ${sel ? (cat === '小学生' ? 'border-emerald-500 bg-emerald-500' : 'border-indigo-500 bg-indigo-500') : 'border-gray-300'}`}>
                              {sel && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="font-bold text-gray-800 truncate">{c.name}</span>
                            {c.popular && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">人気</span>}
                          </div>
                          <span className={`text-lg font-bold flex-shrink-0 ${cat === '小学生' ? 'text-emerald-600' : 'text-indigo-600'}`}>{c.hours}H</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1.5 pl-8">こんな人向け：{c.target}</div>
                        <div className="text-xs text-gray-400 mt-0.5 pl-8">例：{c.example}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ══ ④ 日程選択 ══ */}
        {step === 'schedule' && course && (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-800">受講日程を選択してください</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                選択したコースの時間数に合わせて、受講希望日をお選びください。<br />
                満席の時間帯は選択できません。
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-16 z-10">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">選択中のコース</div>
                <div className="text-sm font-bold text-gray-800">{category} {course.name}</div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-500">必要時間数</div>
                <div className="text-sm font-bold text-gray-800">{fmtHours(requiredHours)}</div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-500">選択済み</span>
                  <span className={`text-base font-bold ${selectedHours === requiredHours ? 'text-green-600' : 'text-blue-600'}`}>{selectedHours}H／{requiredHours}H</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${selectedHours === requiredHours ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (selectedHours / requiredHours) * 100)}%` }} />
                </div>
                {selectedHours < requiredHours
                  ? <div className="text-xs text-gray-400 mt-1.5">あと {requiredHours - selectedHours}H 選んでください</div>
                  : <div className="text-xs text-green-600 mt-1.5 font-medium">必要時間数に達しました。確認画面に進めます。</div>}
              </div>
            </div>

            {/* 週ナビ */}
            <div className="flex items-center justify-between">
              <button onClick={() => { if (canPrevWeek) { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) } }}
                disabled={!canPrevWeek}
                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm disabled:opacity-30">‹</button>
              <span className="text-sm font-bold text-gray-700">{weekDays[0].getMonth() + 1}/{weekDays[0].getDate()} 〜 {weekDays[6].getMonth() + 1}/{weekDays[6].getDate()}</span>
              <button onClick={() => { if (canNextWeek) { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) } }}
                disabled={!canNextWeek}
                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm disabled:opacity-30">›</button>
            </div>

            {/* 日付チップ */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {weekDays.map(d => {
                const ds = toDateStr(d)
                const inP = inPeriod(ds)
                const isSunday = d.getDay() === 0
                const daySel = Array.from(selected).filter(k => k.startsWith(ds + '__')).length
                const isCur = selectedDay === ds
                return (
                  <button key={ds} disabled={!inP || isSunday} onClick={() => setSelectedDay(ds)}
                    className={`flex-shrink-0 flex flex-col items-center w-12 py-2 rounded-2xl transition-colors
                      ${!inP || isSunday ? 'opacity-30 pointer-events-none' : ''}
                      ${isCur ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}>
                    <span className="text-xs font-medium">{DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                    <span className="text-base font-bold">{d.getDate()}</span>
                    {daySel > 0 && <span className={`text-[10px] font-bold mt-0.5 ${isCur ? 'text-blue-100' : 'text-blue-600'}`}>{daySel * 0.5}H</span>}
                  </button>
                )
              })}
            </div>

            {/* 選択日のスロット */}
            {(() => {
              const d = new Date(selectedDay + 'T00:00:00')
              const slots = TIME_SLOTS.filter(s => slotAvailable(d, s))
              if (slots.length === 0) return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">この日は授業がありません</div>
              )
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="text-sm font-bold text-gray-700 mb-3">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map(slot => {
                      const st = cellState(selectedDay, slot)
                      const disabled = st === 'blocked' || st === 'booked' || st === 'full'
                      return (
                        <button key={slot} onClick={() => toggleSlot(selectedDay, slot)} disabled={disabled}
                          className={`h-14 rounded-xl text-sm font-bold flex flex-col items-center justify-center transition-all active:scale-95
                            ${st === 'selected' ? 'bg-blue-600 text-white shadow-md' : ''}
                            ${st === 'open' ? 'bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50' : ''}
                            ${st === 'full' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : ''}
                            ${st === 'booked' ? 'bg-teal-50 text-teal-400 border border-teal-100 cursor-not-allowed' : ''}
                            ${st === 'blocked' ? 'bg-gray-50 text-gray-200 cursor-not-allowed' : ''}`}>
                          <span>{slot}</span>
                          {st === 'full'   && <span className="text-[10px] font-medium">満席</span>}
                          {st === 'booked' && <span className="text-[10px] font-medium">予約済</span>}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />選択中</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" />満席</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-teal-50 border border-teal-100 inline-block" />予約済</span>
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* ══ ⑤ 確認 ══ */}
        {step === 'confirm' && course && (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-800">申込み内容を確認してください</h2>
              <p className="text-sm text-gray-500 mt-1">内容に間違いがないかご確認ください。</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
              <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">生徒名</span><span className="text-sm font-bold text-gray-800">{student.full_name}</span></div>
              <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">コース</span><span className="text-sm font-bold text-gray-800">{category} {course.name}</span></div>
              <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">必要時間数</span><span className="text-sm font-bold text-gray-800">{fmtHours(requiredHours)}</span></div>
              <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">合計時間数</span><span className="text-sm font-bold text-blue-600">{selectedHours}H</span></div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-600">選択した日程（{sortedSelected.length}コマ）</div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {sortedSelected.map(({ ds, slot }, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-700">{new Date(ds + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                    <span className="text-sm font-medium text-gray-800">{slot}〜{endTime(slot)}</span>
                  </div>
                ))}
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">{error}</div>}
          </>
        )}
      </main>

      {/* 下部固定ボタン */}
      {step === 'course' && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => { if (course) { setStep('schedule') } }} disabled={!course}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700 transition-colors">
            {course ? 'このコースで日程を選ぶ' : 'コースを選択してください'}
          </button>
        </div>
      )}
      {step === 'schedule' && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => setStep('confirm')} disabled={!canProceed}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700 transition-colors">
            {canProceed ? '確認画面へ進む' : `あと ${requiredHours - selectedHours}H 選んでください`}
          </button>
        </div>
      )}
      {step === 'confirm' && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 max-w-2xl mx-auto flex gap-2">
          <button onClick={() => setStep('schedule')} disabled={saving}
            className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-gray-50">
            戻って修正する
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700">
            {saving ? '送信中...' : 'この内容で申込む'}
          </button>
        </div>
      )}
    </div>
  )
}
