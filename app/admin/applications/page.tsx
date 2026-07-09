'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { endTime, cleanupEmptyApplications, type SummerCourseApplication, type SummerLesson, type CourseCategory } from '../../lib'

const CAT_BADGE: Record<CourseCategory, string> = {
  '小学生': 'bg-emerald-500',
  '中学生': 'bg-indigo-500',
  '在塾生': 'bg-amber-500',
}

const STATUS_LABEL: Record<string, string> = { pending: '申請済', confirmed: '確定', cancelled: '取消' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

function formatDate(ds: string) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function SummerAdminApplicationsPage() {
  const router = useRouter()
  const [apps, setApps]       = useState<SummerCourseApplication[]>([])
  const [lessons, setLessons] = useState<SummerLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | CourseCategory>('all')
  const [openId, setOpenId]   = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const supabase = createClient()
    const [a, l] = await Promise.all([
      supabase.from('summer_course_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('summer_lessons').select('*').not('application_id', 'is', null).neq('status', 'cancelled'),
    ])
    const allApps = a.data || []
    const allLessons = l.data || []

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

  const lessonsOf = (appId: string) => lessons
    .filter(l => l.application_id === appId)
    .sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.start_time < y.start_time ? -1 : 1)

  const filtered = filter === 'all' ? apps : apps.filter(a => a.course_category === filter)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">コース申込み一覧</h1>
          <p className="text-xs text-gray-400">夏期講習</p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '申込み総数', count: apps.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '小学生', count: apps.filter(a => a.course_category === '小学生').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '中学生', count: apps.filter(a => a.course_category === '中学生').length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: '在塾生', count: apps.filter(a => a.course_category === '在塾生').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {(['all', '小学生', '中学生', '在塾生'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? 'すべて' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">コース申込みはまだありません</div>
        ) : filtered.map(app => {
          const ls = lessonsOf(app.id)
          const open = openId === app.id
          return (
            <div key={app.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenId(open ? null : app.id)} className="w-full text-left px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${CAT_BADGE[app.course_category] || 'bg-gray-500'}`}>{app.course_category}</span>
                    <span className="font-bold text-gray-800 truncate">{app.full_name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[app.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[app.status] || app.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{app.course_name}</span>
                  <span className="text-sm font-bold text-blue-600">{app.required_hours > 0 ? `${app.total_hours}H／${app.required_hours}H` : `${app.total_hours}H（制限なし）`}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">日程 {ls.length}コマ　{open ? '▲ 閉じる' : '▼ 詳細を見る'}</div>
              </button>
              {open && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                  {ls.length === 0 ? (
                    <div className="text-sm text-gray-400 py-2">紐付く日程が見つかりません</div>
                  ) : (
                    <div className="space-y-1.5">
                      {ls.map(l => (
                        <div key={l.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{formatDate(l.date)}</span>
                          <span className="font-medium text-gray-800">{l.start_time}〜{l.end_time || endTime(l.start_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
