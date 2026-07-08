'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSession, ELEMENTARY_COURSES, JUNIOR_COURSES, setSelectedCourse,
  type SummerStudent, type SummerCourse,
} from '../../lib'
import GuideBox from '../../components/GuideBox'

export default function SummerApplyCoursePage() {
  const router = useRouter()
  const [student, setStudent]   = useState<SummerStudent | null>(null)
  const [category, setCategory] = useState<'小学生' | '中学生' | null>(null)
  const [course, setCourse]     = useState<SummerCourse | null>(null)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    setStudent(s)
  }, [router])

  if (!student) return null

  function selectCourse(cat: '小学生' | '中学生', c: SummerCourse) {
    setCategory(cat); setCourse(c)
  }

  function goToSchedule() {
    if (!course || !category) return
    setSelectedCourse({ category, id: course.id, name: course.name, hours: course.hours })
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
        <GuideBox
          steps={[
            'ホームから「夏期講習の授業を申込む」を選びます。',
            '希望するコースを選びます。',
            '内容を確認して、次の日程選択へ進みます。',
          ]}
          note="コースを間違えた場合は、戻って選び直してください。"
        />
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
