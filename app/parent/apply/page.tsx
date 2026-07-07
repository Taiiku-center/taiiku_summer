'use client'
import { useEffect, useRef, useState } from 'react'
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

const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日']

function getMondayOf(d: Date) {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0, 0, 0, 0); return m
}

type Step = 'course' | 'schedule' | 'confirm' | 'done'
type View = 'month' | 'week' | 'day'

function keyOf(ds: string, slot: string) { return `${ds}__${slot}` }

export default function SummerApplyPage() {
  const router = useRouter()
  const [student, setStudent]   = useState<SummerStudent | null>(null)
  const [step, setStep]         = useState<Step>('course')
  const [category, setCategory] = useState<'小学生' | '中学生' | null>(null)
  const [course, setCourse]     = useState<SummerCourse | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [slotCounts, setSlotCounts] = useState<Map<string, number>>(new Map())
  const [myExisting, setMyExisting] = useState<Set<string>>(new Set())
  const [view, setView]     = useState<View>('week')
  const [current, setCurrent] = useState(() => {
    const t = toDateStr(new Date())
    return t >= SUMMER_START ? new Date() : new Date(SUMMER_START + 'T00:00:00')
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // ドラッグ選択
  const dragActive         = useRef(false)
  const paintV             = useRef(true)
  const suppressNextClick  = useRef(false)
  const longPressTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressTouchClick = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setView('week')
  }, [])

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => { if (dragActive.current) e.preventDefault() }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', onTouchMove)
  }, [])

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
    } catch {}
  }

  const requiredHours = course?.hours ?? 0
  const requiredSlots = requiredHours * 2
  const selectedHours = selected.size * 0.5
  const canProceed = course != null && selected.size >= requiredSlots

  function selectCourse(cat: '小学生' | '中学生', c: SummerCourse) {
    setCategory(cat); setCourse(c); setSelected(new Set())
  }

  // ── カレンダー系 ──
  function isInSummer(d: Date) { const s = toDateStr(d); return s >= SUMMER_START && s <= SUMMER_END }
  function isBlocked(d: Date, slot: string) {
    const dow = d.getDay()
    return (dow === 1 || dow === 4) && ['10:00', '10:30', '11:00', '11:30'].includes(slot)
  }
  // 選択できないセル（期間外・受講不可・満席・予約済）
  function unavailable(d: Date, slot: string) {
    if (!isInSummer(d) || isBlocked(d, slot)) return true
    const k = keyOf(toDateStr(d), slot)
    if (myExisting.has(k)) return true
    if (!selected.has(k) && (slotCounts.get(k) || 0) >= SLOT_CAPACITY) return true
    return false
  }
  function key(d: Date, slot: string) { return keyOf(toDateStr(d), slot) }

  function toggleCell(d: Date, slot: string) {
    if (unavailable(d, slot)) return
    const k = key(d, slot)
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(k)) { n.delete(k); return n }
      n.add(k); return n
    })
  }
  function paintCell(d: Date, slot: string) {
    const k = key(d, slot)
    setSelected(prev => {
      const n = new Set(prev)
      if (paintV.current) {
        if (unavailable(d, slot) || n.has(k)) return n
        n.add(k)
      } else {
        n.delete(k)
      }
      return n
    })
  }

  function onCellPointerDown(e: React.PointerEvent, d: Date, slot: string) {
    if (unavailable(d, slot)) return
    if (e.pointerType === 'mouse') {
      suppressNextClick.current = true
      paintV.current = !selected.has(key(d, slot))
      dragActive.current = true
      paintCell(d, slot)
    } else {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null
        if (navigator.vibrate) navigator.vibrate(50)
        suppressTouchClick.current = true
        paintV.current = !selected.has(key(d, slot))
        dragActive.current = true
        paintCell(d, slot)
      }, 1200)
    }
  }
  function onCellPointerMove(e: React.PointerEvent) {
    if (!dragActive.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const ds2 = el?.dataset.ds, slot2 = el?.dataset.slot
    if (!ds2 || !slot2) return
    const [y, mo, d2] = ds2.split('-').map(Number)
    paintCell(new Date(y, mo - 1, d2), slot2)
  }
  function onCellPointerUp() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    dragActive.current = false
  }
  function handleCellClick(d: Date, slot: string) {
    if (suppressNextClick.current) { suppressNextClick.current = false; return }
    if (suppressTouchClick.current) { suppressTouchClick.current = false; return }
    if (unavailable(d, slot)) return
    toggleCell(d, slot)
  }

  function canGoPrev() {
    if (view === 'month') return !(current.getFullYear() === 2026 && current.getMonth() === 6)
    if (view === 'week') { const mon = getMondayOf(current); const p = new Date(mon); p.setDate(mon.getDate() - 1); return toDateStr(p) >= SUMMER_START }
    return toDateStr(current) > SUMMER_START
  }
  function canGoNext() {
    if (view === 'month') return !(current.getFullYear() === 2026 && current.getMonth() === 7)
    if (view === 'week') { const mon = getMondayOf(current); const n = new Date(mon); n.setDate(mon.getDate() + 7); return toDateStr(n) <= SUMMER_END }
    return toDateStr(current) < SUMMER_END
  }
  function navigatePrev() {
    if (!canGoPrev()) return
    setCurrent(d => { const n = new Date(d); if (view === 'month') n.setMonth(n.getMonth() - 1); else if (view === 'week') n.setDate(n.getDate() - 7); else n.setDate(n.getDate() - 1); return n })
  }
  function navigateNext() {
    if (!canGoNext()) return
    setCurrent(d => { const n = new Date(d); if (view === 'month') n.setMonth(n.getMonth() + 1); else if (view === 'week') n.setDate(n.getDate() + 7); else n.setDate(n.getDate() + 1); return n })
  }
  function weekDates() { const mon = getMondayOf(current); return DAYS_JP.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d }) }
  function displayTitle() {
    const w = weekDates()
    if (view === 'month') return `${current.getFullYear()}年${current.getMonth() + 1}月`
    if (view === 'week') return `${w[0].getMonth() + 1}/${w[0].getDate()} 〜 ${w[5].getMonth() + 1}/${w[5].getDate()}`
    const dow = ['日', '月', '火', '水', '木', '金', '土'][current.getDay()]
    return `${current.getMonth() + 1}/${current.getDate()}（${dow}）`
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
    if (appErr || !app) {
      console.error('summer_course_applications insert error', appErr)
      setError(`申込みに失敗しました。${appErr?.message ? `（${appErr.message}）` : ''}`)
      setSaving(false); return
    }

    const rows = Array.from(selected).map(k => {
      const [ds, slot] = k.split('__')
      return { student_id: student.id, full_name: student.full_name, date: ds, start_time: slot, end_time: endTime(slot), status: 'pending', application_id: app.id, course_name: course.name }
    })
    const { error: lessonErr } = await supabase.from('summer_lessons').insert(rows)
    if (lessonErr) {
      console.error('summer_lessons insert error', lessonErr)
      await supabase.from('summer_course_applications').delete().eq('id', app.id)
      setError(`日程の登録に失敗しました。${lessonErr.message ? `（${lessonErr.message}）` : ''}`)
      setSaving(false); return
    }
    await supabase.from('summer_notifications').insert({
      type: 'lesson', title: '夏期講習のコース申込みがありました',
      message: `${student.full_name}（${category} ${course.name}／${requiredHours}H）`, is_read: false,
    })
    sendEmail(
      `【コース申込】${student.full_name} ${category} ${course.name}`,
      `${student.full_name} さんが夏期講習を申し込みました。\nコース：${category} ${course.name}\n必要時間数：${requiredHours}H\n日程：\n` +
        rows.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time < b.start_time ? -1 : 1)
          .map(r => `・${r.date} ${r.start_time}〜${r.end_time}`).join('\n') + `\n合計：${selectedHours}H\n管理画面でご確認ください。`,
    )
    setSaving(false); setStep('done')
  }

  if (!student) return null

  // ── 完了 ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">夏期講習のお申込みを受け付けました</h2>
          <p className="text-sm text-gray-500 leading-relaxed">お申込みありがとうございます。<br />内容を確認のうえ、必要に応じて教室よりご連絡いたします。</p>
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
  const w = weekDates()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
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

      <main className="px-4 py-5 max-w-4xl mx-auto space-y-4 pb-10">

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
                <div className="flex items-center gap-2 mt-2 mb-2 px-1">
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
                        <div className="text-xs text-gray-400 mt-0.5 pl-8">受講時間：{c.hours}H（例：{c.example}）</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="h-16" />
          </>
        )}

        {/* ══ ④ 日程選択（月・週・日＋ドラッグ） ══ */}
        {step === 'schedule' && course && (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-800">受講日程を選択してください</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                選択したコースの時間数に合わせて、受講希望日をお選びください。<br />
                満席の時間帯は選択できません。
              </p>
            </div>

            {/* コース情報＋進捗 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">選択中のコース</span>
                <span className="text-sm font-bold text-gray-800">{category} {course.name}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500">必要時間数</span>
                <span className="text-sm font-bold text-gray-800">{requiredHours}H</span>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-500">選択済み</span>
                  <span className={`text-base font-bold ${selectedHours >= requiredHours ? 'text-green-600' : 'text-blue-600'}`}>{selectedHours}H／{requiredHours}H</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${selectedHours >= requiredHours ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (selectedHours / requiredHours) * 100)}%` }} />
                </div>
                {selectedHours < requiredHours
                  ? <div className="text-xs text-gray-400 mt-1.5">あと {requiredHours - selectedHours}H 選んでください</div>
                  : selectedHours === requiredHours
                    ? <div className="text-xs text-green-600 mt-1.5 font-medium">必要時間数に達しました。確認画面に進めます。</div>
                    : <div className="text-xs text-green-600 mt-1.5 font-medium">必要時間数を {selectedHours - requiredHours}H 超えています（このまま進めます）。</div>}
              </div>
            </div>

            {/* ビュー切替＋ナビ */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                {(['month', 'week', 'day'] as View[]).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                    {v === 'month' ? '月' : v === 'week' ? '週' : '日'}
                  </button>
                ))}
              </div>
              <button onClick={navigatePrev} disabled={!canGoPrev()} className="bg-gray-100 px-3 py-2 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30">←</button>
              <div className="flex-1 text-center font-bold text-gray-800 text-sm">{displayTitle()}</div>
              <button onClick={navigateNext} disabled={!canGoNext()} className="bg-gray-100 px-3 py-2 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30">→</button>
            </div>

            {view !== 'month' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-blue-400 rounded" />選択中</div>
                  <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-gray-200 rounded" />満席・受講不可</div>
                </div>
                <div className="text-xs text-gray-400">タップで1コマ選択 ／ 長押ししながらドラッグで複数選択</div>
              </div>
            )}

            {view === 'week' && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
                <span className="font-bold">月・木の10:00〜12:00</span>は授業がありません（斜線部分は選択不可）
              </div>
            )}

            {/* 週グリッド */}
            {view === 'week' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden select-none">
                <div className="overflow-x-auto" onContextMenu={e => e.preventDefault()} onPointerUp={onCellPointerUp} onPointerLeave={onCellPointerUp}>
                  <div className="min-w-[360px] overflow-y-auto" style={{ maxHeight: '60vh', WebkitUserSelect: 'none', userSelect: 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, 1fr)' }}>
                      <div className="border-b border-r border-gray-200 bg-white sticky top-0 left-0 z-20" />
                      {w.slice(0, 6).map((d, i) => {
                        const inS = isInSummer(d)
                        return (
                          <div key={i} className={`border-b border-r border-gray-200 py-2 text-center text-xs font-bold leading-tight bg-white sticky top-0 z-10 ${i === 5 ? 'text-blue-500' : 'text-gray-600'} ${!inS ? 'opacity-30' : ''}`}>
                            {DAYS_JP[i]}<br /><span className="font-normal text-gray-400">{d.getMonth() + 1}/{d.getDate()}</span>
                          </div>
                        )
                      })}
                      {TIME_SLOTS.map(slot => (
                        <div key={slot} className="contents">
                          <div className="border-b border-r border-gray-200 flex items-center justify-end pr-1.5 text-xs text-gray-400 h-10 whitespace-nowrap bg-white sticky left-0 z-[5]">{slot}</div>
                          {w.slice(0, 6).map((d, di) => {
                            const sel = selected.has(key(d, slot))
                            const inS = isInSummer(d)
                            const blocked = isBlocked(d, slot)
                            const unavail = unavailable(d, slot)
                            return (
                              <div key={di}
                                data-ds={toDateStr(d)} data-slot={slot}
                                onPointerDown={e => onCellPointerDown(e, d, slot)}
                                onPointerMove={onCellPointerMove}
                                onPointerUp={onCellPointerUp}
                                onClick={() => handleCellClick(d, slot)}
                                className={`border-b border-r border-gray-200 h-10 transition-colors
                                  ${sel ? 'bg-blue-400 cursor-pointer' :
                                    !inS || blocked ? 'bg-gray-50 cursor-not-allowed' :
                                    unavail ? 'bg-gray-200 cursor-not-allowed' :
                                    'hover:bg-blue-50 active:bg-blue-100 cursor-pointer'}`}
                                style={blocked ? { backgroundImage: 'repeating-linear-gradient(45deg, #d1d5db 0px, #d1d5db 1px, transparent 1px, transparent 6px)' } : undefined}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 月グリッド */}
            {view === 'month' && (() => {
              const y = current.getFullYear(), m = current.getMonth()
              const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
              const firstDow = first.getDay() === 0 ? 0 : first.getDay() - 1
              const selDates = new Set(Array.from(selected).map(k => k.split('__')[0]))
              const allDays: Date[] = []
              for (let d = 1; d <= last.getDate(); d++) { const date = new Date(y, m, d); if (date.getDay() !== 0) allDays.push(date) }
              const cells: (Date | null)[] = [...Array(firstDow).fill(null), ...allDays]
              while (cells.length % 6 !== 0) cells.push(null)
              return (
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="grid grid-cols-6 mb-1">
                    {['月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`text-center text-xs font-bold py-2 ${i === 5 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>))}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {cells.map((d, i) => {
                      if (!d) return <div key={i} />
                      const ds = toDateStr(d), has = selDates.has(ds)
                      const inS = isInSummer(d)
                      const isToday = ds === toDateStr(new Date()), dow = d.getDay()
                      return (
                        <button key={i} disabled={!inS} onClick={() => { if (inS) { setCurrent(d); setView('week') } }}
                          className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors
                            ${!inS ? 'text-gray-200' : isToday ? 'bg-blue-600 text-white' : dow === 6 ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}>
                          {d.getDate()}
                          {has && inS && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-blue-500'}`} />}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">日付をタップすると週ビューに切り替わります{selDates.size > 0 ? '（● = 選択中）' : ''}</p>
                </div>
              )
            })()}

            {/* 日リスト */}
            {view === 'day' && (() => {
              if (current.getDay() === 0) return (<div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">日曜日は授業がありません</div>)
              const slots = TIME_SLOTS.filter(slot => !isBlocked(current, slot))
              return (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {slots.map(slot => {
                    const sel = selected.has(key(current, slot))
                    const unavail = unavailable(current, slot)
                    return (
                      <button key={slot} onClick={() => toggleCell(current, slot)} disabled={unavail && !sel}
                        className={`w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100 text-left transition-colors active:opacity-70
                          ${sel ? 'bg-blue-50' : unavail ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                        <span className="text-sm font-medium text-gray-500 w-14 flex-shrink-0">{slot}</span>
                        <div className={`flex-1 h-2.5 rounded-full ${sel ? 'bg-blue-400' : unavail ? 'bg-gray-200' : 'bg-gray-100'}`} />
                        {sel && <span className="text-xs font-semibold text-blue-600 flex-shrink-0">選択中</span>}
                        {!sel && unavail && <span className="text-xs font-semibold text-gray-400 flex-shrink-0">満席・不可</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            <button onClick={() => setStep('confirm')} disabled={!canProceed}
              className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700 transition-colors">
              {canProceed ? '確認画面へ進む' : `あと ${requiredHours - selectedHours}H 選んでください`}
            </button>
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
              <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">必要時間数</span><span className="text-sm font-bold text-gray-800">{requiredHours}H</span></div>
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
            <div className="flex gap-2">
              <button onClick={() => setStep('schedule')} disabled={saving} className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-gray-50">戻って修正する</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700">{saving ? '送信中...' : 'この内容で申込む'}</button>
            </div>
          </>
        )}
      </main>

      {step === 'course' && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => { if (course) setStep('schedule') }} disabled={!course}
              className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700 transition-colors">
              {course ? 'このコースで日程を選ぶ' : 'コースを選択してください'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
