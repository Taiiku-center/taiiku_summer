'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import {
  getSession, ELEMENTARY_COURSES, JUNIOR_COURSES, RESIDENT_COURSES, setSelectedCourse,
  lessonMinutes, formatHM, findRecommendedCourse,
  type SummerStudent, type SummerCourse, type CourseCategory, type SummerCourseApplication,
} from '../../lib'
import GuideBox from '../../components/GuideBox'

const CATEGORY_COLOR: Record<CourseCategory, { badge: string; border: string; ring: string; dot: string; text: string }> = {
  '小学生': { badge: 'bg-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  '中学生': { badge: 'bg-indigo-500',  border: 'border-indigo-500',  ring: 'ring-indigo-100',  dot: 'bg-indigo-500',  text: 'text-indigo-600' },
  '在塾生': { badge: 'bg-amber-500',   border: 'border-amber-500',   ring: 'ring-amber-100',   dot: 'bg-amber-500',   text: 'text-amber-600' },
}

const CATEGORY_GROUPS: { cat: CourseCategory; list: SummerCourse[]; hint: string }[] = [
  { cat: '小学生', list: ELEMENTARY_COURSES, hint: '1日1時間〜2時間' },
  { cat: '中学生', list: JUNIOR_COURSES,     hint: '1日2時間〜3時間' },
  { cat: '在塾生', list: RESIDENT_COURSES,   hint: '時間数の制限なし' },
]

function findCourse(category: CourseCategory, name: string): SummerCourse | null {
  const group = CATEGORY_GROUPS.find(g => g.cat === category)
  return group?.list.find(c => c.name === name) || null
}

type Mode = 'loading' | 'confirm' | 'select'

export default function SummerApplyCoursePage() {
  const router = useRouter()
  const [student, setStudent]   = useState<SummerStudent | null>(null)
  const [mode, setMode]         = useState<Mode>('loading')
  const [existingApp, setExistingApp] = useState<SummerCourseApplication | null>(null)
  const [appliedMinutes, setAppliedMinutes] = useState(0)
  const [category, setCategory] = useState<CourseCategory | null>(null)
  const [course, setCourse]     = useState<SummerCourse | null>(null)
  const [openCat, setOpenCat]   = useState<CourseCategory | null>('小学生')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
    fetchLatestApplication(s.id)
  }, [router])

  async function fetchLatestApplication(studentId: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('summer_course_applications')
        .select('*').eq('student_id', studentId).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data) {
        setExistingApp(data)
        setMode('confirm')
        fetchAppliedMinutes(studentId, data.course_name)
      } else {
        setMode('select')
      }
    } catch {
      setMode('select')
    }
  }

  // 同じコース（course_name一致）で実際に申込み済みの授業時間（分）を、
  // summer_lessons の実データから毎回計算する（個別キャンセルがあってもズレない）
  async function fetchAppliedMinutes(studentId: string, courseName: string) {
    try {
      const supabase = createClient()
      const { data } = await supabase.from('summer_lessons')
        .select('start_time, end_time')
        .eq('student_id', studentId).eq('course_name', courseName).neq('status', 'cancelled')
      const mins = (data || []).reduce((sum, l) => sum + lessonMinutes(l.start_time, l.end_time), 0)
      setAppliedMinutes(mins)
    } catch { /* 表示できなくても致命的ではないため握りつぶす */ }
  }

  if (!student || mode === 'loading') return null

  function selectCourse(cat: CourseCategory, c: SummerCourse) {
    setCategory(cat); setCourse(c)
  }

  function goToScheduleWith(cat: CourseCategory, c: SummerCourse) {
    setSelectedCourse({ category: cat, id: c.id, name: c.name, hours: c.hours, unlimited: c.unlimited, openEnded: c.openEnded })
    router.push('/parent/schedule?course=1')
  }

  function goToSchedule() {
    if (!course || !category) return
    goToScheduleWith(category, course)
  }

  function startChangeCourse() {
    if (existingApp) {
      const matched = findCourse(existingApp.course_category, existingApp.course_name)
      if (matched) { setCategory(existingApp.course_category); setCourse(matched); setOpenCat(existingApp.course_category) }
    }
    setMode('select')
  }

  const existingIsUnlimited = existingApp ? existingApp.required_hours === 0 : false
  const recommendedForExisting = existingApp
    ? findRecommendedCourse(existingApp.course_category, { hours: existingApp.required_hours, unlimited: existingIsUnlimited }, appliedMinutes)
    : null

  // ══ 既にコースを選んだことがある場合：現在のコースを表示 ══
  if (mode === 'confirm' && existingApp) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => router.push('/parent')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-800">夏期講習の申込み</h1>
            <p className="text-xs text-gray-400">{student.full_name} さん</p>
          </div>
        </header>

        <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
          <GuideBox alwaysOpen
            steps={[
              '現在選択中のコースで日程を選ぶか、コースを変更するか選びます。',
              '「コースを変更する」を選ぶと、コース一覧から選び直せます。',
            ]}
            note="コースを間違えていた場合は「コースを変更する」からやり直せます。"
          />

          <div className={`rounded-2xl border-2 p-5 ${CATEGORY_COLOR[existingApp.course_category].border} bg-white`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-lg ${CATEGORY_COLOR[existingApp.course_category].badge}`}>{existingApp.course_category}</span>
            </div>
            <div className="text-sm text-gray-500">現在選択しているコース</div>
            <div className="text-xl font-bold text-gray-800 mt-1">{existingApp.course_name}</div>
            {existingApp.required_hours > 0 && (
              <div className="text-sm text-gray-500 mt-2">コースの合計時間：<span className="font-bold text-gray-800">{existingApp.required_hours}時間</span></div>
            )}
            <div className="text-sm text-gray-500 mt-1">これまでの合計時間：<span className="font-bold text-gray-800">{formatHM(appliedMinutes)}</span></div>
          </div>

          {recommendedForExisting && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
              合計時間が増えたため、<span className="font-bold">{recommendedForExisting.name}（{recommendedForExisting.hours}H）</span>がおすすめです。変更したい場合は「コースを変更する」から選び直せます。
            </div>
          )}

          <button onClick={() => goToScheduleWith(existingApp.course_category, findCourse(existingApp.course_category, existingApp.course_name) || {
            id: 'existing', name: existingApp.course_name, hours: existingApp.required_hours, example: '', target: '', unlimited: existingApp.required_hours === 0,
          })}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl active:bg-blue-700 transition-colors">
            このコースで日程を選ぶ
          </button>
          <button onClick={startChangeCourse}
            className="w-full border-2 border-gray-200 text-gray-600 font-bold text-base py-4 rounded-2xl active:bg-gray-50 transition-colors">
            コースを変更する
          </button>
        </main>
      </div>
    )
  }

  // ══ コース選択（初回、または「コースを変更する」を選んだ場合） ══
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => existingApp ? setMode('confirm') : router.push('/parent')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">夏期講習の申込み</h1>
          <p className="text-xs text-gray-400">{student.full_name} さん</p>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4 pb-24">
        <GuideBox alwaysOpen
          steps={[
            '希望するコースを選びます。',
            '内容を確認して、次の日程選択へ進みます。',
          ]}
          note="コースを間違えた場合は、戻って選び直してください。"
        />
        <h2 className="text-lg font-bold text-gray-800">コースを選択してください</h2>

        {CATEGORY_GROUPS.map(({ cat, list, hint }) => {
          const open = openCat === cat
          const color = CATEGORY_COLOR[cat]
          const selCountInCat = category === cat && course ? 1 : 0
          return (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenCat(open ? null : cat)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-lg ${color.badge}`}>{cat}</span>
                  <span className="text-xs text-gray-400">{hint}</span>
                  {selCountInCat > 0 && (
                    <span className={`text-xs font-bold text-white ${color.badge} px-2 py-0.5 rounded-full`}>選択中</span>
                  )}
                </div>
                <span className={`text-gray-400 text-sm transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
                  {list.map(c => {
                    const sel = category === cat && course?.id === c.id
                    return (
                      <button key={c.id} onClick={() => selectCourse(cat, c)}
                        className={`w-full text-left bg-white rounded-2xl border-2 px-4 py-4 transition-all active:scale-[0.99]
                          ${sel ? `${color.border} ring-2 ${color.ring}` : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                              ${sel ? `${color.border} ${color.dot}` : 'border-gray-300'}`}>
                              {sel && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="font-bold text-gray-800 truncate">{c.unlimited ? c.target : c.name}</span>
                            {c.popular && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">人気</span>}
                            {recommendedForExisting?.id === c.id && (
                              <span className="text-[10px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-full flex-shrink-0">こちらがおすすめ</span>
                            )}
                          </div>
                          {!c.unlimited && <span className={`text-lg font-bold flex-shrink-0 ${color.text}`}>{c.hours}H{c.openEnded ? '〜' : ''}</span>}
                        </div>
                        {!c.unlimited && (
                          <>
                            <div className="text-sm text-gray-600 mt-1.5 pl-8">こんな人向け：{c.target}</div>
                            <div className="text-xs text-gray-400 mt-0.5 pl-8">受講時間：{c.hours}H{c.openEnded ? '〜' : ''}（例：{c.example}）</div>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        <div className="max-w-2xl mx-auto">
          <button onClick={goToSchedule} disabled={!course}
            className="w-full bg-blue-600 text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 active:bg-blue-700 transition-colors">
            {course ? 'このコースで日程を選ぶ' : 'コースを選択してください'}
          </button>
        </div>
      </div>
    </div>
  )
}
