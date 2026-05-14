/**
 * @file   TeacherAnalytics.jsx
 * @desc   Curriculum Data tab — shows the questions students *struggled with*
 *         (below 70% accuracy across enrolled students) along with the correct
 *         answer for each. The picker (class → unit → topic) sits below the
 *         tab title; submitting runs an aggregate query and renders three
 *         sections: attention checks, quiz questions, case studies.
 *
 *         Data note: question_responses, attention_check_responses, and
 *         case_study_responses ARE saved on every attempt (including failed
 *         ones — verified via DB count). If a student attempts a topic
 *         multiple times all attempts are aggregated into the per-item
 *         accuracy here.
 * @author Quest Learning core team
 */

import React, { useState, useEffect } from "react";
import { quest } from "@/api/questClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { Video, HelpCircle, PenTool, Loader2, CheckCircle2 } from "lucide-react";

// Items at or above this accuracy are considered well-understood and excluded
// from the "struggle areas" view that teachers care about.
const ACCURACY_THRESHOLD = 70;

/** Strip a leading subpart marker like "(a)", "(A) ", "( a )" — case studies
 *  store text that already contains the marker and we render our own. */
function stripLeadingMarker(text) {
  if (!text) return text;
  return text.replace(/^\s*\([A-Za-z]\)\s*/, "").trim();
}

/** Pull a choice's text by letter from an attention-check or quiz row. */
function quizChoiceText(question, choiceNumber /* 1..4 */) {
  return question?.[`choice_${choiceNumber}`] ?? "";
}
function attentionChoiceText(check, choiceLetter /* "A"..."D" */) {
  return check?.[`choice_${choiceLetter.toLowerCase()}`] ?? "";
}

export default function TeacherAnalytics() {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [classes, setClasses] = useState([]);
  const [units, setUnits] = useState([]);
  const [subunits, setSubunits] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedSubunitId, setSelectedSubunitId] = useState("");

  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Bootstrap: load this teacher's classes.
  useEffect(() => {
    (async () => {
      try {
        const user = await quest.auth.me();
        setTeacher(user);
        const myClasses = await quest.entities.Class.filter({ teacher_id: user.id });
        setClasses(myClasses);
      } catch (err) {
        console.error("Failed to load classes:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // class → load units, reset child pickers
  useEffect(() => {
    if (!selectedClassId) {
      setUnits([]); setSubunits([]); setSelectedUnitId(""); setSelectedSubunitId("");
      return;
    }
    (async () => {
      try {
        const cls = classes.find((c) => c.id === selectedClassId);
        if (!cls) return;
        const unitsForClass = await quest.entities.Unit.filter(
          { curriculum_id: cls.curriculum_id }, "unit_order",
        );
        setUnits(unitsForClass);
        setSubunits([]); setSelectedUnitId(""); setSelectedSubunitId("");
      } catch (err) { console.error("Failed to load units:", err); }
    })();
  }, [selectedClassId, classes]);

  // unit → load subunits
  useEffect(() => {
    if (!selectedUnitId) { setSubunits([]); setSelectedSubunitId(""); return; }
    (async () => {
      try {
        const subs = await quest.entities.Subunit.filter(
          { unit_id: selectedUnitId }, "subunit_order",
        );
        setSubunits(subs); setSelectedSubunitId("");
      } catch (err) { console.error("Failed to load topics:", err); }
    })();
  }, [selectedUnitId]);

  const handleSubmit = async () => {
    setError(null);
    setResults(null);
    if (!selectedClassId || !selectedUnitId || !selectedSubunitId) {
      setError("Select a class, unit, and topic before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const enrollments = await quest.entities.StudentEnrollment.filter({
        class_id: selectedClassId,
      });
      const enrolledIds = new Set(enrollments.map((e) => e.student_id));
      const subunitId = selectedSubunitId;

      const [quizzes, allQuestions, questionResponses, videos] = await Promise.all([
        quest.entities.Quiz.filter({ subunit_id: subunitId }),
        quest.entities.Question.list(),
        quest.entities.QuestionResponse.filter({ subunit_id: subunitId }),
        quest.entities.Video.filter({ subunit_id: subunitId }),
      ]);
      const quizIds = new Set(quizzes.map((q) => q.id));
      const subunitQuestions = allQuestions.filter((q) => quizIds.has(q.quiz_id));
      const videoIds = new Set(videos.map((v) => v.id));

      const [attentionChecks, attentionCheckResponses, caseStudies, caseStudyResponses] =
        await Promise.all([
          quest.entities.AttentionCheck.list(),
          quest.entities.AttentionCheckResponse.filter({ subunit_id: subunitId }),
          quest.entities.CaseStudy.filter({ subunit_id: subunitId }),
          quest.entities.CaseStudyResponse.filter({ subunit_id: subunitId }),
        ]);
      const subunitChecks = attentionChecks.filter((c) => videoIds.has(c.video_id));

      // Build accuracy stats keyed by item id, restricted to enrolled students.
      const accuracyFor = (responses, idField) => {
        const byId = {};
        for (const r of responses) {
          if (enrolledIds.size && !enrolledIds.has(r.student_id)) continue;
          const id = r[idField];
          if (!id) continue;
          if (!byId[id]) byId[id] = { total: 0, correct: 0 };
          byId[id].total += 1;
          if (r.is_correct) byId[id].correct += 1;
        }
        return byId;
      };

      const quizStats = accuracyFor(questionResponses, "question_id");
      const checkStats = accuracyFor(attentionCheckResponses, "attention_check_id");

      // STRUGGLE-AREA filter: items below 70%. Includes the correct answer
      // text so the teacher can see what they were expected to pick.
      const strugglingQuiz = subunitQuestions
        .map((q) => {
          const s = quizStats[q.id];
          if (!s || s.total === 0) return null;
          const pct = Math.round((s.correct / s.total) * 100);
          const correctNum = Number(q.correct_choice);
          return {
            id: q.id,
            text: q.question_text,
            choices: [q.choice_1, q.choice_2, q.choice_3, q.choice_4],
            correctNum,
            correctLabel: ["A", "B", "C", "D"][correctNum - 1] ?? "",
            correctText: quizChoiceText(q, correctNum),
            total: s.total,
            correct: s.correct,
            pct,
          };
        })
        .filter((q) => q && q.pct < ACCURACY_THRESHOLD)
        .sort((a, b) => a.pct - b.pct);

      const strugglingChecks = subunitChecks
        .map((c) => {
          const s = checkStats[c.id];
          if (!s || s.total === 0) return null;
          const pct = Math.round((s.correct / s.total) * 100);
          const letter = String(c.correct_choice || "").toUpperCase();
          return {
            id: c.id,
            text: c.question,
            correctLabel: letter,
            correctText: attentionChoiceText(c, letter),
            total: s.total,
            correct: s.correct,
            pct,
          };
        })
        .filter((c) => c && c.pct < ACCURACY_THRESHOLD)
        .sort((a, b) => a.pct - b.pct);

      // Case studies: 4 sub-scores (a..d) → average → percent. Below 70 = struggle.
      const strugglingCaseStudies = [];
      const cs = caseStudies[0]; // typically one per subunit
      if (cs) {
        const responsesForCs = caseStudyResponses.filter((r) =>
          enrolledIds.size ? enrolledIds.has(r.student_id) : true,
        );
        for (const letter of ["a", "b", "c", "d"]) {
          const qText = cs[`question_${letter}`];
          const expectedAnswer = cs[`answer_${letter}`];
          if (!qText) continue;
          const scores = responsesForCs
            .map((r) => r[`score_${letter}`])
            .filter((v) => typeof v === "number");
          if (scores.length === 0) continue;
          const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
          const pct = Math.round(avg * 100);
          if (pct < ACCURACY_THRESHOLD) {
            strugglingCaseStudies.push({
              letter: letter.toLowerCase(), // lowercase so we render (a) not (A)
              text: stripLeadingMarker(qText),
              expectedAnswer: stripLeadingMarker(expectedAnswer || ""),
              total: scores.length,
              pct,
            });
          }
        }
        strugglingCaseStudies.sort((a, b) => a.pct - b.pct);
      }

      setResults({
        attentionChecks: strugglingChecks,
        quizQuestions: strugglingQuiz,
        caseStudyQuestions: strugglingCaseStudies,
        classLabel: classes.find((c) => c.id === selectedClassId)?.class_name ?? "",
        unitLabel: units.find((u) => u.id === selectedUnitId)?.unit_name ?? "",
        subunitLabel: subunits.find((s) => s.id === selectedSubunitId)?.subunit_name ?? "",
      });
    } catch (err) {
      console.error(err);
      setError(err?.message ?? "Failed to load analytics.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => quest.auth.logout();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <TeacherLayout activeNav="analytics" user={teacher} onSignOut={handleSignOut}>
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Tab title on its own row */}
        <h1 className="text-2xl font-semibold text-black">Curriculum Data</h1>
        <p className="text-sm text-gray-500 -mt-3">
          Questions students are struggling with — below {ACCURACY_THRESHOLD}% accuracy across the class.
        </p>

        {/* Selector row BELOW the title */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <Picker
            value={selectedClassId}
            onChange={setSelectedClassId}
            options={classes.map((c) => ({ id: c.id, label: c.class_name }))}
            placeholder="Class"
          />
          <Picker
            value={selectedUnitId}
            onChange={setSelectedUnitId}
            options={units.map((u) => ({ id: u.id, label: u.unit_name }))}
            placeholder="Unit"
            disabled={!selectedClassId}
          />
          <Picker
            value={selectedSubunitId}
            onChange={setSelectedSubunitId}
            options={subunits.map((s) => ({ id: s.id, label: s.subunit_name }))}
            placeholder="Topic"
            disabled={!selectedUnitId}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedSubunitId}
            className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-lg"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {results && (
          <div className="space-y-3 pt-2">
            <Section
              title="Attention Checks"
              icon={<Video className="w-4 h-4 text-blue-600" />}
              items={results.attentionChecks}
              accent="blue"
              kind="mc"
            />
            <Section
              title="Quiz Questions"
              icon={<HelpCircle className="w-4 h-4 text-indigo-600" />}
              items={results.quizQuestions}
              accent="indigo"
              kind="mc"
            />
            <Section
              title="Case Study Questions"
              icon={<PenTool className="w-4 h-4 text-purple-600" />}
              items={results.caseStudyQuestions}
              accent="purple"
              kind="frq"
            />
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

function Picker({ value, onChange, options, placeholder, disabled }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-44 h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0
          ? <div className="px-2 py-1.5 text-xs text-gray-400">None</div>
          : options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * `kind="mc"` → renders correctLabel + correctText (multiple-choice item).
 * `kind="frq"` → renders expectedAnswer (free-response case study item) with
 *                a single lowercase letter marker so we don't double-mark.
 */
function Section({ icon, title, items, accent, kind }) {
  const badge =
    { blue: "bg-blue-600", indigo: "bg-indigo-600", purple: "bg-purple-600" }[accent] ||
    "bg-gray-600";

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h2 className="font-medium text-gray-900">{title}</h2>
          <Badge variant="outline" className="ml-auto">{items.length}</Badge>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">
            No items below {ACCURACY_THRESHOLD}% — students are doing well here.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="border border-gray-200 rounded-md p-3 bg-white space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-900 font-medium">
                    {kind === "frq" && (
                      <span className="text-purple-700 mr-1">({item.letter})</span>
                    )}
                    {item.text}
                  </p>
                  <Badge className={`${badge} text-white shrink-0`}>{item.pct}%</Badge>
                </div>

                {/* Correct-answer line */}
                {kind === "mc" && item.correctLabel && (
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-green-700 font-semibold">
                        Correct answer ({item.correctLabel}):
                      </span>{" "}
                      <span className="text-gray-700">{item.correctText}</span>
                    </div>
                  </div>
                )}

                {kind === "frq" && item.expectedAnswer && (
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-green-700 font-semibold">Expected answer:</span>{" "}
                      <span className="text-gray-700">{item.expectedAnswer}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
