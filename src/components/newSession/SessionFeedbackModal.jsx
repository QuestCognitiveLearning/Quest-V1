import React, { useState } from "react";
import { quest } from "@/api/questClient";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";

const EMOJIS = [
  { emoji: "😴", label: "Boring", score: 1 },
  { emoji: "😐", label: "Meh", score: 2 },
  { emoji: "🙂", label: "Okay", score: 3 },
  { emoji: "😄", label: "Good", score: 4 },
  { emoji: "🤩", label: "Loved it", score: 5 },
];

const DIFFICULTY_LABELS = ["Too easy", "Fairly easy", "Just right", "Fairly hard", "Too hard"];

const ALL_TAGS = ["Engaging", "Learned something new", "Well-paced", "Fun", "Confusing", "Too long", "Repetitive", "Boring"];

const CONDITIONAL_QUESTIONS = {
  new_topic: {
    label: "🐼 Did Panda Tutor help you think?",
    options: ["Helped me think", "Was okay", "Left me stuck"],
  },
  review: {
    label: "📋 How were the review questions?",
    options: ["Just right", "Too easy", "Too hard"],
  },
};

export default function SessionFeedbackModal({
  isOpen,
  subunitName,
  sessionType,
  subunitId,
  classId,
  userId,
  isQuestathonClass,
  questathonClassId,
  onDone, // called after submit or skip — triggers navigation
  userName,
}) {
  const [emojiScore, setEmojiScore] = useState(null);
  const [difficulty, setDifficulty] = useState(3); // default "Just right"
  const [selectedTags, setSelectedTags] = useState([]);
  const [conditionalResponse, setConditionalResponse] = useState(null);
  const [textFeedback, setTextFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else if (selectedTags.length < 3) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const conditionalQ = CONDITIONAL_QUESTIONS[sessionType] || CONDITIONAL_QUESTIONS.new_topic;
  const sessionLabel = sessionType === "review" ? "Review" : "New Topic";

  const handleSkip = async () => {
    // Save skipped record
    quest.entities.SessionFeedback.create({
      student_id: userId,
      subunit_id: subunitId,
      subunit_name: subunitName,
      session_type: sessionType,
      class_id: classId || "",
      skipped: true,
      submitted_at: new Date().toISOString(),
    }).catch(() => {});
    onDone();
  };

  const handleSubmit = async () => {
    if (!emojiScore) return;
    setSubmitting(true);

    try {
      // LLM quality score for text feedback
      let qualityScore = null;
      let pandaPoints = 1; // base 1 point for any feedback submission

      if (textFeedback.trim().length > 0) {
        try {
          const result = await invokeLLM({
            model: LLM_MODELS.FEEDBACK_SCORING,
            prompt: `Rate this student feedback on a scale of 1–3. Score 3 if it names something specific about the session (a concept, a question, a moment, the tutor, a specific suggestion). Score 2 if it's general but earnest (e.g. "the video was too fast"). Score 1 if it's empty, gibberish, copy-paste, or non-responsive (e.g. "good", "idk", "asdf"). Output only the number.\n\nFeedback: "${textFeedback}"`,
          });
          qualityScore = parseInt(String(result).trim(), 10);
          if (isNaN(qualityScore) || qualityScore < 1 || qualityScore > 3) qualityScore = 1;
        } catch {
          qualityScore = 1;
        }
        pandaPoints = qualityScore >= 2 ? 2 : 1;
      }

      await quest.entities.SessionFeedback.create({
        student_id: userId,
        subunit_id: subunitId,
        subunit_name: subunitName,
        session_type: sessionType,
        class_id: classId || "",
        emoji_score: emojiScore,
        difficulty: difficulty,
        tags: selectedTags,
        conditional_response: conditionalResponse || "",
        text_feedback: textFeedback || "",
        feedback_quality_score: qualityScore,
        submitted_at: new Date().toISOString(),
        skipped: false,
        panda_points_awarded: pandaPoints,
      });

      // Panda Points awarding removed.
      onDone(pandaPoints);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-7">
          {/* Context strip */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
            <span className="text-sm text-gray-500">Session complete · {subunitName} · {sessionLabel}</span>
          </div>

          {/* Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-1">How was that?</h2>
          <p className="text-sm text-gray-500 mb-6">Takes 30 seconds. Helps us make the next one better.</p>

          {/* Emoji rating */}
          <p className="text-sm font-semibold text-gray-800 mb-3">How was this session?</p>
          <div className="flex gap-2 mb-6">
            {EMOJIS.map((e) => (
              <button
                key={e.score}
                onClick={() => setEmojiScore(e.score)}
                className={`flex-1 flex flex-col items-center py-3 px-1 border-2 rounded-2xl transition-all ${
                  emojiScore === e.score
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <span className="text-2xl mb-1">{e.emoji}</span>
                <span className="text-xs text-gray-600">{e.label}</span>
              </button>
            ))}
          </div>

          {/* Difficulty slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800">Difficulty</p>
              <span className="text-sm text-gray-500">{DIFFICULTY_LABELS[difficulty - 1]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Too easy</span>
              <span className="text-xs text-gray-400">Too hard</span>
            </div>
          </div>

          {/* Tag picker */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-800 mb-1">Pick up to 3 that fit</p>
            <p className="text-xs text-gray-400 mb-3">Be honest — both kinds welcome.</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    selectedTags.includes(tag)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-700 hover:border-gray-400"
                  } ${!selectedTags.includes(tag) && selectedTags.length >= 3 ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional question */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-sm font-semibold text-gray-800 mb-3">{conditionalQ.label}</p>
            <div className="flex gap-2">
              {conditionalQ.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setConditionalResponse(opt)}
                  className={`flex-1 py-2 px-2 rounded-xl border text-sm font-medium transition-all ${
                    conditionalResponse === opt
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Free text */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Anything you'd change?
            </p>
            <textarea
              value={textFeedback}
              onChange={(e) => setTextFeedback(e.target.value)}
              placeholder="One thing that would have made this better..."
              className={`w-full border rounded-xl p-3 text-sm text-gray-800 resize-none h-20 outline-none transition-colors ${
                textFeedback.trim().length === 0 ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-blue-400"
              }`}
            />
            {textFeedback.trim().length === 0 && (
              <p className="text-xs text-red-500 mt-1">Required — even one sentence helps!</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mb-3">
            <button
              onClick={handleSubmit}
              disabled={!emojiScore || textFeedback.trim().length === 0 || submitting}
              className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold py-3 rounded-2xl transition-all"
            >
              {submitting ? "Submitting..." : "Submit feedback"}
            </button>
          </div>

          {/* Privacy line */}
          <p className="text-center text-xs text-gray-400">Your teacher won't see who said what.</p>
        </div>
      </div>
    </div>
  );
}