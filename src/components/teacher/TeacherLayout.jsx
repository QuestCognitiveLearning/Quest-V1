import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  TrendingUp,
  FileText,
  Sparkles,
  Palette,
  Calendar,
  Library as LibraryIcon,
  UserSquare,
  Settings as SettingsIcon
} from "lucide-react";
import { isFeatureEnabled } from "@/lib/tier";
import { stringsFor } from "@/lib/i18n/role-strings";

export default function TeacherLayout({ children, activeNav, user, onSignOut, onUpgrade }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeKey, setUpgradeKey] = useState("");
  const strings = stringsFor(user);
  const studioOn = isFeatureEnabled(user, "brandingEnabled");
  const isTutor = user?.new_role === "tutor";
  const dashboardRoute = isTutor ? "TutorDashboard" : "TeacherDashboard";

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

  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    localStorage.setItem('teacherSelectedClassId', classId);
  };

  const handleUpgradeClick = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleUpgradeSubmit = async () => {
    if (upgradeKey === 'admin') {
      await quest.auth.updateMe({ subscription_tier: 'premium' });
      window.location.reload();
    } else {
      alert('Invalid teacher key');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Left Sidebar */}
      <div className="w-64 bg-[#1E40AF] text-white flex flex-col border-r border-[#1E40AF]" style={{fontFamily: '"Inter", sans-serif'}}>
        <button onClick={() => quest.auth.logout()} className="p-4 hover:bg-white/10 transition-all flex items-center gap-2 m-2">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="px-5 pb-5 border-b border-white/10">
          {/* Centered lockup: logo on the left of "Quest Learning" wordmark,
              with extra horizontal breathing room (gap-5) between them. */}
          <div className="flex items-center gap-1 mb-2 -ml-2">
            <img
              src="/quest-logo-on-blue.png"
              alt="Quest Learning"
              width="96"
              height="96"
              className="w-24 h-auto"
            />
            <div className="-ml-[23px]">
              <h1 className="text-sm font-bold tracking-tight">Quest Learning</h1>
              <p className="text-xs text-white/70">{isTutor ? "Studio" : "Teacher Portal"}</p>
            </div>
          </div>
        </div>



        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {isTutor ? (
            <TutorNav
              activeNav={activeNav}
              studioOn={studioOn}
              onNav={handleNavigation}
              strings={strings}
            />
          ) : (
            <TeacherNav
              activeNav={activeNav}
              studioOn={studioOn}
              onNav={handleNavigation}
              strings={strings}
              user={user}
              dashboardRoute={dashboardRoute}
            />
          )}
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
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white" style={{fontFamily: '"Inter", sans-serif'}}>
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child, { selectedClassId })
            : child
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Nav variants. Splitting these keeps the teacher experience untouched while
// the tutor sidebar follows its own layout.
// ────────────────────────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, active, onClick, indent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full ${
        indent ? "pl-8 pr-4" : "px-4"
      } py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
        active ? "bg-white/20" : "hover:bg-white/10"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function TutorNav({ activeNav, studioOn, onNav, strings }) {
  return (
    <>
      <NavItem icon={BarChart3} label="Dashboard" active={activeNav === "dashboard"} onClick={() => onNav("dashboard", "TutorDashboard")} />
      <NavItem icon={Calendar} label={strings.nav_classes} active={activeNav === "classes"} onClick={() => onNav("classes", "TeacherClasses")} />
      <NavItem icon={UserSquare} label="Students" active={activeNav === "students"} onClick={() => onNav("students", "TutorStudents")} />
      <NavItem icon={Sparkles} label="Generate" active={activeNav === "generate"} onClick={() => onNav("generate", "Generate")} />
      <NavItem icon={LibraryIcon} label="Library" active={activeNav === "library"} onClick={() => onNav("library", "Library")} />
      {studioOn && (
        <>
          <NavItem icon={FileText} label="Parent Reports" active={activeNav === "parentReports"} onClick={() => onNav("parentReports", "ParentReports")} />
          <NavItem icon={Calendar} label="Bookings" active={activeNav === "booking"} onClick={() => onNav("booking", "TutorBookings")} />
        </>
      )}
      <NavItem icon={TrendingUp} label="Insights" active={activeNav === "insights"} onClick={() => onNav("insights", "TeacherAnalytics")} />

      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-white/40">
        Settings
      </div>
      <NavItem icon={SettingsIcon} label="Account" active={activeNav === "settings"} onClick={() => onNav("settings", "TeacherSettings")} />
      {studioOn && (
        <NavItem icon={Palette} label="Branding" active={activeNav === "branding"} onClick={() => onNav("branding", "BrandingSettings")} indent />
      )}
    </>
  );
}

function TeacherNav({ activeNav, studioOn, onNav, strings, user, dashboardRoute }) {
  const paid = user?.subscription_tier === "premium" || user?.subscription_status === "trial";
  const guarded = (route) => (paid ? route : null);
  const itemClass = (active) =>
    `w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
      active ? "bg-white/20" : paid ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"
    }`;
  return (
    <>
      <button onClick={() => paid && onNav("generate", "Generate")} className={itemClass(activeNav === "generate")}>
        <Sparkles className="w-4 h-4" />
        <span>Generate</span>
      </button>
      <button onClick={() => paid && onNav("dashboard", dashboardRoute)} className={itemClass(activeNav === "dashboard")}>
        <BarChart3 className="w-4 h-4" />
        <span>Dashboard</span>
      </button>
      <button onClick={() => paid && onNav("curricula", "TeacherCurricula")} className={itemClass(activeNav === "curricula")}>
        <BookOpen className="w-4 h-4" />
        <span>Curriculum</span>
      </button>
      <button onClick={() => paid && onNav("classes", "TeacherClasses")} className={itemClass(activeNav === "classes")}>
        <Users className="w-4 h-4" />
        <span>{strings.nav_classes}</span>
      </button>
      <button onClick={() => paid && onNav("analytics", "TeacherAnalytics")} className={itemClass(activeNav === "analytics")}>
        <TrendingUp className="w-4 h-4" />
        <span>Analysis</span>
      </button>
      {studioOn && (
        <>
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-white/40">
            Studio
          </div>
          <NavItem icon={Palette} label="Branding" active={activeNav === "branding"} onClick={() => onNav("branding", "BrandingSettings")} />
          <NavItem icon={FileText} label="Parent Reports" active={activeNav === "parentReports"} onClick={() => onNav("parentReports", "ParentReports")} />
          <NavItem icon={Calendar} label="Bookings" active={activeNav === "booking"} onClick={() => onNav("booking", "TutorBookings")} />
        </>
      )}
      <button onClick={() => onNav("settings", "TeacherSettings")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 mt-3 ${activeNav === "settings" ? "bg-white/20" : "hover:bg-white/10"}`}>
        <SettingsIcon className="w-4 h-4" />
        <span>Settings</span>
      </button>
    </>
  );
}