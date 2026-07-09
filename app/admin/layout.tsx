'use client'
import { useEffect, useState } from 'react'

const ADMIN_CODE = 'Taiiku7294'
const ADMIN_AUTH_KEY = 'summer_admin_auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem(ADMIN_AUTH_KEY) === 'ok'
    setUnlocked(ok)
  }, [])

  function handleSubmit() {
    if (code === ADMIN_CODE) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'ok')
      setUnlocked(true)
      setError('')
    } else {
      setError('コードが正しくありません')
    }
  }

  if (unlocked === null) return null

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔒</div>
            <h1 className="text-xl font-bold text-gray-800">管理者用コード</h1>
            <p className="text-sm text-gray-400 mt-1">管理画面に入るにはコードを入力してください</p>
          </div>
          <input
            type="password"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="コード"
            autoFocus
            className="w-full text-lg text-center border-2 border-gray-200 rounded-2xl py-4 px-4 focus:outline-none focus:border-blue-400 tracking-widest transition-colors mb-4"
          />
          {error && <div className="text-sm text-red-600 text-center mb-4">{error}</div>}
          <button onClick={handleSubmit}
            className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-2xl active:scale-95 hover:bg-blue-700 transition-all">
            管理画面へ進む
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
