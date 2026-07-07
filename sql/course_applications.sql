-- 夏期講習：コース申込み機能のためのスキーマ追加
-- Supabase の SQL Editor で実行してください。

-- 1) コース申込みテーブル
create table if not exists summer_course_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  full_name text not null,
  course_category text not null,          -- '小学生' | '中学生'
  course_name text not null,              -- 例: 実力アップしっかりコース
  required_hours integer not null,        -- 必要時間数(H)
  total_hours numeric not null,           -- 選択した合計時間数(H)
  status text not null default 'pending', -- pending | confirmed | cancelled
  created_at timestamptz not null default now()
);

create index if not exists idx_summer_course_applications_student
  on summer_course_applications (student_id);

-- 2) 既存 summer_lessons にコース情報を紐付けるカラムを追加
alter table summer_lessons
  add column if not exists application_id uuid,
  add column if not exists course_name text;

create index if not exists idx_summer_lessons_application
  on summer_lessons (application_id);

-- （任意）RLS を使っている場合は、既存の summer_lessons と同様のポリシーを
-- summer_course_applications にも設定してください。
