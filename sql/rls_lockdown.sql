-- RLS lockdown: restrict each table to only the operations the app actually performs.
-- Run this whole file in Supabase SQL Editor (site① project).
-- Background: the app has no real per-user Supabase Auth session (parents "log in" via a
-- plain 4-digit ID + name check against summer_students, stored in localStorage only).
-- Because of that, Postgres RLS cannot verify "this row belongs to this specific student" —
-- there is no auth.uid()/JWT claim to key a policy on. True per-row isolation would require
-- migrating to real Supabase Auth first (separate, larger project).
-- What we CAN do now: remove every write/delete capability that the client never uses,
-- so a leaked anon key can no longer tamper with or delete data it has no legitimate reason to touch.

do $$
declare
  t text;
  pol record;
begin
  for t in select unnest(array[
    'summer_students',
    'summer_lessons',
    'summer_lessons2',
    'summer_absences',
    'summer_course_applications',
    'summer_bug_reports',
    'summer_notifications'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- summer_students: select + insert + delete (login lookup + admin "生徒追加"/削除). No update in the app.
create policy "summer_students_select" on summer_students for select using (true);
create policy "summer_students_insert" on summer_students for insert with check (true);
create policy "summer_students_delete" on summer_students for delete using (true);

-- summer_lessons: select/insert/delete only (booking + cancel). No update in the app.
create policy "summer_lessons_select" on summer_lessons for select using (true);
create policy "summer_lessons_insert" on summer_lessons for insert with check (true);
create policy "summer_lessons_delete" on summer_lessons for delete using (true);

-- summer_lessons2: same shape as summer_lessons (site②).
create policy "summer_lessons2_select" on summer_lessons2 for select using (true);
create policy "summer_lessons2_insert" on summer_lessons2 for insert with check (true);
create policy "summer_lessons2_delete" on summer_lessons2 for delete using (true);

-- summer_absences: select/insert/delete only (report + cancel report). No update in the app.
create policy "summer_absences_select" on summer_absences for select using (true);
create policy "summer_absences_insert" on summer_absences for insert with check (true);
create policy "summer_absences_delete" on summer_absences for delete using (true);

-- summer_course_applications: select/insert/delete/update (admin "コースを変更する").
create policy "summer_course_applications_select" on summer_course_applications for select using (true);
create policy "summer_course_applications_insert" on summer_course_applications for insert with check (true);
create policy "summer_course_applications_delete" on summer_course_applications for delete using (true);
create policy "summer_course_applications_update" on summer_course_applications for update using (true) with check (true);

-- summer_bug_reports: select/insert/update only (admin marks status='read'). No delete in the app.
create policy "summer_bug_reports_select" on summer_bug_reports for select using (true);
create policy "summer_bug_reports_insert" on summer_bug_reports for insert with check (true);
create policy "summer_bug_reports_update" on summer_bug_reports for update using (true) with check (true);

-- summer_notifications: select/insert/update only (admin marks is_read=true). No delete in the app.
create policy "summer_notifications_select" on summer_notifications for select using (true);
create policy "summer_notifications_insert" on summer_notifications for insert with check (true);
create policy "summer_notifications_update" on summer_notifications for update using (true) with check (true);
