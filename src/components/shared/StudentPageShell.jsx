import React from "react";
import StudentSidebar from "@/components/shared/StudentSidebar";

/**
 * Shared chrome for the standard student pages — the full-height flex row with
 * the (responsive) StudentSidebar and a scrollable main column. Centralizes the
 * font links, the sidebar wiring, and the mobile top-bar offset that used to be
 * copy-pasted across LearningHub / Progress / Classes / StudentLiveSessions.
 *
 * `bg` sets the main column background (defaults to white). `setSelectedClassId`
 * is the page's setter; the shell handles persisting the choice to localStorage.
 */
export default function StudentPageShell({
  activeNav,
  classes,
  selectedClassId,
  setSelectedClassId,
  user,
  bg = "bg-white",
  children,
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <StudentSidebar
        activeNav={activeNav}
        classes={classes}
        selectedClassId={selectedClassId}
        onClassChange={(val) => {
          setSelectedClassId(val);
          localStorage.setItem("selectedClassId", val);
        }}
        user={user}
      />

      <div className={`flex-1 overflow-auto ${bg} pt-14 md:pt-0 min-w-0`} style={{ fontFamily: '"Inter", sans-serif' }}>
        {children}
      </div>
    </div>
  );
}
