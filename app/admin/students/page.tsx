'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { type SummerStudent } from '../../lib'

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
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                <span className="font-medium text-gray-800">{s.full_name}</span>
                <span className={`font-mono text-sm font-bold ${revealed ? 'text-gray-700' : 'text-gray-300 tracking-widest'}`}>
                  {revealed ? s.four_digit_id : '••••'}
                </span>
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
    </div>
  )
}
