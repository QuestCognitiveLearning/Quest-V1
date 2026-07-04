import { beforeEach, describe, expect, it, vi } from "vitest";

// studentClasses pulls in the quest client and the progress seeder; both are
// mocked so these tests exercise only the class-list logic (A-F4).
vi.mock("@/api/questClient", () => ({
  quest: {
    entities: {
      StudentEnrollment: { filter: vi.fn() },
      Class: { list: vi.fn() },
    },
  },
}));
vi.mock("@/lib/progressSeeding", () => ({
  ensureProgressSeeded: vi.fn().mockResolvedValue(undefined),
}));

import { quest } from "@/api/questClient";
import { ensureProgressSeeded } from "@/lib/progressSeeding";
import { isActiveStudentClass, loadStudentClasses } from "@/lib/studentClasses";

// Node environment has no localStorage; the module only needs get/set.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const user = { id: "stud1" };

const CLASSES = [
  { id: "c_active", class_name: "Bio", status: "active" },
  { id: "c_legacy", class_name: "Chem" }, // pre-0045 row, no status column value
  { id: "c_pending", class_name: "SIS Pending", status: "pending_instructor" },
  { id: "c_archived", class_name: "Last Term", status: "archived" },
];

function enroll(classIds) {
  return classIds.map((id, i) => ({ id: `e${i}`, student_id: "stud1", class_id: id }));
}

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  quest.entities.Class.list.mockResolvedValue(CLASSES);
});

describe("isActiveStudentClass", () => {
  it("keeps active and legacy (statusless) classes", () => {
    expect(isActiveStudentClass(CLASSES[0])).toBe(true);
    expect(isActiveStudentClass(CLASSES[1])).toBe(true);
  });

  it("drops pending_instructor, archived, and missing classes", () => {
    expect(isActiveStudentClass(CLASSES[2])).toBe(false);
    expect(isActiveStudentClass(CLASSES[3])).toBe(false);
    expect(isActiveStudentClass(undefined)).toBe(false);
  });
});

describe("loadStudentClasses", () => {
  it("filters lifecycle states out of the student's class list", async () => {
    quest.entities.StudentEnrollment.filter.mockResolvedValue(
      enroll(["c_active", "c_pending", "c_archived", "c_legacy"]),
    );
    const { classes } = await loadStudentClasses(user);
    expect(classes.map((c) => c.id)).toEqual(["c_active", "c_legacy"]);
  });

  it("never selects a filtered class, even if saved in localStorage", async () => {
    quest.entities.StudentEnrollment.filter.mockResolvedValue(
      enroll(["c_archived", "c_active"]),
    );
    localStorage.setItem("selectedClassId", "c_archived");
    const { selectedClassId } = await loadStudentClasses(user);
    expect(selectedClassId).toBe("c_active");
    expect(localStorage.getItem("selectedClassId")).toBe("c_active");
  });

  it("seeds progress for exactly the visible classes", async () => {
    quest.entities.StudentEnrollment.filter.mockResolvedValue(
      enroll(["c_active", "c_pending"]),
    );
    await loadStudentClasses(user);
    expect(ensureProgressSeeded).toHaveBeenCalledTimes(1);
    const [studentId, classes] = ensureProgressSeeded.mock.calls[0];
    expect(studentId).toBe("stud1");
    expect(classes.map((c) => c.id)).toEqual(["c_active"]);
  });

  it("still returns classes if seeding rejects (degraded, not blocked)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    quest.entities.StudentEnrollment.filter.mockResolvedValue(enroll(["c_active"]));
    ensureProgressSeeded.mockRejectedValueOnce(new Error("seed exploded"));
    const { classes, selectedClassId } = await loadStudentClasses(user);
    expect(classes.map((c) => c.id)).toEqual(["c_active"]);
    expect(selectedClassId).toBe("c_active");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns empty shape when the student has no enrollments", async () => {
    quest.entities.StudentEnrollment.filter.mockResolvedValue([]);
    const out = await loadStudentClasses(user);
    expect(out).toEqual({ enrollments: [], classes: [], selectedClassId: null });
    expect(ensureProgressSeeded).not.toHaveBeenCalled();
  });
});
