// 夏期講習 共通定義

export const SUMMER_START = '2026-07-20'
export const SUMMER_END   = '2026-08-29'

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
  application_id?: string | null
  course_name?: string | null
}

export type CourseCategory = '小学生' | '中学生' | '在塾生'

export type SummerCourseApplication = {
  id: string
  student_id: string
  full_name: string
  course_category: CourseCategory
  course_name: string
  required_hours: number
  total_hours: number
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
}

// 1時間帯（30分）あたりの定員（満席判定に使用）
export const SLOT_CAPACITY = 8

export type SummerCourse = {
  id: string
  name: string
  hours: number
  example: string
  target: string       // こんな人向け
  popular?: boolean
  unlimited?: boolean  // trueの場合、必要時間数の制限なし（何時間でも受講OK）
}

// 小学生：1日1時間〜2時間
export const ELEMENTARY_COURSES: SummerCourse[] = [
  { id: 'e-check',      name: '苦手単元チェックコース',   hours: 10, example: '10日 × 1h', target: 'まず苦手を確認したい' },
  { id: 'e-kiso',       name: '基礎固めコース',           hours: 15, example: '15日 × 1h', target: '基礎をしっかり定着させたい' },
  { id: 'e-standard',   name: '夏休み標準コース',         hours: 20, example: '20日 × 1h', target: '夏休み全体で着実に進めたい' },
  { id: 'e-shuchu',     name: '苦手克服集中コース',       hours: 20, example: '10日 × 2h', target: '短期間で集中して克服したい' },
  { id: 'e-jitsuryoku', name: '実力アップしっかりコース', hours: 30, example: '15日 × 2h', target: '複数の苦手をまとめて解消したい', popular: true },
  { id: 'e-free',       name: 'フリーコース',             hours: 40, example: '20日 × 2h', target: '夏休みを全力で使い切りたい' },
]

// 中学生：1日2時間〜3時間
export const JUNIOR_COURSES: SummerCourse[] = [
  { id: 'j-check',      name: '苦手単元確認コース',       hours: 20, example: '10日 × 2h', target: 'まず苦手の場所を整理したい' },
  { id: 'j-kiso',       name: '基礎固めコース',           hours: 30, example: '15日 × 2h', target: '1学期の穴を確実につぶしたい' },
  { id: 'j-standard',   name: '夏休み標準コース',         hours: 40, example: '20日 × 2h', target: '定期テストに向けて準備したい' },
  { id: 'j-shuchu',     name: '苦手克服集中コース',       hours: 30, example: '10日 × 3h', target: '集中して苦手を一気に解消したい' },
  { id: 'j-jitsuryoku', name: '実力アップしっかりコース', hours: 30, example: '15日 × 3h', target: '複数教科を受験・テストに向けて仕上げたい', popular: true },
  { id: 'j-free',       name: 'フリーコース',             hours: 60, example: '20日 × 3h', target: '通い放題の2か月で、夏休みを全力で大きく伸ばしたい' },
]

// 在塾生：時間数の制限なし
export const RESIDENT_COURSES: SummerCourse[] = [
  { id: 'r-free', name: 'フリーコース', hours: 0, example: '', target: '在塾生', unlimited: true },
]

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

// コース申込みフロー：コース選択画面 → 日程選択（/parent/schedule）へ受け渡す選択中コース
export type SelectedCourse = {
  category: CourseCategory
  id: string
  name: string
  hours: number
  unlimited?: boolean
}

const SELECTED_COURSE_KEY = 'summer_selected_course'

export function setSelectedCourse(c: SelectedCourse) {
  if (typeof window !== 'undefined') sessionStorage.setItem(SELECTED_COURSE_KEY, JSON.stringify(c))
}

export function getSelectedCourse(): SelectedCourse | null {
  try {
    const s = typeof window !== 'undefined' ? sessionStorage.getItem(SELECTED_COURSE_KEY) : null
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function clearSelectedCourse() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SELECTED_COURSE_KEY)
}

// ── コース時間の計算（すべて「分」単位で計算し、表示のみ変換することでズレを防ぐ） ──

export function lessonMinutes(startTime: string, endTimeStr: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTimeStr.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// 分を「◯時間◯分」に整形（0分は「0分」、時間のみ・分のみにも対応）
export function formatHM(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m === 0) return '0分'
  const h = Math.floor(m / 60), r = m % 60
  return `${h > 0 ? `${h}時間` : ''}${r > 0 ? `${r}分` : ''}`
}

function coursesOf(category: CourseCategory): SummerCourse[] {
  if (category === '小学生') return ELEMENTARY_COURSES
  if (category === '中学生') return JUNIOR_COURSES
  return RESIDENT_COURSES
}

// 選択中の合計時間が現在のコース時間を超えている場合に、次に適したコースを提案する
// （自動変更はしない。保護者への案内表示にのみ使用）
export function findRecommendedCourse(
  category: CourseCategory,
  current: { hours: number; unlimited?: boolean },
  totalMinutes: number
): SummerCourse | null {
  if (current.unlimited) return null
  const totalHours = totalMinutes / 60
  if (totalHours <= current.hours) return null
  // 現在のコースより上位のコースのうち、合計時間が「そのコースの時間以上」に達している
  // 最も上位（最も近い適切な）コースを提案する。まだどの上位コースの時間にも達していなければ提案しない。
  const candidates = coursesOf(category)
    .filter(c => !c.unlimited && c.hours > current.hours)
    .sort((a, b) => b.hours - a.hours)
  return candidates.find(c => c.hours <= totalHours) || null
}

// 授業（summer_lessons）を削除した後、紐づく summer_course_applications の授業が
// 0件になっていれば、その申込みレコードもあわせて削除する（一覧に0コマのまま残らないように）。
// supabase はブラウザクライアント（createClient() の戻り値）を渡す。
export async function cleanupEmptyApplications(
  supabase: { from: (table: string) => any },
  applicationIds: (string | null | undefined)[]
) {
  const ids = Array.from(new Set(applicationIds.filter((id): id is string => !!id)))
  for (const appId of ids) {
    const { count } = await supabase.from('summer_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', appId).neq('status', 'cancelled')
    if (!count) {
      await supabase.from('summer_course_applications').delete().eq('id', appId)
    }
  }
}
