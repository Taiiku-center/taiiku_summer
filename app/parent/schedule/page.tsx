'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import {
  getSession, TIME_SLOTS, endTime, toDateStr, SUMMER_START, SUMMER_END,
  getSelectedCourse, clearSelectedCourse,
  type SummerLesson, type SummerStudent, type SelectedCourse,
} from '../../lib'

const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日']
const NOTIFY_EMAIL = 'kusunoki.infinite@gmail.com'

// 分を「X時間Y分」に整形（1コマ=30分）
function formatDuration(min: number) {
  if (min <= 0) return '0分'
  const h = Math.floor(min / 60), m = min % 60
  return `${h > 0 ? `${h}時間` : ''}${m > 0 ? `${m}分` : ''}`
}

function getMondayOf(d: Date) {
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0,0,0,0); return m
}

async function sendEmail(subject: string, body: string) {
  try {
    await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ _subject: subject, message: body, _captcha: 'false' }),
    })
  } catch {}
}

type View = 'month' | 'week' | 'day'

type CourseStep = 'schedule' | 'confirm' | 'done'

export default function SummerSchedulePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>}>
      <SummerScheduleInner />
    </Suspense>
  )
}

function SummerScheduleInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCourseMode = searchParams.get('course') === '1'
  const [courseInfo, setCourseInfo] = useState<SelectedCourse | null>(null)
  const [courseStep, setCourseStep] = useState<CourseStep>('schedule')
  const [courseSaving, setCourseSaving] = useState(false)
  const [courseError, setCourseError] = useState('')

  const [student, setStudent] = useState<SummerStudent | null>(null)
  const [existing, setExisting] = useState<SummerLesson[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [view, setView] = useState<View>('week')
  const [current, setCurrent] = useState(() => {
    const t = toDateStr(new Date())
    return t >= SUMMER_START ? new Date() : new Date(SUMMER_START + 'T00:00:00')
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgIsError, setMsgIsError] = useState(false)
  const [cancelModal, setCancelModal] = useState<SummerLesson | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  useEffect(() => {
    if (!isCourseMode) return
    const c = getSelectedCourse()
    if (!c) { router.replace('/parent/apply'); return }
    setCourseInfo(c)
  }, [isCourseMode, router])

  // スマホ幅では週ビューをデフォルトに
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setView('week')
  }, [])

  // PC drag
  const dragActive         = useRef(false)
  const paintV             = useRef(true)
  const suppressNextClick  = useRef(false)
  // Touch long press & drag
  const longPressTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressTouchClick = useRef(false)
  // 長押しドラッグ中はページ全体のスクロールを止めてセル選択を優先
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => { if (dragActive.current) e.preventDefault() }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', onTouchMove)
  }, [])

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
  }, [router])

  useEffect(() => { if (student) fetchExisting() }, [student])

  async function fetchExisting() {
    if (!student) return
    const supabase = createClient()
    const { data } = await supabase.from('summer_lessons')
      .select('*').eq('student_id', student.id).neq('status', 'cancelled')
      .gte('date', SUMMER_START).lte('date', SUMMER_END)
    setExisting(data || [])
  }

  function existingAt(dateObj: Date, slot: string) {
    const ds = toDateStr(dateObj)
    return existing.find(l => l.date === ds && l.start_time === slot)
  }

  async function cancelLesson(id: string) {
    const supabase = createClient()
    setExisting(prev => prev.filter(l => l.id !== id))
    setCancelModal(null)
    setCancelConfirm(false)
    await supabase.from('summer_lessons').delete().eq('id', id)
    setMsg('キャンセルしました。新しい日時を選んで申込みできます')
    setMsgIsError(false)
    setTimeout(() => setMsg(''), 5000)
  }

  async function handleSubmit() {
    if (!student || selected.size === 0) return
    setSaving(true)
    const supabase = createClient()
    const rows = Array.from(selected).map(k => {
      const sep = k.indexOf('__')
      const ds = k.slice(0, sep), slot = k.slice(sep + 2)
      return { student_id: student.id, full_name: student.full_name, date: ds, start_time: slot, end_time: endTime(slot), status: 'pending' }
    })
    const count = rows.length
    const { error } = await supabase.from('summer_lessons').insert(rows)
    if (!error) {
      await supabase.from('summer_notifications').insert({
        type: 'lesson', title: '新しい授業申込みがありました',
        message: `${student.full_name}（${count}コマ）`, is_read: false,
      })
      for (const row of rows) {
        sendEmail(`【申込】${student.full_name} ${row.date} ${row.start_time}〜`, `${student.full_name} さんが授業を申し込みました。\n日付：${row.date}\n時間：${row.start_time}〜${row.end_time}\n管理画面でご確認ください。`)
      }
    }
    setSaving(false)
    if (error) {
      setMsg('申込みの送信に失敗しました。再度お試しください。')
      setMsgIsError(true)
      setTimeout(() => setMsg(''), 5000)
    } else {
      setMsg(`✅ ${count}コマの申込みが完了しました`)
      setMsgIsError(false)
      setSelected(new Set())
    }
    await fetchExisting()
  }

  const courseRequiredHours = courseInfo?.hours ?? 0
  const courseRequiredSlots = courseRequiredHours * 2
  const courseSelectedHours = selected.size * 0.5
  const courseCanProceed = selected.size >= courseRequiredSlots && selected.size > 0

  async function handleCourseSubmit() {
    if (!student || !courseInfo || !courseCanProceed) return
    setCourseSaving(true); setCourseError('')
    const supabase = createClient()
    const { data: app, error: appErr } = await supabase.from('summer_course_applications').insert({
      student_id: student.id, full_name: student.full_name,
      course_category: courseInfo.category, course_name: courseInfo.name,
      required_hours: courseRequiredHours, total_hours: courseSelectedHours, status: 'pending',
    }).select('id').single()
    if (appErr || !app) {
      setCourseError(`申込みに失敗しました。${appErr?.message ? `（${appErr.message}）` : ''}`)
      setCourseSaving(false); return
    }
    const rows = Array.from(selected).map(k => {
      const sep = k.indexOf('__')
      const ds = k.slice(0, sep), slot = k.slice(sep + 2)
      return {
        student_id: student.id, full_name: student.full_name, date: ds, start_time: slot, end_time: endTime(slot),
        status: 'pending', application_id: app.id, course_name: courseInfo.name,
      }
    })
    const { error: lessonErr } = await supabase.from('summer_lessons').insert(rows)
    if (lessonErr) {
      await supabase.from('summer_course_applications').delete().eq('id', app.id)
      setCourseError(`日程の登録に失敗しました。${lessonErr.message ? `（${lessonErr.message}）` : ''}`)
      setCourseSaving(false); return
    }
    await supabase.from('summer_notifications').insert({
      type: 'lesson', title: '夏期講習のコース申込みがありました',
      message: `${student.full_name}（${courseInfo.category} ${courseInfo.name}／${courseRequiredHours}H）`, is_read: false,
    })
    sendEmail(
      `【コース申込】${student.full_name} ${courseInfo.category} ${courseInfo.name}`,
      `${student.full_name} さんが夏期講習を申し込みました。\nコース：${courseInfo.category} ${courseInfo.name}\n必要時間数：${courseRequiredHours}H\n日程：\n` +
        rows.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time < b.start_time ? -1 : 1)
          .map(r => `・${r.date} ${r.start_time}〜${r.end_time}`).join('\n') + `\n合計：${courseSelectedHours}H\n管理画面でご確認ください。`,
    )
    clearSelectedCourse()
    setCourseSaving(false)
    setCourseStep('done')
    setSelected(new Set())
    await fetchExisting()
  }

  function key(dateObj: Date, slot: string) { return `${toDateStr(dateObj)}__${slot}` }

  function toggleCell(dateObj: Date, slot: string) {
    const lesson = existingAt(dateObj, slot)
    if (lesson) { setCancelModal(lesson); return }
    const k = key(dateObj, slot)
    setSelected(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  function paintCell(dateObj: Date, slot: string) {
    if (existingAt(dateObj, slot)) return
    const k = key(dateObj, slot)
    setSelected(prev => { const n = new Set(prev); paintV.current ? n.add(k) : n.delete(k); return n })
  }

  function isInSummer(d: Date) { const s = toDateStr(d); return s >= SUMMER_START && s <= SUMMER_END }

  function isBlocked(d: Date, slot: string) {
    const dow = d.getDay()
    return (dow === 1 || dow === 4) && ['10:00', '10:30', '11:00', '11:30'].includes(slot)
  }

  function onCellPointerDown(e: React.PointerEvent, d: Date, slot: string) {
    if (!isInSummer(d) || isBlocked(d, slot)) return
    if (e.pointerType === 'mouse') {
      suppressNextClick.current = true
      const lesson = existingAt(d, slot)
      if (lesson) { setCancelModal(lesson); return }
      paintV.current = !selected.has(key(d, slot))
      dragActive.current = true
      paintCell(d, slot)
    } else {
      // タッチ: 1.5秒長押しでドラッグ開始
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null
        if (navigator.vibrate) navigator.vibrate(50)
        const lesson = existingAt(d, slot)
        if (lesson) return
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
    if (!isInSummer(d) || isBlocked(d, slot)) return
    toggleCell(d, slot)
  }

  function canGoPrev() {
    if (view === 'month') return !(current.getFullYear() === 2026 && current.getMonth() === 6)
    if (view === 'week') {
      const mon = getMondayOf(current)
      const prevSun = new Date(mon); prevSun.setDate(mon.getDate() - 1)
      return toDateStr(prevSun) >= SUMMER_START
    }
    return toDateStr(current) > SUMMER_START
  }

  function canGoNext() {
    if (view === 'month') return !(current.getFullYear() === 2026 && current.getMonth() === 7)
    if (view === 'week') {
      const mon = getMondayOf(current)
      const nextMon = new Date(mon); nextMon.setDate(mon.getDate() + 7)
      return toDateStr(nextMon) <= SUMMER_END
    }
    return toDateStr(current) < SUMMER_END
  }

  function navigatePrev() {
    if (!canGoPrev()) return
    setCurrent(d => {
      const n = new Date(d)
      if (view === 'month') n.setMonth(n.getMonth() - 1)
      else if (view === 'week') n.setDate(n.getDate() - 7)
      else n.setDate(n.getDate() - 1)
      return n
    })
  }

  function navigateNext() {
    if (!canGoNext()) return
    setCurrent(d => {
      const n = new Date(d)
      if (view === 'month') n.setMonth(n.getMonth() + 1)
      else if (view === 'week') n.setDate(n.getDate() + 7)
      else n.setDate(n.getDate() + 1)
      return n
    })
  }

  function weekDates() {
    const mon = getMondayOf(current)
    return DAYS_JP.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
  }

  function displayTitle() {
    const wd = weekDates()
    if (view === 'month') return `${current.getFullYear()}年${current.getMonth() + 1}月`
    if (view === 'week') return `${wd[0].getMonth()+1}/${wd[0].getDate()} 〜 ${wd[5].getMonth()+1}/${wd[5].getDate()}`
    const dow = ['日','月','火','水','木','金','土'][current.getDay()]
    return `${current.getMonth()+1}/${current.getDate()}（${dow}）`
  }

  if (!student) return null

  const wd = weekDates()

  function formatCancelInfo(lesson: SummerLesson) {
    const d = new Date(lesson.date + 'T12:00:00')
    const dateStr = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    return { dateStr, timeStr: `${lesson.start_time}〜${lesson.end_time}` }
  }

  // ══ コース申込みモード：完了画面 ══
  if (isCourseMode && courseStep === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">夏期講習のお申込みを受け付けました</h2>
          <p className="text-sm text-gray-500 leading-relaxed">お申込みありがとうございます。<br />内容を確認のうえ、必要に応じて教室よりご連絡いたします。</p>
          {courseInfo && (
            <div className="bg-blue-50 rounded-2xl p-4 text-left text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">コース</span><span className="font-bold text-blue-700">{courseInfo.category} {courseInfo.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">合計時間数</span><span className="font-bold text-blue-700">{courseSelectedHours}H</span></div>
            </div>
          )}
          <button onClick={() => router.push('/parent')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700">ホームに戻る</button>
          <button onClick={() => router.push('/parent/calendar')} className="w-full border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">授業予定を確認する</button>
        </div>
      </div>
    )
  }

  // ══ コース申込みモード：確認画面 ══
  if (isCourseMode && courseStep === 'confirm' && courseInfo) {
    const sortedSelected = Array.from(selected).map(k => {
      const sep = k.indexOf('__')
      return { ds: k.slice(0, sep), slot: k.slice(sep + 2) }
    }).sort((a, b) => a.ds < b.ds ? -1 : a.ds > b.ds ? 1 : a.slot < b.slot ? -1 : 1)
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setCourseStep('schedule')} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold active:bg-gray-200">← 戻る</button>
            <h1 className="text-base font-bold text-gray-800">申込み内容を確認してください</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          <p className="text-sm text-gray-500">内容に間違いがないかご確認ください。</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">生徒名</span><span className="text-sm font-bold text-gray-800">{student.full_name}</span></div>
            <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">コース</span><span className="text-sm font-bold text-gray-800">{courseInfo.category} {courseInfo.name}</span></div>
            <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">必要時間数</span><span className="text-sm font-bold text-gray-800">{courseRequiredHours}H</span></div>
            <div className="flex justify-between px-5 py-4"><span className="text-sm text-gray-500">合計時間数</span><span className="text-sm font-bold text-blue-600">{courseSelectedHours}H</span></div>
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
          {courseError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">{courseError}</div>}
          <div className="flex gap-2">
            <button onClick={() => setCourseStep('schedule')} disabled={courseSaving} className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-gray-50">戻って修正する</button>
            <button onClick={handleCourseSubmit} disabled={courseSaving} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700">{courseSaving ? '送信中...' : 'この内容で申込む'}</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push(isCourseMode ? '/parent/apply' : '/parent')} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold active:bg-gray-200">← 戻る</button>
          <h1 className="text-base font-bold text-gray-800">{isCourseMode ? '受講日程を選択してください' : '授業を申し込む'}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-4 space-y-4">
        {isCourseMode && courseInfo && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">選択中のコース</span>
              <span className="text-sm font-bold text-gray-800">{courseInfo.category} {courseInfo.name}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">必要時間数</span>
              <span className="text-sm font-bold text-gray-800">{courseRequiredHours}H</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-500">選択済み</span>
                <span className={`text-base font-bold ${courseSelectedHours >= courseRequiredHours ? 'text-green-600' : 'text-blue-600'}`}>{courseSelectedHours}H／{courseRequiredHours}H</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${courseSelectedHours >= courseRequiredHours ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, (courseSelectedHours / courseRequiredHours) * 100)}%` }} />
              </div>
              {courseSelectedHours < courseRequiredHours
                ? <div className="text-xs text-gray-400 mt-1.5">{courseSelectedHours}H 選択中です</div>
                : courseSelectedHours === courseRequiredHours
                  ? <div className="text-xs text-green-600 mt-1.5 font-medium">必要時間数に達しました。確認画面に進めます。</div>
                  : <div className="text-xs text-green-600 mt-1.5 font-medium">必要時間数を {courseSelectedHours - courseRequiredHours}H 超えています（このまま進めます）。</div>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['month','week','day'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                {v === 'month' ? '月' : v === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>
          <button onClick={navigatePrev} disabled={!canGoPrev()}
            className="bg-gray-100 px-3 py-2 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30">←</button>
          <div className="flex-1 text-center font-bold text-gray-800 text-sm">{displayTitle()}</div>
          <button onClick={navigateNext} disabled={!canGoNext()}
            className="bg-gray-100 px-3 py-2 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30">→</button>
        </div>

        {view !== 'month' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-blue-400 rounded" />選択中</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-4 bg-teal-400 rounded" />選択済（タップで変更・キャンセル）</div>
            </div>
            <div className="text-xs text-gray-400">タップで1コマ選択 ／ 長押ししながらドラッグで複数選択</div>
          </div>
        )}

        {view === 'week' && (
          <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700">
            <span className="font-bold">月・木の10:00〜12:00</span>は授業がありません（斜線部分は選択不可）
          </div>
        )}

        {/* 週グリッド: JSXをインラインで記述することでstate更新時の再マウントを防止 */}
        {view === 'week' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden select-none">
            <div
              className="overflow-x-auto"
              onContextMenu={e => e.preventDefault()}
              onPointerUp={onCellPointerUp}
              onPointerLeave={onCellPointerUp}>
              <div
                className="min-w-[360px] overflow-y-auto"
                style={{ maxHeight: '65vh', WebkitUserSelect: 'none', userSelect: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(6, 1fr)' }}>
                  <div className="border-b border-r border-gray-200 bg-white sticky top-0 left-0 z-20" />
                  {wd.slice(0, 6).map((d, i) => {
                    const inS = isInSummer(d)
                    return (
                      <div key={i} className={`border-b border-r border-gray-200 py-2 text-center text-xs font-bold leading-tight bg-white sticky top-0 z-10
                        ${i===5?'text-blue-500':'text-gray-600'} ${!inS ? 'opacity-30' : ''}`}>
                        {DAYS_JP[i]}<br/><span className="font-normal text-gray-400">{d.getMonth()+1}/{d.getDate()}</span>
                      </div>
                    )
                  })}
                  {TIME_SLOTS.map(slot => (
                    <div key={slot} className="contents">
                      <div className="border-b border-r border-gray-200 flex items-center justify-end pr-1.5 text-xs text-gray-400 h-10 whitespace-nowrap bg-white sticky left-0 z-[5]">
                        {slot}
                      </div>
                      {wd.slice(0, 6).map((d, di) => {
                        const lesson = existingAt(d, slot)
                        const sel = selected.has(key(d, slot))
                        const inS = isInSummer(d)
                        const blocked = isBlocked(d, slot)
                        return (
                          <div key={di}
                            data-ds={toDateStr(d)} data-slot={slot}
                            onPointerDown={e => onCellPointerDown(e, d, slot)}
                            onPointerMove={onCellPointerMove}
                            onPointerUp={onCellPointerUp}
                            onClick={() => handleCellClick(d, slot)}
                            className={`border-b border-r border-gray-200 h-10 transition-colors
                              ${!inS || blocked ? 'bg-gray-50 cursor-not-allowed' :
                                lesson ? 'bg-teal-400 active:bg-teal-300 cursor-pointer' :
                                sel ? 'bg-blue-400 cursor-pointer' :
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
          const first = new Date(y, m, 1), last = new Date(y, m+1, 0)
          const firstDow = first.getDay() === 0 ? 0 : first.getDay() - 1
          const submittedDates = new Set(existing.map(l => l.date))
          const allDays: Date[] = []
          for (let d = 1; d <= last.getDate(); d++) {
            const date = new Date(y, m, d)
            if (date.getDay() !== 0) allDays.push(date)
          }
          const cells: (Date|null)[] = [...Array(firstDow).fill(null), ...allDays]
          while (cells.length % 6 !== 0) cells.push(null)
          return (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="grid grid-cols-6 mb-1">
                {['月','火','水','木','金','土'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-bold py-2 ${i===5?'text-blue-500':'text-gray-500'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <div key={i} />
                  const ds = toDateStr(d), has = submittedDates.has(ds)
                  const inS = isInSummer(d)
                  const isToday = ds === toDateStr(new Date()), dow = d.getDay()
                  return (
                    <button key={i} disabled={!inS} onClick={() => { if (inS) { setCurrent(d); setView('week') } }}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors
                        ${!inS ? 'text-gray-200' : isToday ? 'bg-blue-600 text-white' :
                          dow===6 ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}>
                      {d.getDate()}
                      {has && inS && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-teal-500'}`} />}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                日付をタップすると週ビューに切り替わります{submittedDates.size > 0 ? '（● = 選択済）' : ''}
              </p>
            </div>
          )
        })()}

        {/* 日リスト */}
        {view === 'day' && (() => {
          const dow = current.getDay()
          if (dow === 0) return (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">
              日曜日は授業がありません
            </div>
          )
          const slots = TIME_SLOTS.filter(slot => !isBlocked(current, slot))
          return (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {slots.map(slot => {
                const lesson = existingAt(current, slot)
                const sel = selected.has(key(current, slot))
                return (
                  <button key={slot} onClick={() => toggleCell(current, slot)}
                    className={`w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100 text-left transition-colors active:opacity-70
                      ${lesson ? 'bg-teal-50' : sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <span className="text-sm font-medium text-gray-500 w-14 flex-shrink-0">{slot}</span>
                    <div className={`flex-1 h-2.5 rounded-full ${lesson ? 'bg-teal-400' : sel ? 'bg-blue-400' : 'bg-gray-100'}`} />
                    {lesson && <span className="text-xs font-semibold text-teal-600 flex-shrink-0">選択済 ✕</span>}
                    {!lesson && sel && <span className="text-xs font-semibold text-blue-600 flex-shrink-0">選択中</span>}
                  </button>
                )
              })}
            </div>
          )
        })()}

        {!isCourseMode && msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-between gap-3
            ${msgIsError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
            <span>{msg}</span>
            {!msgIsError && (
              <button onClick={() => router.push('/parent/calendar')}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0">
                カレンダーで確認 →
              </button>
            )}
          </div>
        )}

        {view !== 'month' && !isCourseMode && (
          <button onClick={handleSubmit} disabled={saving || selected.size === 0}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl text-base font-medium active:bg-blue-700 disabled:opacity-50">
            {saving ? '送信中...' : view === 'day'
              ? `${displayTitle()}の内容で申込む（${formatDuration(selected.size * 30)}）`
              : `この内容で申込む（${formatDuration(selected.size * 30)}）`}
          </button>
        )}

        {view !== 'month' && isCourseMode && courseInfo && (
          <button onClick={() => setCourseStep('confirm')} disabled={!courseCanProceed}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl text-base font-medium active:bg-blue-700 disabled:opacity-50">
            {courseCanProceed ? '確認画面へ進む' : `${courseSelectedHours}H 選択中です`}
          </button>
        )}
      </main>

      {cancelModal && (() => {
        const { dateStr, timeStr } = formatCancelInfo(cancelModal)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className="p-5 space-y-4">
                <h2 className="text-base font-bold text-gray-800">選択済みの日時</h2>
                <div className="bg-teal-50 rounded-xl p-4 space-y-1">
                  <div className="text-sm font-semibold text-teal-700">{dateStr}</div>
                  <div className="text-lg font-bold text-teal-800">{timeStr}</div>
                </div>
                {!cancelConfirm ? (
                  <>
                    <p className="text-sm text-gray-500">変更する場合は、この申込みをキャンセルしてから新しい日時を選んでください。</p>
                    <div className="space-y-2">
                      <button onClick={() => setCancelConfirm(true)}
                        className="w-full bg-red-50 text-red-600 border-2 border-red-200 py-3 rounded-xl text-sm font-bold active:bg-red-100">
                        キャンセルして変更する
                      </button>
                      <button onClick={() => { setCancelModal(null); setCancelConfirm(false) }}
                        className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium active:bg-gray-200">
                        このままにする
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700 font-medium text-center">
                      本当にキャンセルしますか？<br/>
                      <span className="text-xs font-normal text-red-500">この操作は取り消せません</span>
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => cancelLesson(cancelModal.id)}
                        className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-bold active:bg-red-600">
                        はい、キャンセルします
                      </button>
                      <button onClick={() => setCancelConfirm(false)}
                        className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium active:bg-gray-200">
                        やめる
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
