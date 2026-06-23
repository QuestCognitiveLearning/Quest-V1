import { quest } from "@/api/questClient";

// Loads a student's enrolled classes and decides which one should be active:
// the class saved in localStorage if it's still one of theirs, otherwise the
// first enrolled class (which is then persisted). Single source of truth for
// the enrollment → class → selectedClassId logic the student pages share.
//
// Returns { enrollments, classes, selectedClassId }. `classes` is the resolved
// class rows (enrollments whose class no longer exists are dropped), and
// `selectedClassId` is null when the student isn't enrolled in anything.
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
    .filter(Boolean);

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
