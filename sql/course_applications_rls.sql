-- summer_course_applications の RLS ポリシー追加
-- 既存の summer_lessons 等と同様、匿名キー(anon)からの読み書きを許可します。
-- Supabase の SQL Editor で実行してください。

alter table summer_course_applications enable row level security;

drop policy if exists "summer_course_applications_select" on summer_course_applications;
create policy "summer_course_applications_select"
  on summer_course_applications for select
  using (true);

drop policy if exists "summer_course_applications_insert" on summer_course_applications;
create policy "summer_course_applications_insert"
  on summer_course_applications for insert
  with check (true);

drop policy if exists "summer_course_applications_update" on summer_course_applications;
create policy "summer_course_applications_update"
  on summer_course_applications for update
  using (true) with check (true);

drop policy if exists "summer_course_applications_delete" on summer_course_applications;
create policy "summer_course_applications_delete"
  on summer_course_applications for delete
  using (true);
