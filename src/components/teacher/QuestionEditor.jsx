import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useMathEditor } from "@/hooks/useMathEditor";
import MathEditorButton from "./MathEditorButton";
import MathEquationModal from "./MathEquationModal";

export default function QuestionEditor({ questions, onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [mathEditorFor, setMathEditorFor] = useState(null);
  const mathEditor = useMathEditor();

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    // Reorder questions
    const reordered = updated.map((q, i) => ({ ...q, question_order: i + 1 }));
    onChange(reordered);
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      question_text: "New question?",
      choice_1: "Option A",
      choice_2: "Option B",
      choice_3: "Option C",
      choice_4: "Option D",
      correct_choice: 1,
      question_order: questions.length + 1,
      difficulty: "medium"
    };
    onChange([...questions, newQuestion]);
    setEditingIndex(questions.length);
  };

  const easyCount = questions.filter(q => q.difficulty === 'easy').length;
  const mediumCount = questions.filter(q => q.difficulty === 'medium').length;
  const hardCount = questions.filter(q => q.difficulty === 'hard').length;

  const filteredQuestions = filterDifficulty === "all" 
    ? questions 
    : questions.filter(q => q.difficulty === filterDifficulty);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterDifficulty("all")}
            variant={filterDifficulty === "all" ? "default" : "outline"}
            size="sm"
          >
            All ({questions.length})
          </Button>
          <Button
            onClick={() => setFilterDifficulty("easy")}
            variant={filterDifficulty === "easy" ? "default" : "outline"}
            size="sm"
            className="bg-green-100 text-green-700 hover:bg-green-200"
          >
            Easy ({easyCount})
          </Button>
          <Button
            onClick={() => setFilterDifficulty("medium")}
            variant={filterDifficulty === "medium" ? "default" : "outline"}
            size="sm"
            className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          >
            Medium ({mediumCount})
          </Button>
          <Button
            onClick={() => setFilterDifficulty("hard")}
            variant={filterDifficulty === "hard" ? "default" : "outline"}
            size="sm"
            className="bg-red-100 text-red-700 hover:bg-red-200"
          >
            Hard ({hardCount})
          </Button>
        </div>
      </div>
      {filteredQuestions.map((q, index) => {
        const actualIndex = questions.indexOf(q);
        return (
        <Card key={actualIndex} className="border-2 border-blue-100 hover:border-blue-300 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Badge className={
                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }>
                {q.difficulty?.toUpperCase() || 'MEDIUM'}
              </Badge>
              <span className="text-sm text-gray-500">Question {actualIndex + 1}</span>
            </div>
            {editingIndex === actualIndex ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-4">
                    <Select
                      value={q.difficulty || 'medium'}
                      onValueChange={(value) => handleUpdateQuestion(actualIndex, "difficulty", value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Textarea
                        ref={mathEditorFor === `question-${actualIndex}` ? mathEditor.textFieldRef : null}
                        value={q.question_text}
                        onChange={(e) => handleUpdateQuestion(actualIndex, "question_text", e.target.value)}
                        className="font-semibold border-2 border-blue-200 flex-1"
                        placeholder="Question text"
                      />
                      <MathEditorButton
                        onClick={() => {
                          setMathEditorFor(`question-${actualIndex}`);
                          mathEditor.textFieldRef.current = document.querySelector(`[data-question-ref="${actualIndex}"]`);
                          mathEditor.openEditor();
                        }}
                      />
                    </div>
                    
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={q.correct_choice === num}
                          onChange={() => handleUpdateQuestion(actualIndex, "correct_choice", num)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Input
                          ref={mathEditorFor === `choice-${actualIndex}-${num}` ? mathEditor.textFieldRef : null}
                          data-choice-ref={`${actualIndex}-${num}`}
                          value={q[`choice_${num}`]}
                          onChange={(e) => handleUpdateQuestion(actualIndex, `choice_${num}`, e.target.value)}
                          className="border-2 border-blue-200 flex-1"
                          placeholder={`Option ${String.fromCharCode(64 + num)}`}
                        />
                        <MathEditorButton
                          onClick={() => {
                            setMathEditorFor(`choice-${actualIndex}-${num}`);
                            setTimeout(() => {
                              const el = document.querySelector(`[data-choice-ref="${actualIndex}-${num}"]`);
                              if (el) mathEditor.textFieldRef.current = el;
                              mathEditor.openEditor();
                            }, 0);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => setEditingIndex(null)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-4">{q.question_text}</p>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((num) => (
                      <div
                        key={num}
                        className={`p-3 rounded-lg border-2 ${
                          q.correct_choice === num
                            ? "bg-green-50 border-green-400"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">{String.fromCharCode(64 + num)}.</span>
                          <span className="text-gray-900">{q[`choice_${num}`]}</span>
                          {q.correct_choice === num && (
                            <Badge className="ml-auto bg-green-600">Correct</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditingIndex(actualIndex)}
                    size="sm"
                    variant="outline"
                    className="border-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteQuestion(actualIndex)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 border-2 border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        );
      })}
      
      <Button
        onClick={handleAddQuestion}
        variant="outline"
        className="w-full gap-2 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 py-6 text-blue-700"
      >
        <Plus className="w-5 h-5" />
        Add Custom Question
      </Button>

      <MathEquationModal
        isOpen={mathEditor.isOpen}
        onClose={mathEditor.closeEditor}
        onInsert={mathEditor.insertEquation}
      />
    </div>
  );
}