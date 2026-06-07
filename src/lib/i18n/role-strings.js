/**
 * @file role-strings.js
 * @desc Maps the user's role (`teacher` | `tutor`) to user-facing labels and
 *       feature flags. Lets the same component render "Classes" for a teacher
 *       and "Sessions" for a tutor without forking the component.
 *
 *       Database entity names stay the same — `classes` is still `classes`.
 *       This module only swaps display strings and exposes booleans for
 *       Studio-only sidebar items, so call sites can write declarative checks
 *       like `strings.has_branding && <BrandingItem />`.
 */
import { useEffect, useState } from "react";
import { quest } from "@/api/questClient";
import { getUserRole } from "@/lib/tier";

export const ROLE_STRINGS = {
  teacher: {
    nav_classes: "Classes",
    nav_class_singular: "Class",
    create_class_cta: "Create class",
    has_branding: false,
    has_parent_reports: false,
    has_booking: false,
  },
  tutor: {
    nav_classes: "Sessions",
    nav_class_singular: "Session",
    create_class_cta: "New session",
    has_branding: true,
    has_parent_reports: true,
    has_booking: true,
  },
};

export function stringsFor(user) {
  const role = getUserRole(user);
  return ROLE_STRINGS[role] || ROLE_STRINGS.teacher;
}

// Hook variant: components that already have `user` in scope should call
// stringsFor(user) directly. This hook is for components that don't pull the
// user themselves — it loads `quest.auth.me()` once and caches it.
export function useRoleStrings() {
  const [strings, setStrings] = useState(ROLE_STRINGS.teacher);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await quest.auth.me();
        if (alive) setStrings(stringsFor(me));
      } catch {
        // not signed in or fetch failed — keep teacher defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return strings;
}
