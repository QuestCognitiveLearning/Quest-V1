import { supabase } from "@/components/lib/supabase-client.jsx";

// How long class rendering will wait on seeding before proceeding without
// it. In-flight RPCs keep running in the background; the next class load
// retries anything that didn't land (the RPC is idempotent).
export const SEED_TIMEOUT_MS = 4000;

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
// for classes without a curriculum.
//
// WARN, DON'T BLOCK: this function never throws (per-call errors are
// warned and swallowed; rejections land in Promise.allSettled), and never
// waits longer than SEED_TIMEOUT_MS — a slow or dead RPC degrades to
// "scaffolding appears on the next load," never to a blank class list.
export async function ensureProgressSeeded(studentId, classes) {
  const withCurriculum = (classes || []).filter((c) => c && c.curriculum_id);
  if (!studentId || withCurriculum.length === 0) return;

  const seedAll = Promise.allSettled(
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

  let timer;
  const cap = new Promise((resolve) => {
    timer = setTimeout(resolve, SEED_TIMEOUT_MS);
  });
  await Promise.race([seedAll, cap]);
  clearTimeout(timer);
}
