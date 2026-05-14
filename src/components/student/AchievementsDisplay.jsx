import React, { useEffect, useState } from "react";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Sparkles, Flame } from "lucide-react";
import { motion } from "framer-motion";

export default function AchievementsDisplay({ studentId }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      loadAchievements();
    }
  }, [studentId]);

  const loadAchievements = async () => {
    try {
      const data = await quest.entities.Achievement.filter({
        student_id: studentId
      }, '-date_awarded');
      setAchievements(data);
    } catch (err) {
      console.error("Failed to load achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    if (type === 'Day Streak') return <Flame className="w-6 h-6 text-orange-500" />;
    if (type === 'Subtopic Learning') return <Sparkles className="w-6 h-6 text-blue-500" />;
    return <Trophy className="w-6 h-6 text-yellow-500" />;
  };

  if (loading) {
    return null;
  }

  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        Achievements
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {achievements.map((achievement, idx) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="border border-gray-200 hover:border-yellow-400 transition-all h-full">
              <CardContent className="p-4 flex flex-col items-center text-center h-full justify-center">
                <div className="mb-3">
                  {getIcon(achievement.type)}
                </div>
                <h4 className="font-semibold text-sm text-gray-900 mb-1">
                  {achievement.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {achievement.criteria}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}