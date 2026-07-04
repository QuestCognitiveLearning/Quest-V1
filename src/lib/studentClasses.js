import { quest } from "@/api/questClient";
import { ensureProgressSeeded } from "@/lib/progressSeeding";

// Class lifecycle states (migration 0045) a student should never see as an
// active class: SIS-synced classes waiting on a teacher enrollment, and
// classes past their term. Organic classes default to 'active' (and legacy
// rows may have status undefined), so they always pass.
export function isActiveStudentClass(cls) {
  return !!cls && cls.status !== "pending_instructor" && cls.status !== "archived";
}

// Loads a student's enrolled classes and decides which one should be active:
// the class saved in localStorage if it's still one of theirs, otherwise the
// first enrolled class (which is then persisted). Single source of truth for
// the enrollment → class → selectedClassId logic the student pages share.
//
// Returns { enrollments, classes, selectedClassId }. `classes` is the resolved
// class rows (enrollments whose class no longer exists, is pending a teacher,
// or is archived are dropped), and `selectedClassId` is null when the student
// isn't enrolled in anything. Also lazily seeds StudentProgress scaffolding
// for SIS-rostered enrollments that never ran the join-time seeding.
export async function loadStudentClasses(currentUser) {
  const enrollments = await quest.entities.StudentEnrollment.filter({
    student_id: currentUser.id,
  });
  if (!enrollments || enrollments.length === 0) {
    return { enrollments: enrollments || [], classes: [], selectedClassId: null };
  }

  const allClasses = await quest.entities.Class.list();
  const classes = enrollments
    .map((e) => allClasses.find((c) => c.id === e.class_id))
    .filter(isActiveStudentClass);

  await ensureProgressSeeded(currentUser.id, classes);

  let selectedClassId = null;
  if (classes.length > 0) {
    const saved = localStorage.getItem("selectedClassId");
    if (saved && classes.some((c) => c.id === saved)) {
      selectedClassId = saved;
    } else {
      selectedClassId = classes[0].id;
      localStorage.setItem("selectedClassId", selectedClassId);
    }
  }

  return { enrollments, classes, selectedClassId };
}
