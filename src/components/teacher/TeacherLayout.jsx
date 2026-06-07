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
  Calendar
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
              <p className="text-xs text-white/70">Teacher Portal</p>
            </div>
          </div>
        </div>



        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <button onClick={() => (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? handleNavigation("generate", "Generate") : null} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "generate" ? "bg-white/20" : (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
            <Sparkles className="w-4 h-4" />
            <span>Generate</span>
          </button>
          <button onClick={() => (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? handleNavigation("dashboard", dashboardRoute) : null} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "dashboard" ? "bg-white/20" : (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button onClick={() => (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? handleNavigation("curricula", "TeacherCurricula") : null} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "curricula" ? "bg-white/20" : (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
            <BookOpen className="w-4 h-4" />
            <span>Curriculum</span>
          </button>
          <button onClick={() => (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? handleNavigation("classes", "TeacherClasses") : null} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "classes" ? "bg-white/20" : (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
            <Users className="w-4 h-4" />
            <span>{strings.nav_classes}</span>
          </button>
          <button onClick={() => (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? handleNavigation("analytics", "TeacherAnalytics") : null} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "analytics" ? "bg-white/20" : (user?.subscription_tier === "premium" || user?.subscription_status === "trial") ? "hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}>
            <TrendingUp className="w-4 h-4" />
            <span>Analysis</span>
          </button>

          {studioOn && (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-white/40">
                Studio
              </div>
              <button onClick={() => handleNavigation("branding", "BrandingSettings")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "branding" ? "bg-white/20" : "hover:bg-white/10"}`}>
                <Palette className="w-4 h-4" />
                <span>Branding</span>
              </button>
              <button onClick={() => handleNavigation("parentReports", "ParentReports")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "parentReports" ? "bg-white/20" : "hover:bg-white/10"}`}>
                <FileText className="w-4 h-4" />
                <span>Parent Reports</span>
              </button>
              <button onClick={() => handleNavigation("booking", "BookingSettings")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${activeNav === "booking" ? "bg-white/20" : "hover:bg-white/10"}`}>
                <Calendar className="w-4 h-4" />
                <span>Booking</span>
              </button>
            </>
          )}

          <button onClick={() => handleNavigation("settings", "TeacherSettings")} className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 mt-3 ${activeNav === "settings" ? "bg-white/20" : "hover:bg-white/10"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
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