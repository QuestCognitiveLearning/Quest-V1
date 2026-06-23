import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { BookOpen, Home, BarChart3, LogOut, ChevronLeft, Users, Radio, Menu, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import NotificationCenter from "@/components/shared/NotificationCenter";

export default function StudentSidebar({
  activeNav,
  classes,
  selectedClassId,
  onClassChange,
  user
}) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const go = (_tab, route) => {
    if (route) navigate(createPageUrl(route));
    setMobileOpen(false);
  };

  const navItem = (active) =>
    `w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
      active ? "bg-white/20" : "hover:bg-white/10"
    }`;

  const inner = (
    <>
      <div className="p-4 flex items-center justify-between">
        <button onClick={handleSignOut} className="hover:bg-white/10 transition-all flex items-center gap-2 p-2 rounded">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <NotificationCenter />
      </div>

      <div className="px-5 pb-5 border-b border-white/10">
        <div className="flex items-center gap-1 mb-2 -ml-2">
          <img src="/quest-logo-on-blue.png" alt="Quest Learning" width="96" height="96" className="w-24 h-auto" />
          <div className="-ml-[23px]">
            <h1 className="text-sm font-bold tracking-tight">Quest Learning</h1>
            <p className="text-xs text-white/70">Redefining Education</p>
          </div>
        </div>
      </div>

      {classes.length > 0 &&
      <div className="p-4 border-b border-white/10">
          <Select value={selectedClassId} onValueChange={onClassChange}>
            <SelectTrigger className="w-full bg-white/10 border-0 text-white hover:bg-white/20 rounded-lg transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) =>
            <SelectItem key={cls.id} value={cls.id}>
                  {cls.class_name}
                </SelectItem>
            )}
            </SelectContent>
          </Select>
        </div>
      }

      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <button onClick={() => go("knowledge-map", "KnowledgeMap")} className={navItem(activeNav === "knowledge-map")}>
          <BookOpen className="w-4 h-4 flex-shrink-0" /><span>Knowledge Map</span>
        </button>
        <button onClick={() => go("learning-hub", "LearningHub")} className={navItem(activeNav === "learning-hub")}>
          <Home className="w-4 h-4 flex-shrink-0" /><span>Learning Hub</span>
        </button>
        <button onClick={() => go("progress", "Progress")} className={navItem(activeNav === "progress")}>
          <BarChart3 className="w-4 h-4 flex-shrink-0" /><span>Progress</span>
        </button>
        <button onClick={() => go("classes", "Classes")} className={navItem(activeNav === "classes")}>
          <Users className="w-4 h-4 flex-shrink-0" /><span>Classes</span>
        </button>
        <button onClick={() => go("live-sessions", "StudentLiveSessions")} className={navItem(activeNav === "live-sessions")}>
          <Radio className="w-4 h-4 flex-shrink-0" /><span>Live Sessions</span>
        </button>
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-semibold text-sm">
            {user?.full_name?.charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{user?.full_name || "Student"}</p>
            <p className="text-xs text-white/60 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2 justify-center text-xs font-medium">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar column */}
      <div className="hidden md:flex w-64 bg-[#1E40AF] text-white md:flex-col border-r border-[#1E40AF]" style={{ fontFamily: '"Inter", sans-serif' }}>
        {inner}
      </div>

      {/* Mobile top bar (fixed; pages add pt-14 md:pt-0 so content clears it) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-3 flex items-center gap-3 bg-[#1E40AF] text-white" style={{ fontFamily: '"Inter", sans-serif' }}>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1.5 rounded-lg hover:bg-white/10">
          <Menu className="w-6 h-6" />
        </button>
        <img src="/quest-logo-on-blue.png" alt="" className="h-7 w-auto" />
        <span className="font-bold tracking-tight">Quest Learning</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[82%] h-full bg-[#1E40AF] text-white flex flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
            {inner}
          </div>
        </div>
      )}
    </>
  );
}
