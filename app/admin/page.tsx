'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { TIME_SLOTS, endTime, toDateStr, SUMMER_START, SUMMER_END, type SummerLesson, type SummerAbsence, type SummerNotification } from '../lib'

type AdminView = 'month' | 'week' | 'day'
type LessonRow = SummerLesson & { site: '①' | '②' }

const DOW = ['月', '火', '水', '木', '金', '土', '日']
const STATUS_COLOR: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-green-100 text-green-800' }
const STATUS_LABEL: Record<string, string> = { pending: '申請済', confirmed: '確定' }

function SiteBadge({ site }: { site: '①' | '②' }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 align-middle
      ${site === '②' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
      {site === '②' ? '②高' : '①小中'}
    </span>
  )
}

// 生徒ごとの固定色（名前から決定的に割り当て）
const STUDENT_PALETTE = [
  { bg: 'bg-red-100',     text: 'text-red-800',     bar: 'bg-red-400',     dot: 'bg-red-500' },
  { bg: 'bg-orange-100',  text: 'text-orange-800',  bar: 'bg-orange-400',  dot: 'bg-orange-500' },
  { bg: 'bg-amber-100',   text: 'text-amber-800',   bar: 'bg-amber-400',   dot: 'bg-amber-500' },
  { bg: 'bg-lime-100',    text: 'text-lime-800',    bar: 'bg-lime-400',    dot: 'bg-lime-500' },
  { bg: 'bg-green-100',   text: 'text-green-800',   bar: 'bg-green-400',   dot: 'bg-green-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', bar: 'bg-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-teal-100',    text: 'text-teal-800',    bar: 'bg-teal-400',    dot: 'bg-teal-500' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-800',    bar: 'bg-cyan-400',    dot: 'bg-cyan-500' },
  { bg: 'bg-sky-100',     text: 'text-sky-800',     bar: 'bg-sky-400',     dot: 'bg-sky-500' },
  { bg: 'bg-blue-100',    text: 'text-blue-800',    bar: 'bg-blue-400',    dot: 'bg-blue-500' },
  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  bar: 'bg-indigo-400',  dot: 'bg-indigo-500' },
  { bg: 'bg-violet-100',  text: 'text-violet-800',  bar: 'bg-violet-400',  dot: 'bg-violet-500' },
  { bg: 'bg-purple-100',  text: 'text-purple-800',  bar: 'bg-purple-400',  dot: 'bg-purple-500' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', bar: 'bg-fuchsia-400', dot: 'bg-fuchsia-500' },
  { bg: 'bg-pink-100',    text: 'text-pink-800',    bar: 'bg-pink-400',    dot: 'bg-pink-500' },
  { bg: 'bg-rose-100',    text: 'text-rose-800',    bar: 'bg-rose-400',    dot: 'bg-rose-500' },
]

function clampToSummer(d: Date): Date {
  const ds = toDateStr(d)
  if (ds < SUMMER_START) return new Date(SUMMER_START + 'T00:00:00')
  if (ds > SUMMER_END)   return new Date(SUMMER_END   + 'T00:00:00')
  return d
}

export default function SummerAdminPage() {
  const router = useRouter()
  const [view, setView] = useState<AdminView>('week')
  const [lessons,  setLessons]  = useState<LessonRow[]>([])
  const [absences, setAbsences] = useState<SummerAbsence[]>([])
  const [notifs,   setNotifs]   = useState<SummerNotification[]>([])
  const [loading,  setLoading]  = useState(true)

  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(SUMMER_START + 'T00:00:00'))

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const t = toDateStr(new Date())
    const base = t >= SUMMER_START && t <= SUMMER_END ? new Date() : new Date(SUMMER_START + 'T00:00:00')
    const d = new Date(base)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  })

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = toDateStr(new Date())
    return t >= SUMMER_START && t <= SUMMER_END ? t : SUMMER_START
  })

  const [selectedCell, setSelectedCell] = useState<{ date: string; slot: string } | null>(null)
  const [printStudentId, setPrintStudentId] = useState<string>('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const supabase = createClient()
    const [l, l2, a, n] = await Promise.all([
      supabase.from('summer_lessons').select('*').gte('date', SUMMER_START).lte('date', SUMMER_END).neq('status', 'cancelled').order('date').order('start_time'),
      supabase.from('summer_lessons2').select('*').gte('date', SUMMER_START).lte('date', SUMMER_END).neq('status', 'cancelled').order('date').order('start_time'),
      supabase.from('summer_absences').select('*').gte('date', SUMMER_START).lte('date', SUMMER_END).order('date'),
      supabase.from('summer_notifications').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(20),
    ])
    const merged: LessonRow[] = [
      ...(l.data  || []).map(r => ({ ...r, site: '①' as const })),
      ...(l2.data || []).map(r => ({ ...r, site: '②' as const })),
    ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time < b.start_time ? -1 : 1)
    setLessons(merged)
    setAbsences(a.data || [])
    setNotifs(n.data || [])
    setLoading(false)
  }

  // 生徒ごとに重複しない色を割り当て（名前を並べてパレット順に配色）
  const studentColorMap = useMemo(() => {
    const names = Array.from(new Set(lessons.map(l => l.full_name))).sort()
    const m = new Map<string, typeof STUDENT_PALETTE[number]>()
    names.forEach((n, i) => m.set(n, STUDENT_PALETTE[i % STUDENT_PALETTE.length]))
    return m
  }, [lessons])
  const colorOf = (name: string) => studentColorMap.get(name) || STUDENT_PALETTE[0]

  // 予約のある生徒一覧（生徒別カレンダー印刷用）
  const students = useMemo(() => {
    const m = new Map<string, { id: string; name: string; site: '①' | '②' }>()
    lessons.forEach(l => { if (!m.has(l.student_id)) m.set(l.student_id, { id: l.student_id, name: l.full_name, site: l.site }) })
    return Array.from(m.values()).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  }, [lessons])

  const lessonsAt  = (date: string, slot: string) => lessons.filter(l => l.date === date && l.start_time === slot)
  const absencesAt = (date: string, slot: string) => absences.filter(a => a.date === date && a.time === slot)
  const dailyCount = (date: string) => new Set(lessons.filter(l => l.date === date).map(l => l.full_name)).size
  const inSummer   = (ds: string) => ds >= SUMMER_START && ds <= SUMMER_END

  // ── Month ──
  const canPrevMonth = !(viewMonth.getFullYear() === 2026 && viewMonth.getMonth() === 6)
  const canNextMonth = !(viewMonth.getFullYear() === 2026 && viewMonth.getMonth() === 7)
  function monthDays(): (Date | null)[] {
    const year = viewMonth.getFullYear(), month = viewMonth.getMonth()
    const monthFirst = new Date(year, month, 1)
    const monthLast  = new Date(year, month + 1, 0)
    const periStart  = new Date(SUMMER_START + 'T00:00:00')
    const periEnd    = new Date(SUMMER_END   + 'T00:00:00')
    const effStart   = monthFirst < periStart ? periStart : monthFirst
    const effEnd     = monthLast  > periEnd   ? periEnd   : monthLast
    const startDow   = (effStart.getDay() + 6) % 7
    const days: (Date | null)[] = Array(startDow).fill(null)
    const cur = new Date(effStart)
    while (toDateStr(cur) <= toDateStr(effEnd)) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    while (days.length % 7 !== 0) days.push(null)
    return days
  }

  // ── Week ──
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })
  const canPrevWeek = toDateStr(weekStart) > SUMMER_START
  const canNextWeek = (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); return toDateStr(d) <= SUMMER_END })()
  function prevWeek() { if (!canPrevWeek) return; const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  function nextWeek() { if (!canNextWeek) return; const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  // ── Day ──
  const canPrevDay = selectedDate > SUMMER_START
  const canNextDay = selectedDate < SUMMER_END
  function prevDay() {
    if (!canPrevDay) return
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1)
    setSelectedDate(toDateStr(clampToSummer(d)))
  }
  function nextDay() {
    if (!canNextDay) return
    const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1)
    setSelectedDate(toDateStr(clampToSummer(d)))
  }

  const today = toDateStr(new Date())
  const daySlots = TIME_SLOTS.filter(slot => lessonsAt(selectedDate, slot).length > 0 || absencesAt(selectedDate, slot).length > 0)

  function downloadCSV() {
    const rows: string[][] = [['区分', '日付', '曜日', '時間帯', '生徒名', 'ステータス', '欠席・遅刻']]
    const sorted = [...lessons].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time < b.start_time ? -1 : 1)
    sorted.forEach(l => {
      const d = new Date(l.date + 'T00:00:00')
      const dow = DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]
      const abs = absences.find(a => a.student_id === l.student_id && a.date === l.date && a.time === l.start_time)
      rows.push([
        l.site === '②' ? '②高校生ほか' : '①小中学生',
        l.date, dow, `${l.start_time}〜${l.end_time}`, l.full_name,
        STATUS_LABEL[l.status] || l.status,
        abs ? `${abs.type}（振替：${abs.make_up_request}）` : ''
      ])
    })
    const bom = '﻿'
    const csv = bom + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = '夏期講習スケジュール.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function printStudentCalendar(studentId: string) {
    const stu = students.find(s => s.id === studentId)
    if (!stu) return
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
    const mine = lessons.filter(l => l.student_id === studentId)
    const byDate: Record<string, LessonRow[]> = {}
    mine.forEach(l => { (byDate[l.date] = byDate[l.date] || []).push(l) })
    const absOf = (date: string, time: string) => absences.find(a => a.student_id === studentId && a.date === date && a.time === time)
    const primary = '#111827'   // 白黒印刷でも見やすいよう黒基調
    const light   = '#e6e6e6'   // 授業のある日の網掛け（グレー）
    const dowH = ['月', '火', '水', '木', '金', '土', '日']

    function monthGrid(y: number, m: number) {
      const first = new Date(y, m, 1)
      const last = new Date(y, m + 1, 0)
      const startDow = (first.getDay() + 6) % 7
      const cells: string[] = []
      for (let i = 0; i < startDow; i++) cells.push('<td class="empty"></td>')
      for (let d = 1; d <= last.getDate(); d++) {
        const dateObj = new Date(y, m, d)
        const ds = toDateStr(dateObj)
        const dow = dateObj.getDay()
        const items = (byDate[ds] || []).slice().sort((a, b) => a.start_time < b.start_time ? -1 : 1)
        const inP = ds >= SUMMER_START && ds <= SUMMER_END
        let inner = `<div class="dnum ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}">${d}</div>`
        items.forEach(l => {
          const ab = absOf(ds, l.start_time)
          inner += `<div class="ev ${ab ? 'abs' : ''}">${l.start_time}〜${l.end_time}${ab ? `<span class="tag">${esc(ab.type)}</span>` : ''}</div>`
        })
        cells.push(`<td class="${items.length ? 'has' : ''} ${!inP ? 'out' : ''}">${inner}</td>`)
      }
      while (cells.length % 7 !== 0) cells.push('<td class="empty"></td>')
      let rows = ''
      for (let i = 0; i < cells.length; i += 7) rows += `<tr>${cells.slice(i, i + 7).join('')}</tr>`
      const head = `<tr>${dowH.map((h, i) => `<th class="${i === 6 ? 'sun' : i === 5 ? 'sat' : ''}">${h}</th>`).join('')}</tr>`
      return `<table class="cal"><caption>${y}年${m + 1}月</caption><thead>${head}</thead><tbody>${rows}</tbody></table>`
    }

    // 夏期講習期間にかかる月を列挙
    const monthsSet = new Set<string>()
    const cur = new Date(SUMMER_START + 'T00:00:00')
    const end = new Date(SUMMER_END + 'T00:00:00')
    while (cur <= end) { monthsSet.add(`${cur.getFullYear()}-${cur.getMonth()}`); cur.setDate(cur.getDate() + 1) }
    const grids = Array.from(monthsSet).map(k => { const [y, m] = k.split('-').map(Number); return monthGrid(y, m) }).join('')

    const hasAbs = mine.some(l => absOf(l.date, l.start_time))

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${esc(stu.name)} 授業カレンダー</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Yu Gothic","YuGothic","Meiryo",sans-serif; color:#111827; margin:0; padding:24px; }
  .head { display:flex; align-items:center; justify-content:space-between; border-bottom:4px solid ${primary}; padding-bottom:12px; margin-bottom:14px; }
  .name { font-size:26px; font-weight:800; }
  .sub { font-size:13px; color:#374151; margin-top:4px; }
  .badge { border:2px solid ${primary}; color:${primary}; font-weight:800; font-size:14px; padding:6px 14px; border-radius:8px; }
  .count { font-size:13px; color:#111827; margin-bottom:6px; font-weight:600; }
  .legend { font-size:11px; color:#374151; margin-bottom:14px; }
  .legend .box { display:inline-block; width:12px; height:12px; background:${light}; border:1px solid #111827; vertical-align:-1px; margin-right:3px; }
  .cals { display:flex; flex-wrap:wrap; gap:20px; }
  table.cal { border-collapse:collapse; width:340px; }
  table.cal caption { text-align:left; font-weight:800; font-size:16px; margin-bottom:6px; }
  table.cal th { font-size:11px; font-weight:700; color:#111827; padding:4px 0; border-bottom:2px solid #111827; }
  table.cal td { width:14.28%; height:58px; vertical-align:top; border:1px solid #9ca3af; padding:3px; }
  td.empty { background:#ffffff; border:1px solid #e5e7eb; }
  td.out { background:#f3f4f6; }
  td.has { background:${light}; border:2px solid #111827; }
  .dnum { font-size:11px; font-weight:700; color:#111827; }
  td.has .dnum { font-weight:800; }
  .ev { font-size:11px; font-weight:800; color:#111827; margin-top:2px; line-height:1.3; }
  .ev.abs { text-decoration:line-through; font-weight:700; }
  .ev .tag { display:inline-block; text-decoration:none; border:1px solid #111827; background:#ffffff; color:#111827; border-radius:3px; padding:0 3px; margin-left:2px; font-size:9px; font-weight:700; }
  .foot { margin-top:20px; font-size:11px; color:#6b7280; text-align:center; }
  @page { size:A4; margin:12mm; }
  @media print { .noprint { display:none; } }
</style></head><body>
  <div class="head">
    <div><div class="name">${esc(stu.name)} さん</div><div class="sub">夏期講習 授業カレンダー ／ ${SUMMER_START}〜${SUMMER_END}</div></div>
    <div class="badge">${stu.site === '②' ? '② 高校生ほか' : '① 小・中学生'}</div>
  </div>
  <div class="count">申込み授業数：${mine.length}コマ</div>
  <div class="legend"><span class="box"></span>網掛け＝授業のある日${hasAbs ? '　／　取り消し線＝欠席・遅刻連絡あり' : ''}</div>
  <div class="cals">${grids}</div>
  <div class="foot">大育進学センター 夏期講習</div>
  <button class="noprint" onclick="window.print()" style="position:fixed;top:12px;right:12px;padding:8px 16px;font-size:14px;background:${primary};color:#fff;border:none;border-radius:8px;cursor:pointer;">印刷 / PDF保存</button>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) { alert('ポップアップがブロックされました。ブラウザのポップアップ許可を確認してください。'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { try { w.print() } catch {} }, 400)
  }

  function DayDetail({ date }: { date: string }) {
    const slots = TIME_SLOTS.filter(slot => lessonsAt(date, slot).length > 0 || absencesAt(date, slot).length > 0)
    if (slots.length === 0) return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
        この日の申込みはありません
      </div>
    )
    return (
      <div className="space-y-3">
        {slots.map(slot => {
          const sL = lessonsAt(date, slot)
          const sA = absencesAt(date, slot)
          return (
            <div key={slot} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{slot}〜{endTime(slot)}</span>
                <span className="text-xs text-blue-600 font-semibold">{sL.length}名</span>
              </div>
              <div className="divide-y divide-gray-50">
                {sL.map(l => {
                  const abs = sA.find(a => a.full_name === l.full_name)
                  const sc = colorOf(l.full_name)
                  return (
                    <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                        <div>
                          <div className="text-sm font-bold text-gray-800"><SiteBadge site={l.site} />{l.full_name}</div>
                          {abs && <div className="text-xs text-orange-600 mt-0.5">⚠ {abs.type}・振替：{abs.make_up_request}</div>}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[l.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[l.status] || l.status}
                      </span>
                    </div>
                  )
                })}
                {sA.filter(a => !sL.some(l => l.full_name === a.full_name)).map(a => (
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
        })}
      </div>
    )
  }

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

      {/* 月・週・日 切替 + CSV */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['month', 'week', 'day'] as AdminView[]).map((v, i) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors
                ${view === v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {['月', '週', '日'][i]}
            </button>
          ))}
        </div>
        <button onClick={downloadCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
          ⬇ CSV出力
        </button>
      </div>

      {/* 生徒別カレンダー印刷 */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500">生徒別カレンダー</span>
        <select value={printStudentId} onChange={e => setPrintStudentId(e.target.value)}
          className="flex-1 min-w-[160px] max-w-xs text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700">
          <option value="">生徒を選択…</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.site}　{s.name}</option>
          ))}
        </select>
        <button onClick={() => printStudentId && printStudentCalendar(printStudentId)}
          disabled={!printStudentId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 transition-colors">
          🖨 カレンダー印刷 / PDF
        </button>
      </div>

      <main className="px-3 py-4 max-w-5xl mx-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-16">読み込み中...</div>
        ) : (
          <>
            {/* ══ 月ビュー ══ */}
            {view === 'month' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    disabled={!canPrevMonth}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">‹</button>
                  <span className="text-sm font-bold text-gray-700">{viewMonth.getFullYear()}年{viewMonth.getMonth() + 1}月</span>
                  <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    disabled={!canNextMonth}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">›</button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-gray-100">
                    {DOW.map((d, i) => (
                      <div key={d} className={`text-center text-xs font-bold py-2 ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-gray-100">
                    {monthDays().map((d, i) => {
                      if (!d) return <div key={i} className="bg-white min-h-[56px]" />
                      const ds = toDateStr(d)
                      const count = dailyCount(ds)
                      const isToday = ds === today
                      const isSel = ds === selectedDate
                      const dow = d.getDay()
                      return (
                        <button key={ds}
                          onClick={() => { setSelectedDate(ds); setView('day') }}
                          className={`bg-white min-h-[56px] p-1.5 flex flex-col items-start hover:bg-blue-50 transition-colors text-left
                            ${isSel ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
                          <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-blue-600 text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                            {d.getDate()}
                          </span>
                          {count > 0 && <span className="mt-0.5 text-xs font-semibold text-blue-600">{count}名</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ 週ビュー ══ */}
            {view === 'week' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={prevWeek} disabled={!canPrevWeek} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">‹</button>
                  <span className="text-sm font-bold text-gray-700">
                    {weekDays[0].getMonth()+1}/{weekDays[0].getDate()} 〜 {weekDays[6].getMonth()+1}/{weekDays[6].getDate()}
                  </span>
                  <button onClick={nextWeek} disabled={!canNextWeek} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">›</button>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
                  {weekDays.map(d => {
                    const ds = toDateStr(d)
                    const inS = inSummer(ds)
                    const count = dailyCount(ds)
                    const isToday = ds === today
                    const isSel = selectedDate === ds
                    const dow = DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]
                    return (
                      <button key={ds} disabled={!inS} onClick={() => { setSelectedDate(ds); setSelectedCell(null) }}
                        className={`flex-shrink-0 flex flex-col items-center w-12 py-2 rounded-2xl transition-colors
                          ${!inS ? 'invisible pointer-events-none' : ''}
                          ${isSel ? 'bg-blue-600 text-white shadow-md' : isToday ? 'bg-blue-50 text-blue-600' : 'bg-white border border-gray-200 text-gray-600'}`}>
                        <span className="text-xs font-medium">{dow}</span>
                        <span className="text-base font-bold">{d.getDate()}</span>
                        {count > 0 && <span className={`text-xs font-bold mt-0.5 ${isSel ? 'text-blue-100' : 'text-blue-600'}`}>{count}名</span>}
                      </button>
                    )
                  })}
                </div>

                <div className="md:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-gray-700">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                      <span className="text-blue-600 ml-2">{dailyCount(selectedDate)}名</span>
                    </h2>
                  </div>
                  <DayDetail date={selectedDate} />
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="w-16 sticky left-0 bg-gray-50 z-10 border border-gray-200 text-xs text-gray-500 py-2 px-1">時間</th>
                        {weekDays.map(d => {
                          const ds = toDateStr(d); const inS = inSummer(ds)
                          const count = dailyCount(ds); const isToday = ds === today
                          const dow = DOW[d.getDay() === 0 ? 6 : d.getDay() - 1]
                          return (
                            <th key={ds} onClick={() => setSelectedDate(ds)}
                              className={`border border-gray-200 py-2 px-2 text-xs font-semibold cursor-pointer min-w-[140px]
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
                            const ds = toDateStr(d); const inS = inSummer(ds)
                            const cL = lessonsAt(ds, slot); const cA = absencesAt(ds, slot)
                            const isSel = selectedCell?.date === ds && selectedCell?.slot === slot
                            const hasData = cL.length > 0 || cA.length > 0
                            return (
                              <td key={ds}
                                onClick={() => hasData && inS && setSelectedCell(isSel ? null : { date: ds, slot })}
                                className={`border border-gray-200 p-1.5 align-top text-xs min-h-[48px]
                                  ${!inS ? 'bg-gray-50' : ''}
                                  ${isSel ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}
                                  ${hasData && inS ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                                <div className="space-y-0.5">
                                  {cL.map(l => {
                                    const sc = colorOf(l.full_name)
                                    return (
                                    <div key={l.id} className={`rounded px-1.5 py-1 leading-snug font-medium text-xs flex items-center gap-0.5 ${sc.bg} ${sc.text} ${l.status !== 'confirmed' ? 'ring-1 ring-inset ring-gray-400/40' : ''}`}>
                                      <span className="font-bold opacity-60">{l.site}</span>{l.full_name}{l.status !== 'confirmed' && <span className="opacity-60">(申)</span>}{cA.some(a => a.full_name === l.full_name) && <span className="text-orange-500 ml-0.5">⚠</span>}
                                    </div>
                                    )
                                  })}
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
                        const sc = colorOf(l.full_name)
                        return (
                          <div key={l.id} className={`flex items-stretch gap-3 rounded-xl p-3 overflow-hidden relative ${sc.bg}`}>
                            <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${sc.bar}`} />
                            <div className="flex-1 pl-1.5">
                              <div className="font-semibold text-gray-800 text-sm"><SiteBadge site={l.site} />{l.full_name}</div>
                              {abs && <div className="text-xs text-orange-600 mt-0.5">{abs.type}・振替：{abs.make_up_request}{abs.note && `（${abs.note}）`}</div>}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[l.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[l.status] || l.status}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══ 日ビュー ══ */}
            {view === 'day' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={prevDay} disabled={!canPrevDay}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">‹</button>
                  <span className="text-sm font-bold text-gray-700">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                    <span className="text-blue-600 ml-2">{dailyCount(selectedDate)}名</span>
                  </span>
                  <button onClick={nextDay} disabled={!canNextDay}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm text-lg hover:bg-gray-50 disabled:opacity-30">›</button>
                </div>
                <DayDetail date={selectedDate} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
