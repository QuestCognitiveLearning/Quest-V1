import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import {
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  TrendingUp,
  Sparkles,
  Menu,
  X,
  Settings as SettingsIcon
} from "lucide-react";

export default function TeacherLayout({ children, activeNav, user, onSignOut, onUpgrade }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState("");

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    try {
      const classData = await quest.entities.Class.filter({ teacher_id: user.id });
      setClasses(classData);

      const savedClassId = localStorage.getItem('teacherSelectedClassId');
      if (savedClassId && classData.some(c => c.id === savedClassId)) {
        setSelectedClassId(savedClassId);
      } else if (classData.length > 0) {
        setSelectedClassId(classData[0].id);
        localStorage.setItem('teacherSelectedClassId', classData[0].id);
      }
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  };

  const handleNavigation = (nav, route) => {
    if (route) {
      navigate(createPageUrl(route));
    }
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const paid = user?.subscription_tier === "premium" || user?.subscription_status === "trial";
  const itemClass = (active) =>
    `w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
      active ? "bg-white/20" : paid ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"
    }`;
  // Navigating from the mobile drawer should also close it.
  const go = (nav, route) => { handleNavigation(nav, route); setMobileOpen(false); };

  const sidebarInner = (
    <>
      <button onClick={() => quest.auth.logout()} className="p-4 hover:bg-white/10 transition-all flex items-center gap-2 m-2">
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="px-5 pb-5 border-b border-white/10">
        <div className="flex items-center gap-1 mb-2 -ml-2">
          <img src="/quest-logo-on-blue.png" alt="Quest Learning" width="96" height="96" className="w-24 h-auto" />
          <div className="-ml-[23px]">
            <h1 className="text-sm font-bold tracking-tight">Quest Learning</h1>
            <p className="text-xs text-white/70">Teacher Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <button onClick={() => paid && go("generate", "Generate")} className={itemClass(activeNav === "generate")}>
          <Sparkles className="w-4 h-4" /><span>Generate</span>
        </button>
        <button onClick={() => paid && go("dashboard", "TeacherDashboard")} className={itemClass(activeNav === "dashboard")}>
          <BarChart3 className="w-4 h-4" /><span>Dashboard</span>
        </button>
        <button onClick={() => paid && go("curricula", "TeacherCurricula")} className={itemClass(activeNav === "curricula")}>
          <BookOpen className="w-4 h-4" /><span>Curriculum</span>
        </button>
        <button onClick={() => paid && go("classes", "TeacherClasses")} className={itemClass(activeNav === "classes")}>
          <Users className="w-4 h-4" /><span>Classes</span>
        </button>
        <button onClick={() => paid && go("analytics", "TeacherAnalytics")} className={itemClass(activeNav === "analytics")}>
          <TrendingUp className="w-4 h-4" /><span>Analysis</span>
        </button>
        <button onClick={() => go("settings", "TeacherSettings")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 mt-3 ${activeNav === "settings" ? "bg-white/20" : "hover:bg-white/10"}`}>
          <SettingsIcon className="w-4 h-4" /><span>Settings</span>
        </button>
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-semibold text-sm">
            {user?.full_name?.charAt(0) || "T"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{user?.full_name || "Teacher"}</p>
            <p className="text-xs text-white/60 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2 justify-center text-xs font-medium">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-[#1E40AF] text-white md:flex-col border-r border-[#1E40AF]" style={{ fontFamily: '"Inter", sans-serif' }}>
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 max-w-[82%] h-full bg-[#1E40AF] text-white flex flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ fontFamily: '"Inter", sans-serif' }}>
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 h-14 px-3 bg-[#1E40AF] text-white shrink-0">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu className="w-6 h-6" />
          </button>
          <img src="/quest-logo-on-blue.png" alt="" className="h-7 w-auto" />
          <span className="font-bold tracking-tight">Quest Learning</span>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child, { selectedClassId })
              : child
          )}
        </div>
      </div>
    </div>
  );
}
