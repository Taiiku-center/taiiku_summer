'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_CODE = 'Taiiku7294'
const ADMIN_AUTH_KEY = 'summer_admin_auth'

export default function AdminLoginPage() {
  const [code, setCode]     = useState('')
  const [error, setError]   = useState('')
  const router = useRouter()

  function handleLogin() {
    if (!code.trim()) {
      setError('コードを入力してください')
      return
    }
    if (code !== ADMIN_CODE) {
      setError('コードが正しくありません')
      return
    }
    localStorage.setItem(ADMIN_AUTH_KEY, 'ok')
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-black">管理者ログイン</h1>
          <p className="text-sm text-black mt-1">夏期講習 管理画面</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-black mb-2">管理者コード</label>
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="コードを入力"
              autoFocus
              className="w-full text-2xl font-bold text-center border-2 border-gray-200 rounded-2xl py-5 px-4 focus:outline-none focus:border-blue-400 tracking-widest transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 mt-2">
            ログイン
          </button>
        </div>
      </div>
    </div>
  )
}
