-- No-op. This migration originally tried to create a `learning_sessions`
-- table that clashed with a pre-existing student-progress table by the
-- same name in prod. Superseded by 0018_lesson_bundles.sql which uses
-- `lesson_bundles` to avoid the clash. Kept as a placeholder so the
-- ordinal sequence stays contiguous and the migrations table stays in
-- sync with the file list.

select 1;
