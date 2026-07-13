'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerStudent } from '../../lib'
import GuideBox from '../../components/GuideBox'

const REVEAL_CODE = 'Taiiku7294'

export default function SummerAdminStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<SummerStudent[]>([])
  const [loading, setLoading]   = useState(true)

  const [revealed, setRevealed] = useState(false)
  const [revealModal, setRevealModal] = useState(false)
  const [revealCode, setRevealCode]   = useState('')
  const [revealError, setRevealError] = useState('')

  const [addModal, setAddModal]   = useState(false)
  const [fourDigitId, setFourDigitId] = useState('')
  const [lastName, setLastName]       = useState('')
  const [firstName, setFirstName]     = useState('')
  const [addError, setAddError]       = useState('')
  const [adding, setAdding]           = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SummerStudent | null>(null)
  const [deleteError, setDeleteError]   = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [deleteCounts, setDeleteCounts] = useState<{ lessons: number; absences: number; applications: number } | null>(null)
  const [countsLoading, setCountsLoading] = useState(false)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('summer_students').select('*').order('full_name')
    setStudents(data || [])
    setLoading(false)
  }

  function handleReveal() {
    if (revealCode !== REVEAL_CODE) { setRevealError('コードが正しくありません'); return }
    setRevealed(true)
    setRevealModal(false)
    setRevealCode('')
    setRevealError('')
  }

  function openAddModal() {
    setFourDigitId(''); setLastName(''); setFirstName(''); setAddError('')
    setAddModal(true)
  }

  async function handleAdd() {
    if (fourDigitId.length !== 4 || !lastName.trim() || !firstName.trim()) {
      setAddError('4桁のIDと姓・名をすべて入力してください')
      return
    }
    setAdding(true)
    setAddError('')
    const supabase = createClient()
    const fullName = `${lastName.trim()} ${firstName.trim()}`
    const { error } = await supabase.from('summer_students').insert({ four_digit_id: fourDigitId, full_name: fullName })
    setAdding(false)
    if (error) {
      setAddError(error.code === '23505' ? 'この4桁IDはすでに使われています' : '追加に失敗しました。時間をおいて再度お試しください')
      return
    }
    setAddModal(false)
    fetchStudents()
  }

  async function openDeleteModal(s: SummerStudent) {
    setDeleteTarget(s)
    setDeleteError('')
    setDeleteCounts(null)
    setCountsLoading(true)
    const supabase = createClient()
    const [l1, l2, a, c] = await Promise.all([
      supabase.from('summer_lessons').select('id', { count: 'exact', head: true }).eq('student_id', s.id),
      supabase.from('summer_lessons2').select('id', { count: 'exact', head: true }).eq('student_id', s.id),
      supabase.from('summer_absences').select('id', { count: 'exact', head: true }).eq('student_id', s.id),
      supabase.from('summer_course_applications').select('id', { count: 'exact', head: true }).eq('student_id', s.id),
    ])
    setDeleteCounts({ lessons: (l1.count || 0) + (l2.count || 0), absences: a.count || 0, applications: c.count || 0 })
    setCountsLoading(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const supabase = createClient()
    const id = deleteTarget.id
    const results = await Promise.all([
      supabase.from('summer_lessons').delete().eq('student_id', id),
      supabase.from('summer_lessons2').delete().eq('student_id', id),
      supabase.from('summer_absences').delete().eq('student_id', id),
      supabase.from('summer_course_applications').delete().eq('student_id', id),
    ])
    const relatedFailed = results.find(r => r.error)
    if (relatedFailed?.error) {
      console.error('delete related records failed:', relatedFailed.error)
      setDeleting(false)
      setDeleteError('関連データの削除に失敗しました。時間をおいて再度お試しください')
      return
    }
    const { error } = await supabase.from('summer_students').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      console.error('delete student failed:', error)
      setDeleteError('削除に失敗しました。時間をおいて再度お試しください')
      return
    }
    setDeleteTarget(null)
    fetchStudents()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/admin')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 text-xl transition-colors">‹</button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-800">生徒一覧</h1>
          <p className="text-xs text-gray-400">夏期講習</p>
        </div>
        <button onClick={openAddModal}
          className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl active:bg-blue-700 flex-shrink-0">
          ＋ 追加
        </button>
      </header>

      <main className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        <GuideBox
          bullets={[
            '右上の「＋ 追加」で新しい生徒（4桁ID・氏名）を登録できます。',
            '4桁IDは初期状態で隠れています。「🔒 4桁IDを表示する」でコードを入力すると表示され、削除ボタンも使えるようになります。',
          ]}
        />
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">{students.length}名</div>
          {!revealed && (
            <button onClick={() => setRevealModal(true)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              🔒 4桁IDを表示する
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-16">読み込み中...</div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">生徒が登録されていません</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                <span className="font-medium text-gray-800 truncate">{s.full_name}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`font-mono text-sm font-bold ${revealed ? 'text-gray-700' : 'text-gray-300 tracking-widest'}`}>
                    {revealed ? s.four_digit_id : '••••'}
                  </span>
                  {revealed && (
                    <button onClick={() => openDeleteModal(s)}
                      className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg active:bg-red-100">
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {revealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-800 text-center">4桁IDの表示には認証コードが必要です</h2>
            <input
              type="password"
              value={revealCode}
              onChange={e => setRevealCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReveal()}
              placeholder="管理者コード"
              autoFocus
              className="w-full text-xl font-bold text-center border-2 border-gray-200 rounded-2xl py-4 px-4 focus:outline-none focus:border-blue-400 tracking-widest"
            />
            {revealError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 text-center font-medium">{revealError}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setRevealModal(false); setRevealCode(''); setRevealError('') }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold active:bg-gray-200">キャンセル</button>
              <button onClick={handleReveal}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold active:bg-blue-700">表示する</button>
            </div>
          </div>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-800">生徒を追加</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">4桁の数字ID</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={fourDigitId}
                onChange={e => setFourDigitId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                className="w-full text-2xl font-bold text-center border-2 border-gray-200 rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-400 tracking-[0.4em]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 text-center">姓（苗字）</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="大育"
                  className="w-full text-lg text-center border-2 border-gray-200 rounded-2xl py-3 px-2 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 text-center">名（名前）</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="太郎"
                  className="w-full text-lg text-center border-2 border-gray-200 rounded-2xl py-3 px-2 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            {addError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 text-center font-medium">{addError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setAddModal(false)} disabled={adding}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-40">キャンセル</button>
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-40">{adding ? '追加中...' : '追加する'}</button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-800 text-center">生徒を削除しますか？</h2>
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700 font-medium text-center space-y-1">
              <div>{deleteTarget.full_name}（{deleteTarget.four_digit_id}）</div>
              {countsLoading ? (
                <div className="text-xs font-normal text-red-500">関連データを確認中...</div>
              ) : deleteCounts && (deleteCounts.lessons + deleteCounts.absences + deleteCounts.applications > 0) ? (
                <div className="text-xs font-normal text-red-500 space-y-0.5 pt-1">
                  {deleteCounts.lessons > 0 && <div>・授業予約　{deleteCounts.lessons}件</div>}
                  {deleteCounts.absences > 0 && <div>・欠席・遅刻連絡　{deleteCounts.absences}件</div>}
                  {deleteCounts.applications > 0 && <div>・コース申込み　{deleteCounts.applications}件</div>}
                  <div className="pt-1">これらもすべて一緒に削除されます</div>
                </div>
              ) : null}
              <div className="text-xs font-normal text-red-500 pt-1">この操作は取り消せません</div>
            </div>
            {deleteError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 text-center font-medium">{deleteError}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); setDeleteCounts(null) }} disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-40">キャンセル</button>
              <button onClick={handleDelete} disabled={deleting || countsLoading}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold active:bg-red-600 disabled:opacity-40">{deleting ? '削除中...' : 'はい、削除します'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
