'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const ADMIN_AUTH_KEY = 'summer_admin_auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return }
    const ok = typeof window !== 'undefined' && localStorage.getItem(ADMIN_AUTH_KEY) === 'ok'
    if (!ok) { router.replace('/admin/login'); return }
    setChecked(true)
  }, [isLoginPage, router])

  if (!checked) return null

  return <>{children}</>
}
