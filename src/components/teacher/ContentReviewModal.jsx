import React, { useState, useEffect } from "react";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, Loader2, Play, CheckCircle, BookOpen, HelpCircle, FileText, Edit, RefreshCw, Subtitles, Languages } from "lucide-react";
import QuestionEditor from "./QuestionEditor";
import MathEditorButton from "./MathEditorButton";
import MathEquationModal from "./MathEquationModal";
import { useMathEditor } from "@/hooks/useMathEditor";
import { createPageUrl } from "@/utils";
import { generateImage } from "@/components/utils/openai";
import { translateTranscriptWithCache, isEnglish } from "@/components/utils/translator";

export default function ContentReviewModal({ subunit, content, onClose, onSave }) {
  const [editedContent, setEditedContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [translatedTranscript, setTranslatedTranscript] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [attentionChecks, setAttentionChecks] = useState([]);
  const [mathEditorFor, setMathEditorFor] = useState(null);
  const mathEditor = useMathEditor();
  const [editingInquiry, setEditingInquiry] = useState({
    hook_image_prompt: false,
    hook_question: false,
    socratic_system_prompt: false,
    tutor_first_message: false
  });
  const [editingCaseStudy, setEditingCaseStudy] = useState({
    scenario: false,
    question_a: false,
    question_b: false,
    question_c: false,
    question_d: false
  });

  useEffect(() => {
    const loadData = async () => {
      // Load translation if needed
      if (content.video.transcript) {
        const needsTranslation = !isEnglish(content.video.transcript);
        
        if (needsTranslation) {
          setTranslating(true);
          try {
            const result = await translateTranscriptWithCache(content.video.transcript, content.video.videoId);
            setTranslatedTranscript(result);
          } catch (err) {
            console.error("Translation failed:", err);
          } finally {
            setTranslating(false);
          }
        }
      }
      
      // Load attention checks
      const videoData = await quest.entities.Video.filter({ subunit_id: subunit.id });
      if (videoData.length > 0) {
        const checks = await quest.entities.AttentionCheck.filter({ video_id: videoData[0].id }, "check_order");
        setAttentionChecks(checks);
      }
    };
    
    loadData();
  }, [content.video.transcript, content.video.videoId, subunit.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only update inquiry fields that were edited
      if (content.inquirySession) {
        const inquiryUpdates = {};
        if (editingInquiry.hook_image_prompt) inquiryUpdates.hook_image_prompt = editedContent.inquiryContent.hook_image_prompt;
        if (editingInquiry.hook_question) inquiryUpdates.hook_question = editedContent.inquiryContent.hook_question;
        if (editingInquiry.socratic_system_prompt) inquiryUpdates.socratic_system_prompt = editedContent.inquiryContent.socratic_system_prompt;
        if (editingInquiry.tutor_first_message) inquiryUpdates.tutor_first_message = editedContent.inquiryContent.tutor_first_message;
        if (editedContent.inquiryContent.hook_image_url !== content.inquiryContent.hook_image_url) {
          inquiryUpdates.hook_image_url = editedContent.inquiryContent.hook_image_url || "";
        }
        
        if (Object.keys(inquiryUpdates).length > 0) {
          await quest.entities.InquirySession.update(content.inquirySession.id, inquiryUpdates);
        }
      }

      // Update quiz questions only if they were modified
      if (editedContent.questions && content.quiz && JSON.stringify(editedContent.questions) !== JSON.stringify(content.questions)) {
        const [reviewQuiz, oldQuestions] = await Promise.all([
          quest.entities.Quiz.filter({ subunit_id: subunit.id, quiz_type: "review" }),
          quest.entities.Question.filter({ quiz_id: content.quiz.id })
        ]);
        
        // Delete old questions in parallel
        await Promise.all(oldQuestions.map(q => quest.entities.Question.delete(q.id)));
        
        // Create new questions for both quizzes in parallel
        const newQuestionPromises = editedContent.questions.flatMap(q => [
          quest.entities.Question.create({ quiz_id: content.quiz.id, ...q }),
          ...(reviewQuiz.length > 0 ? [quest.entities.Question.create({ quiz_id: reviewQuiz[0].id, ...q })] : [])
        ]);
        
        await Promise.all(newQuestionPromises);
      }

      // Only update case study fields that were edited
      if (content.caseStudy) {
        const caseStudyUpdates = {};
        if (editingCaseStudy.scenario) caseStudyUpdates.scenario = editedContent.caseStudy.scenario;
        if (editingCaseStudy.question_a) caseStudyUpdates.question_a = editedContent.caseStudy.question_a;
        if (editingCaseStudy.answer_a) caseStudyUpdates.answer_a = editedContent.caseStudy.answer_a || "";
        if (editingCaseStudy.question_b) caseStudyUpdates.question_b = editedContent.caseStudy.question_b;
        if (editingCaseStudy.answer_b) caseStudyUpdates.answer_b = editedContent.caseStudy.answer_b || "";
        if (editingCaseStudy.question_c) caseStudyUpdates.question_c = editedContent.caseStudy.question_c;
        if (editingCaseStudy.answer_c) caseStudyUpdates.answer_c = editedContent.caseStudy.answer_c || "";
        if (editingCaseStudy.question_d) caseStudyUpdates.question_d = editedContent.caseStudy.question_d;
        if (editingCaseStudy.answer_d) caseStudyUpdates.answer_d = editedContent.caseStudy.answer_d || "";
        
        if (Object.keys(caseStudyUpdates).length > 0) {
          await quest.entities.CaseStudy.update(content.caseStudy.id, caseStudyUpdates);
        }
      }

      onSave();
    } catch (error) {
      console.error("Failed to save content:", error);
      alert("Failed to save content: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateImage = async () => {
    setRegeneratingImage(true);
    try {
      const imageResult = await generateImage({
        prompt: editedContent.inquiryContent.hook_image_prompt
      });
      
      setEditedContent({
        ...editedContent,
        inquiryContent: {
          ...editedContent.inquiryContent,
          hook_image_url: imageResult.url
        }
      });
    } catch (error) {
      console.error("Failed to regenerate image:", error);
      alert("Failed to regenerate image: " + error.message);
    } finally {
      setRegeneratingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
        <CardContent className="p-0">
          <div className="sticky top-0 bg-green-600 text-white p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Review Content</h2>
                <p className="text-green-100 text-sm">{subunit.subunit_name}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="inquiry" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-gray-100 p-1 rounded-lg mb-6">
                <TabsTrigger value="inquiry">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Inquiry
                </TabsTrigger>
                <TabsTrigger value="video">
                  <Play className="w-4 h-4 mr-2" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="transcript">
                  <Subtitles className="w-4 h-4 mr-2" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger value="questions">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Quiz
                </TabsTrigger>
                <TabsTrigger value="casestudy">
                  <FileText className="w-4 h-4 mr-2" />
                  Case Study
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inquiry">
                <Card className="border-2 border-indigo-100">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3 text-lg flex items-center justify-between">
                        <span>Hook Image</span>
                        <Button
                          onClick={handleRegenerateImage}
                          disabled={regeneratingImage}
                          variant="outline"
                          size="sm"
                        >
                          {regeneratingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Regenerate
                            </>
                          )}
                        </Button>
                      </h3>
                      {editedContent.inquiryContent.hook_image_url && (
                        <div className="bg-gray-900 rounded-lg overflow-hidden">
                          <img 
                            src={editedContent.inquiryContent.hook_image_url} 
                            alt="Hook Image"
                            className="w-full h-auto"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">Hook Image Prompt</h3>
                        <Button
                          onClick={() => setEditingInquiry({...editingInquiry, hook_image_prompt: !editingInquiry.hook_image_prompt})}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {editingInquiry.hook_image_prompt ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {editingInquiry.hook_image_prompt ? (
                        <Textarea
                          value={editedContent.inquiryContent.hook_image_prompt}
                          onChange={(e) => setEditedContent({
                            ...editedContent,
                            inquiryContent: { ...editedContent.inquiryContent, hook_image_prompt: e.target.value }
                          })}
                          className="min-h-[120px] border-2 border-blue-200"
                        />
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <p className="text-gray-700">{editedContent.inquiryContent.hook_image_prompt}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">Hook Question</h3>
                        <Button
                          onClick={() => setEditingInquiry({...editingInquiry, hook_question: !editingInquiry.hook_question})}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {editingInquiry.hook_question ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {editingInquiry.hook_question ? (
                        <div className="flex gap-2">
                          <Input
                            ref={mathEditorFor === "hook_question" ? mathEditor.textFieldRef : null}
                            value={editedContent.inquiryContent.hook_question}
                            onChange={(e) => setEditedContent({
                              ...editedContent,
                              inquiryContent: { ...editedContent.inquiryContent, hook_question: e.target.value }
                            })}
                            className="border-2 border-indigo-200 flex-1"
                          />
                          <MathEditorButton
                            onClick={() => {
                              setMathEditorFor("hook_question");
                              setTimeout(() => {
                                const el = document.querySelector('input[placeholder=""]') || document.activeElement;
                                if (el) mathEditor.textFieldRef.current = el;
                                mathEditor.openEditor();
                              }, 0);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                          <p className="text-gray-900 font-medium text-lg">{editedContent.inquiryContent.hook_question}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">Socratic System Prompt</h3>
                        <Button
                          onClick={() => setEditingInquiry({...editingInquiry, socratic_system_prompt: !editingInquiry.socratic_system_prompt})}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {editingInquiry.socratic_system_prompt ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {editingInquiry.socratic_system_prompt ? (
                        <Textarea
                          value={editedContent.inquiryContent.socratic_system_prompt}
                          onChange={(e) => setEditedContent({
                            ...editedContent,
                            inquiryContent: { ...editedContent.inquiryContent, socratic_system_prompt: e.target.value }
                          })}
                          className="min-h-[150px] border-2 border-gray-200"
                        />
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <p className="text-gray-700 whitespace-pre-wrap">{editedContent.inquiryContent.socratic_system_prompt}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="video">
                <Card className="border-2 border-blue-100">
                  <CardContent className="p-6">
                    <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden mb-6">
                      <iframe
                        src={`https://www.youtube.com/embed/${content.video.videoId}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    
                    {attentionChecks.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                          Attention Checks ({attentionChecks.length})
                        </h3>
                        <div className="space-y-3">
                          {attentionChecks.map((check, index) => (
                            <div key={check.id} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                                    {index + 1}
                                  </div>
                                  <span className="text-sm font-medium text-blue-700">
                                    {Math.floor(check.timestamp / 60)}:{String(Math.floor(check.timestamp % 60)).padStart(2, '0')}
                                  </span>
                                </div>
                              </div>
                              <p className="font-medium text-gray-900 mb-3">{check.question}</p>
                              <div className="space-y-2">
                                {[
                                  { letter: 'A', text: check.choice_a },
                                  { letter: 'B', text: check.choice_b },
                                  { letter: 'C', text: check.choice_c },
                                  { letter: 'D', text: check.choice_d }
                                ].filter(c => c.text).map((choice) => (
                                  <div 
                                    key={choice.letter}
                                    className={`p-2 rounded-lg border ${
                                      choice.letter === check.correct_choice
                                        ? 'bg-green-100 border-green-400'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        choice.letter === check.correct_choice
                                          ? 'bg-green-600 text-white'
                                          : 'bg-gray-200 text-gray-700'
                                      }`}>
                                        {choice.letter}
                                      </span>
                                      <span className="text-sm text-gray-700">{choice.text}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transcript">
                <Card className="border-2 border-purple-100">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 text-lg">Video Transcript</h3>
                      {translatedTranscript && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <Languages className="w-4 h-4" />
                          <span>Auto-translated from {translatedTranscript.detectedLanguage.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[500px] overflow-y-auto">
                      {translating ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                          <span className="text-gray-600">Translating to English...</span>
                        </div>
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {translatedTranscript?.translatedText || content.video.transcript || "No transcript available"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="questions">
                <QuestionEditor
                  questions={editedContent.questions}
                  onChange={(updated) => setEditedContent({ ...editedContent, questions: updated })}
                />
              </TabsContent>

              <TabsContent value="casestudy">
                <Card className="border-2 border-green-100">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 text-lg">Scenario</h3>
                        <Button
                          onClick={() => setEditingCaseStudy({...editingCaseStudy, scenario: !editingCaseStudy.scenario})}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {editingCaseStudy.scenario ? "Done" : "Edit"}
                        </Button>
                      </div>
                      {editingCaseStudy.scenario ? (
                        <div className="flex gap-2">
                          <Textarea
                            ref={mathEditorFor === "scenario" ? mathEditor.textFieldRef : null}
                            value={editedContent.caseStudy?.scenario || ""}
                            onChange={(e) => setEditedContent({
                              ...editedContent,
                              caseStudy: { ...editedContent.caseStudy, scenario: e.target.value }
                            })}
                            className="min-h-[120px] border-2 border-green-200 flex-1"
                          />
                          <MathEditorButton
                            onClick={() => {
                              setMathEditorFor("scenario");
                              mathEditor.openEditor();
                            }}
                          />
                        </div>
                      ) : (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <p className="text-gray-700 whitespace-pre-wrap">{editedContent.caseStudy?.scenario}</p>
                        </div>
                      )}
                    </div>

                    {['a', 'b', 'c', 'd'].map((letter) => (
                      <div key={letter} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 text-lg">Question ({letter})</h3>
                          <Button
                            onClick={() => setEditingCaseStudy({...editingCaseStudy, [`question_${letter}`]: !editingCaseStudy[`question_${letter}`]})}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            {editingCaseStudy[`question_${letter}`] ? "Done" : "Edit"}
                          </Button>
                        </div>
                        {editingCaseStudy[`question_${letter}`] ? (
                          <div className="flex gap-2">
                            <Textarea
                              ref={mathEditorFor === `question_${letter}` ? mathEditor.textFieldRef : null}
                              value={editedContent.caseStudy?.[`question_${letter}`] || ""}
                              onChange={(e) => setEditedContent({
                                ...editedContent,
                                caseStudy: { ...editedContent.caseStudy, [`question_${letter}`]: e.target.value }
                              })}
                              className="min-h-[80px] border-2 border-green-200 flex-1"
                            />
                            <MathEditorButton
                              onClick={() => {
                                setMathEditorFor(`question_${letter}`);
                                mathEditor.openEditor();
                              }}
                            />
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-gray-700">{editedContent.caseStudy?.[`question_${letter}`]}</p>
                          </div>
                        )}

                        <div className="ml-4 border-l-4 border-green-300 pl-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700">Expected Answer</span>
                            <Button
                              onClick={() => setEditingCaseStudy({...editingCaseStudy, [`answer_${letter}`]: !editingCaseStudy[`answer_${letter}`]})}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              {editingCaseStudy[`answer_${letter}`] ? "Done" : "Edit"}
                            </Button>
                          </div>
                          {editingCaseStudy[`answer_${letter}`] ? (
                            <div className="flex gap-2">
                              <Textarea
                                ref={mathEditorFor === `answer_${letter}` ? mathEditor.textFieldRef : null}
                                value={editedContent.caseStudy?.[`answer_${letter}`] || ""}
                                onChange={(e) => setEditedContent({
                                  ...editedContent,
                                  caseStudy: { ...editedContent.caseStudy, [`answer_${letter}`]: e.target.value }
                                })}
                                className="min-h-[60px] border-2 border-green-200 text-sm flex-1"
                              />
                              <MathEditorButton
                                onClick={() => {
                                  setMathEditorFor(`answer_${letter}`);
                                  mathEditor.openEditor();
                                }}
                              />
                            </div>
                          ) : (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <p className="text-sm text-green-800">{editedContent.caseStudy?.[`answer_${letter}`] || "No expected answer"}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex gap-4 pt-6">
              <Button onClick={onClose} variant="outline" className="flex-1 border-2">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg text-lg py-6 font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          <MathEquationModal
            isOpen={mathEditor.isOpen}
            onClose={mathEditor.closeEditor}
            onInsert={mathEditor.insertEquation}
          />
        </CardContent>
      </Card>
    </div>
  );
}