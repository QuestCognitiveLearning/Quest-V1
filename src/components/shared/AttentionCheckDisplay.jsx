import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

export default function AttentionCheckDisplay({
  currentCheck,
  currentCheckIndex,
  totalChecks,
  selectedCheckAnswer,
  showCheckFeedback,
  onAnswerSelect,
  onSubmit,
  disabled = false
}) {
  if (!currentCheck) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[20px] p-6 border-2 border-blue-200 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1A1A1A]">Attention Check</h3>
        {totalChecks && (
          <div className="px-3 py-1 bg-blue-600 rounded-full">
            <span className="text-xs font-medium text-white">
              Check {currentCheckIndex + 1}/{totalChecks}
            </span>
          </div>
        )}
      </div>

      <p className="text-base font-medium text-[#1A1A1A] mb-4">{currentCheck.question}</p>

      <div className="space-y-2 mb-4">
        {(() => {
          const choices = [
            { letter: "A", text: currentCheck.choice_a },
            { letter: "B", text: currentCheck.choice_b },
            { letter: "C", text: currentCheck.choice_c },
            { letter: "D", text: currentCheck.choice_d }
          ].filter((choice) => choice.text);

          const shuffled = [...choices].sort((a, b) => {
            const seed = currentCheckIndex;
            return (a.letter.charCodeAt(0) + seed) % 2 === 0 ? -1 : 1;
          });

          return shuffled.map((choice) => {
            const isSelected = selectedCheckAnswer === choice.letter;
            const isCorrect = choice.letter === currentCheck.correct_choice;
            const showResult = showCheckFeedback;

            return (
              <button
                key={choice.letter}
                onClick={() => !showCheckFeedback && onAnswerSelect(choice.letter)}
                disabled={showCheckFeedback}
                className={`w-full p-3 text-left border-2 rounded-[16px] transition-all ${
                  showResult && isCorrect
                    ? "border-green-500 bg-green-50"
                    : showResult && isSelected && !isCorrect
                    ? "border-red-500 bg-red-50"
                    : isSelected
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300 bg-white"
                } ${showCheckFeedback ? "cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      showResult && isCorrect
                        ? "bg-green-600 text-white"
                        : showResult && isSelected && !isCorrect
                        ? "bg-red-600 text-white"
                        : isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {choice.letter}
                  </div>
                  <span className="text-sm text-[#1A1A1A] flex-1" style={{ fontWeight: 450 }}>
                    {choice.text}
                  </span>
                  {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </button>
            );
          });
        })()}
      </div>

      {!showCheckFeedback ? (
        <Button
          onClick={onSubmit}
          disabled={!selectedCheckAnswer || disabled}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 font-semibold rounded-full"
        >
          Submit Answer
        </Button>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm font-medium text-blue-600">Continuing in a moment...</p>
        </div>
      )}
    </div>
  );
}