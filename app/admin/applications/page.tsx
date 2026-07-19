'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import {
  endTime, cleanupEmptyApplications, lessonMinutes, SUMMER_START, SUMMER_END,
  ELEMENTARY_COURSES, JUNIOR_COURSES, RESIDENT_COURSES,
  type SummerCourseApplication, type SummerLesson, type CourseCategory, type SummerCourse,
} from '../../lib'
import GuideBox from '../../components/GuideBox'

type AdminCategory = CourseCategory | '高校生'

const CAT_BADGE: Record<AdminCategory, string> = {
  '小学生': 'bg-emerald-500',
  '中学生': 'bg-indigo-500',
  '在塾生': 'bg-amber-500',
  '高校生': 'bg-sky-500',
}

// 高校生（②）は「コースを選ぶ」機能がなく、予約した時間をそのまま集計した仮想エントリとして表示する
type HsApp = {
  id: string
  student_id: string
  full_name: string
  course_category: '高校生'
  course_name: ''
  required_hours: 0
  total_hours: number
  status: 'confirmed'
  created_at: string
  synthetic: true
}

const CATEGORY_COURSES: Record<CourseCategory, SummerCourse[]> = {
  '小学生': ELEMENTARY_COURSES,
  '中学生': JUNIOR_COURSES,
  '在塾生': RESIDENT_COURSES,
}

const STATUS_LABEL: Record<string, string> = { pending: '申請済', confirmed: '確定', cancelled: '取消' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-black',
}

function formatDate(ds: string) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function SummerAdminApplicationsPage() {
  const router = useRouter()
  const [apps, setApps]       = useState<SummerCourseApplication[]>([])
  const [lessons, setLessons] = useState<SummerLesson[]>([])
  const [lessons2, setLessons2] = useState<SummerLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | AdminCategory>('all')
  const [openId, setOpenId]   = useState<string | null>(null)

  const [changeTarget, setChangeTarget] = useState<SummerCourseApplication | null>(null)
  const [changeCategory, setChangeCategory] = useState<CourseCategory>('在塾生')
  const [changeCourseId, setChangeCourseId] = useState<string>('')
  const [changeError, setChangeError] = useState('')
  const [changing, setChanging] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const supabase = createClient()
    const [a, l, l2] = await Promise.all([
      supabase.from('summer_course_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('summer_lessons').select('*').not('application_id', 'is', null).neq('status', 'cancelled'),
      supabase.from('summer_lessons2').select('*').gte('date', SUMMER_START).lte('date', SUMMER_END).neq('status', 'cancelled'),
    ])
    const allApps = a.data || []
    const allLessons = l.data || []
    setLessons2(l2.data || [])

    // 授業が0件になった申込み（キャンセル等で孤立したもの）を自動整理
    const lessonAppIds = new Set(allLessons.map(x => x.application_id))
    const orphanIds = allApps.filter(app => !lessonAppIds.has(app.id)).map(app => app.id)
    if (orphanIds.length > 0) {
      await cleanupEmptyApplications(supabase, orphanIds)
      setApps(allApps.filter(app => !orphanIds.includes(app.id)))
    } else {
      setApps(allApps)
    }
    setLessons(allLessons)
    setLoading(false)
  }

  function openChangeModal(app: SummerCourseApplication) {
    setChangeTarget(app)
    setChangeCategory(app.course_category)
    const current = CATEGORY_COURSES[app.course_category].find(c => c.name === app.course_name)
    setChangeCourseId(current?.id || CATEGORY_COURSES[app.course_category][0]?.id || '')
    setChangeError('')
  }

  async function handleChangeCourse() {
    if (!changeTarget) return
    const newCourse = CATEGORY_COURSES[changeCategory].find(c => c.id === changeCourseId)
    if (!newCourse) { setChangeError('コースを選択してください'); return }
    setChanging(true)
    setChangeError('')
    const supabase = createClient()
    // total_hours（これまでの申込み時間）は変更せず引き継ぐ
    const { error } = await supabase.from('summer_course_applications')
      .update({ course_category: changeCategory, course_name: newCourse.name, required_hours: newCourse.hours })
      .eq('id', changeTarget.id)
    setChanging(false)
    if (error) {
      console.error('change course failed:', error)
      setChangeError('変更に失敗しました。時間をおいて再度お試しください')
      return
    }
    setChangeTarget(null)
    setFilter(changeCategory)
    setOpenId(changeTarget.id)
    fetchAll()
  }

  const lessonsOf = (appId: string) => lessons
    .filter(l => l.application_id === appId)
    .sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.start_time < y.start_time ? -1 : 1)

  const lessonsOfHs = (studentId: string) => lessons2
    .filter(l => l.student_id === studentId)
    .sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.start_time < y.start_time ? -1 : 1)

  // ②（高校生）の予約を生徒ごとに集計した仮想エントリ。コース申込みの仕組みはないので、常に生成する
  const hsApps: HsApp[] = (() => {
    const byStudent = new Map<string, { full_name: string; minutes: number; latest: string }>()
    for (const l of lessons2) {
      const cur = byStudent.get(l.student_id) || { full_name: l.full_name, minutes: 0, latest: l.date }
      cur.minutes += lessonMinutes(l.start_time, l.end_time)
      if (l.date > cur.latest) cur.latest = l.date
      byStudent.set(l.student_id, cur)
    }
    return Array.from(byStudent.entries())
      .map(([student_id, v]) => ({
        id: `hs-${student_id}`, student_id, full_name: v.full_name,
        course_category: '高校生' as const, course_name: '' as const, required_hours: 0 as const,
        total_hours: Math.round((v.minutes / 60) * 10) / 10, status: 'confirmed' as const,
        created_at: v.latest, synthetic: true as const,
      }))
      .sort((a, b) => a.full_name < b.full_name ? -1 : a.full_name > b.full_name ? 1 : 0)
  })()

  const allEntries: (SummerCourseApplication | HsApp)[] = [...apps, ...hsApps]
  const filtered = filter === 'all' ? allEntries : allEntries.filter(a => a.course_category === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-black text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-black">コース申込み一覧</h1>
          <p className="text-xs text-black">夏期講習</p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        <GuideBox
          bullets={[
            '小学生・中学生・在塾生の絞り込みでコース申込みを確認できます。',
            '高校生（②）はコース申込みの仕組みがないため、予約時間を自動集計して表示しています。',
            'カードをタップすると、選択された日程の詳細が見られます。',
          ]}
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: '申込み総数', count: apps.length + hsApps.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '小学生', count: apps.filter(a => a.course_category === '小学生').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '中学生', count: apps.filter(a => a.course_category === '中学生').length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: '在塾生', count: apps.filter(a => a.course_category === '在塾生').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '高校生', count: hsApps.length, color: 'text-sky-600', bg: 'bg-sky-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-black mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', '在塾生', '小学生', '中学生', '高校生'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-black hover:bg-gray-50'}`}>
              {f === 'all' ? 'すべて' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-black py-16">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-black">コース申込みはまだありません</div>
        ) : filtered.map(app => {
          const isHs = 'synthetic' in app
          const ls = isHs ? lessonsOfHs(app.student_id) : lessonsOf(app.id)
          const open = openId === app.id
          return (
            <div key={app.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenId(open ? null : app.id)} className="w-full text-left px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${CAT_BADGE[app.course_category] || 'bg-gray-500'}`}>{app.course_category}</span>
                    <span className="font-bold text-black truncate">{app.full_name}</span>
                  </div>
                  {!isHs && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[app.status] || 'bg-gray-100 text-black'}`}>{STATUS_LABEL[app.status] || app.status}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black">{!isHs && app.required_hours > 0 ? app.course_name : ''}</span>
                  <span className="text-sm font-bold text-blue-600">{app.required_hours > 0 ? `${app.total_hours}H／${app.required_hours}H` : `${app.total_hours}H（制限なし）`}</span>
                </div>
                <div className="text-xs text-black mt-1">日程 {ls.length}コマ　{open ? '▲ 閉じる' : '▼ 詳細を見る'}</div>
              </button>
              {open && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-3">
                  {ls.length === 0 ? (
                    <div className="text-sm text-black py-2">紐付く日程が見つかりません</div>
                  ) : (
                    <div className="space-y-1.5">
                      {ls.map(l => (
                        <div key={l.id} className="flex items-center justify-between text-sm">
                          <span className="text-black">{formatDate(l.date)}</span>
                          <span className="font-medium text-black">{l.start_time}〜{l.end_time || endTime(l.start_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isHs && (
                    <button onClick={() => openChangeModal(app)}
                      className="w-full bg-white border border-blue-200 text-blue-600 font-bold py-2.5 rounded-xl text-sm active:bg-blue-50">
                      コースを変更する
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </main>

      {changeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-black">コースを変更</h2>
            <div className="text-sm text-black">{changeTarget.full_name} さん</div>
            <div>
              <label className="block text-xs font-semibold text-black mb-1.5">区分</label>
              <div className="flex gap-2">
                {(['在塾生', '小学生', '中学生'] as CourseCategory[]).map(cat => (
                  <button key={cat} onClick={() => { setChangeCategory(cat); setChangeCourseId(CATEGORY_COURSES[cat][0]?.id || '') }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors
                      ${changeCategory === cat ? `${CAT_BADGE[cat]} text-white` : 'bg-gray-100 text-black'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-black mb-1.5">コース</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {CATEGORY_COURSES[changeCategory].map(c => (
                  <button key={c.id} onClick={() => setChangeCourseId(c.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors
                      ${changeCourseId === c.id ? 'border-blue-500 bg-blue-50 font-bold text-blue-700' : 'border-gray-200 text-black'}`}>
                    {c.unlimited ? changeCategory : `${c.name}（${c.hours}H${c.openEnded ? '〜' : ''}）`}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-black">これまでの申込み時間（{changeTarget.total_hours}H）は引き継がれます。</div>
            {changeError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 text-center font-medium">{changeError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setChangeTarget(null)} disabled={changing}
                className="flex-1 bg-gray-100 text-black py-3 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-40">キャンセル</button>
              <button onClick={handleChangeCourse} disabled={changing}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-40">{changing ? '変更中...' : '変更する'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
