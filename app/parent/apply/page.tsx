'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSession, ELEMENTARY_COURSES, JUNIOR_COURSES, RESIDENT_COURSES, setSelectedCourse,
  type SummerStudent, type SummerCourse, type CourseCategory,
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

export default function SummerApplyCoursePage() {
  const router = useRouter()
  const [student, setStudent]   = useState<SummerStudent | null>(null)
  const [category, setCategory] = useState<CourseCategory | null>(null)
  const [course, setCourse]     = useState<SummerCourse | null>(null)
  const [openCat, setOpenCat]   = useState<CourseCategory | null>('小学生')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
  }, [router])

  if (!student) return null

  function selectCourse(cat: CourseCategory, c: SummerCourse) {
    setCategory(cat); setCourse(c)
  }

  function goToSchedule() {
    if (!course || !category) return
    setSelectedCourse({ category, id: course.id, name: course.name, hours: course.hours, unlimited: course.unlimited })
    router.push('/parent/schedule?course=1')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.push('/parent')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
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
                  <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-lg ${color.badge}`}>{cat}コース</span>
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
                            <span className="font-bold text-gray-800 truncate">{c.name}</span>
                            {c.popular && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0">人気</span>}
                          </div>
                          {!c.unlimited && <span className={`text-lg font-bold flex-shrink-0 ${color.text}`}>{c.hours}H</span>}
                        </div>
                        <div className="text-sm text-gray-600 mt-1.5 pl-8">こんな人向け：{c.target}</div>
                        {!c.unlimited && (
                          <div className="text-xs text-gray-400 mt-0.5 pl-8">受講時間：{c.hours}H（例：{c.example}）</div>
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
