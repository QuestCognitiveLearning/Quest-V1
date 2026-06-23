import React, { useState, useEffect, useRef } from "react";
import { quest } from "@/api/questClient";
import { Bell, X, CheckCircle2, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const user = await quest.auth.me();
      if (!user) return;
      const userNotifications = await quest.entities.Notification.filter(
        { user_id: user.id },
        '-created_date',
        50
      );
      setNotifications(userNotifications);
      setUnreadCount(userNotifications.filter(n => !n.read).length);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    if (showPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPanel]);

  const handleNotificationClick = async (notification) => {
    setShowPanel(false);
    try {
      await quest.entities.Notification.update(notification.id, { read: true });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleDismiss = async (e, id) => {
    e.stopPropagation();
    try {
      await quest.entities.Notification.delete(id);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to dismiss:", err);
    }
  };

  const getTypeConfig = (type, title = "") => {
    const isNewTopic = title.toLowerCase().includes("new topic");
    if (isNewTopic) {
      return {
        icon: <Sparkles className="w-4 h-4" />,
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        accent: "border-l-purple-400",
        badge: "New Topic",
        badgeColor: "bg-purple-100 text-purple-700",
        actionLabel: "Start Learning"
      };
    }
    switch (type) {
      case 'review_due':
        return {
          icon: <BookOpen className="w-4 h-4" />,
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          accent: "border-l-blue-400",
          badge: "Review Due",
          badgeColor: "bg-blue-100 text-blue-700",
          actionLabel: "Start Review"
        };
      case 'achievement':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
          accent: "border-l-green-400",
          badge: "Achievement",
          badgeColor: "bg-green-100 text-green-700",
          actionLabel: "View"
        };
      default:
        return {
          icon: <Bell className="w-4 h-4" />,
          iconBg: "bg-gray-100",
          iconColor: "text-gray-600",
          accent: "border-l-gray-300",
          badge: "System",
          badgeColor: "bg-gray-100 text-gray-600",
          actionLabel: "View"
        };
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          showPanel
            ? "bg-[#3B82F6]/10 text-[#3B82F6]"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }`}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-[#3B82F6] rounded-full px-1 shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {showPanel && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl z-50 border border-gray-100 overflow-hidden"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-xs font-semibold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">You're all caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const config = getTypeConfig(notification.type, notification.title);
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group relative px-4 py-3.5 cursor-pointer transition-all duration-150 border-l-[3px] ${config.accent} ${
                        notification.read
                          ? "bg-white hover:bg-gray-50/80"
                          : "bg-blue-50/40 hover:bg-blue-50/70"
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${config.iconBg} ${config.iconColor}`}>
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.badgeColor}`}>
                              {config.badge}
                            </span>
                            <span className="text-[10px] text-gray-400">{timeAgo(notification.created_date)}</span>
                            {!notification.read && (
                              <span className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full ml-auto flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5 truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {notification.message}
                          </p>
                          {notification.action_url && (
                            <div className="flex items-center gap-1 mt-2 text-[#3B82F6] text-xs font-medium">
                              <span>{config.actionLabel}</span>
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={(e) => handleDismiss(e, notification.id)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}