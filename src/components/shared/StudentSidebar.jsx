import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { BookOpen, Home, BarChart3, LogOut, ChevronLeft, Users, Radio, Sparkles } from "lucide-react";
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

  const handleSignOut = () => {
    quest.auth.logout();
  };

  const handleNavigation = (_tab, route) => {
    if (route) navigate(createPageUrl(route));
  };

  return (
    <div className="w-64 bg-[#1E40AF] text-white flex flex-col border-r border-[#1E40AF]" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="p-4 flex items-center justify-between">
        <button onClick={handleSignOut} className="hover:bg-white/10 transition-all flex items-center gap-2 p-2 rounded">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <NotificationCenter />
      </div>

      <div className="px-5 pb-5 border-b border-white/10">
        {/* Centered lockup: logo + "Quest Learning" wordmark, with extra
            horizontal breathing room (gap-5) between them. */}
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
        <button
          onClick={() => handleNavigation("knowledge-map", "KnowledgeMap")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "knowledge-map" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span>Knowledge Map</span>
        </button>

        <button
          onClick={() => handleNavigation("learning-hub", "LearningHub")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "learning-hub" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          <span>Learning Hub</span>
        </button>

        <button
          onClick={() => handleNavigation("progress", "Progress")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "progress" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <BarChart3 className="w-4 h-4 flex-shrink-0" />
          <span>Progress</span>
        </button>

        <button
          onClick={() => handleNavigation("classes", "Classes")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "classes" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>Classes</span>
        </button>

        <button
          onClick={() => handleNavigation("live-sessions", "StudentLiveSessions")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "live-sessions" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <Radio className="w-4 h-4 flex-shrink-0" />
          <span>Live Sessions</span>
        </button>

        <button
          onClick={() => handleNavigation("generate", "Generate")}
          className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-sm font-medium rounded-lg mb-1 ${
            activeNav === "generate" ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>Create</span>
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
    </div>);

}
