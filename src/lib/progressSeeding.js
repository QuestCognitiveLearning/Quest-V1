import { supabase } from "@/components/lib/supabase-client.jsx";

// Lazily scaffold StudentProgress rows for the classes a student belongs to.
//
// Join-code joins seed progress client-side at join time, but SIS-rostered
// enrollments (created server-side by rosterSync) skip that path, and a
// teacher can attach a curriculum to a class after students are already in
// it. Calling this on class load heals every one of those cases.
//
// Delegates to the seed_student_progress() Postgres function (migration
// 0050) — the same implementation rosterSync uses — which is idempotent
// (ON CONFLICT DO NOTHING on the (student_id, subunit_id) key) and a no-op
// for classes without a curriculum. Failures are logged, never thrown:
// seeding is a repair step and must not block class rendering.
export async function ensureProgressSeeded(studentId, classes) {
  const withCurriculum = (classes || []).filter((c) => c && c.curriculum_id);
  if (!studentId || withCurriculum.length === 0) return;

  await Promise.allSettled(
    withCurriculum.map(async (cls) => {
      const { error } = await supabase.rpc("seed_student_progress", {
        p_student_id: studentId,
        p_class_id: cls.id,
      });
      if (error) {
        console.warn(`Progress seeding skipped for class ${cls.id}:`, error.message);
      }
    }),
  );
}
