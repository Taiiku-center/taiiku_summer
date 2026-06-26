// 夏期講習 共通定義

export const SUMMER_START = '2026-07-20'
export const SUMMER_END   = '2026-08-20'

export const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
]

export function endTime(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export type SummerStudent = {
  id: string
  four_digit_id: string
  full_name: string
}

export type SummerLesson = {
  id: string
  student_id: string
  full_name: string
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
}

export type SummerAbsence = {
  id: string
  student_id: string
  full_name: string
  date: string
  time: string
  type: '欠席' | '遅刻'
  make_up_request: '希望する' | '希望しない' | '未定'
  note: string
  created_at: string
}

export type SummerBugReport = {
  id: string
  student_id: string
  full_name: string
  screen_name: string
  description: string
  status: 'unread' | 'read'
  created_at: string
}

export type SummerNotification = {
  id: string
  type: 'lesson' | 'absence' | 'late' | 'makeup' | 'bug'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export const SESSION_KEY = 'summer_student_session'

export function getSession(): SummerStudent | null {
  try {
    const s = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function setSession(student: SummerStudent) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(student))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
