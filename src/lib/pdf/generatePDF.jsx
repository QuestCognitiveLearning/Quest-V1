import React from "react";
import { pdf } from "@react-pdf/renderer";
import { quest } from "@/api/questClient";
import QuizPacket from "./templates/QuizPacket.jsx";
import CaseStudyPacket from "./templates/CaseStudyPacket.jsx";
import SubunitPacket from "./templates/SubunitPacket.jsx";
import ClassWorkbook from "./templates/ClassWorkbook.jsx";
import ClassAnalytics from "./templates/ClassAnalytics.jsx";
import ParentReport from "./templates/ParentReport.jsx";
import { deepSanitizePdf, sanitizePdfText } from "./shared/sanitize.js";
import { dqText } from "@/lib/caseStudy";

const GRADE_LABEL = {
  Elementary: "Grades 3–5",
  Middle: "Grades 6–8",
  High: "Grades 9–12",
  Undergraduate: "College",
  Graduate: "Graduate",
};

async function loadQuizData(quizId) {
  const quiz = await quest.entities.Quiz.get(quizId);
  if (!quiz) throw new Error("Quiz not found");

  const [questionsRaw, subunit] = await Promise.all([
    quest.entities.Question.filter({ quiz_id: quizId }, "question_order", null),
    quest.entities.Subunit.get(quiz.subunit_id),
  ]);
  const questions = (questionsRaw || []).sort(
    (a, b) => (a.question_order || 0) - (b.question_order || 0)
  );

  let curriculum = null;
  if (subunit?.unit_id) {
    const unit = await quest.entities.Unit.get(subunit.unit_id);
    if (unit?.curriculum_id) {
      curriculum = await quest.entities.Curriculum.get(unit.curriculum_id);
    }
  }
  return {
    topic: subunit?.subunit_name || "Quiz",
    standards: subunit?.learning_standard,
    gradeLevel: curriculum ? GRADE_LABEL[curriculum.curriculum_difficulty] : null,
    source: curriculum?.subject_name,
    questions,
  };
}

async function loadCaseStudyData(caseStudyId) {
  const cs = await quest.entities.CaseStudy.get(caseStudyId);
  if (!cs) throw new Error("Case study not found");
  const subunit = cs.subunit_id
    ? await quest.entities.Subunit.get(cs.subunit_id)
    : null;
  const prompts = [cs.question_a, cs.question_b, cs.question_c, cs.question_d].filter(
    Boolean
  );
  const modelAnswers = [cs.answer_a, cs.answer_b, cs.answer_c, cs.answer_d].filter(
    Boolean
  );
  let curriculum = null;
  if (subunit?.unit_id) {
    const unit = await quest.entities.Unit.get(subunit.unit_id);
    if (unit?.curriculum_id) {
      curriculum = await quest.entities.Curriculum.get(unit.curriculum_id);
    }
  }
  return {
    topic: subunit?.subunit_name || "Case Study",
    gradeLevel: curriculum ? GRADE_LABEL[curriculum.curriculum_difficulty] : null,
    source: curriculum?.subject_name,
    scenario: cs.scenario || "",
    prompts,
    modelAnswers,
  };
}

async function loadSubunitData(subunitId) {
  const subunit = await quest.entities.Subunit.get(subunitId);
  if (!subunit) throw new Error("Subunit not found");

  const [quizzes, caseStudies] = await Promise.all([
    quest.entities.Quiz.filter({ subunit_id: subunitId }, "-created_date", null),
    quest.entities.CaseStudy.filter(
      { subunit_id: subunitId },
      "-created_date",
      1
    ),
  ]);
  const newTopicQuiz =
    (quizzes || []).find((q) => q.quiz_type === "new_topic") || (quizzes || [])[0];
  const questionsRaw = newTopicQuiz
    ? await quest.entities.Question.filter(
        { quiz_id: newTopicQuiz.id },
        "question_order",
        null
      )
    : [];
  const questions = (questionsRaw || []).sort(
    (a, b) => (a.question_order || 0) - (b.question_order || 0)
  );
  const cs = (caseStudies || [])[0];
  const prompts = cs
    ? [cs.question_a, cs.question_b, cs.question_c, cs.question_d].filter(Boolean)
    : [];
  const modelAnswers = cs
    ? [cs.answer_a, cs.answer_b, cs.answer_c, cs.answer_d].filter(Boolean)
    : [];

  let curriculum = null;
  if (subunit.unit_id) {
    const unit = await quest.entities.Unit.get(subunit.unit_id);
    if (unit?.curriculum_id) {
      curriculum = await quest.entities.Curriculum.get(unit.curriculum_id);
    }
  }
  return {
    topic: subunit.subunit_name || "Subunit",
    standards: subunit.learning_standard,
    gradeLevel: curriculum ? GRADE_LABEL[curriculum.curriculum_difficulty] : null,
    questions,
    scenario: cs?.scenario || null,
    prompts,
    modelAnswers,
  };
}

async function loadClassData(classId) {
  const klass = await quest.entities.Class.get(classId);
  if (!klass) throw new Error("Class not found");
  const curriculum = await quest.entities.Curriculum.get(klass.curriculum_id);

  const units = await quest.entities.Unit.filter(
    { curriculum_id: klass.curriculum_id },
    "unit_order",
    null
  );

  const allSubunits = [];
  for (const u of units || []) {
    const subs = await quest.entities.Subunit.filter(
      { unit_id: u.id },
      "subunit_order",
      null
    );
    for (const s of subs || []) {
      allSubunits.push({ ...s, unit_name: u.unit_name });
    }
  }

  const hydrated = [];
  for (const s of allSubunits) {
    const [quizzes, cases] = await Promise.all([
      quest.entities.Quiz.filter({ subunit_id: s.id }, "-created_date", null),
      quest.entities.CaseStudy.filter({ subunit_id: s.id }, "-created_date", 1),
    ]);
    const quiz =
      (quizzes || []).find((q) => q.quiz_type === "new_topic") ||
      (quizzes || [])[0];
    const questions = quiz
      ? await quest.entities.Question.filter(
          { quiz_id: quiz.id },
          "question_order",
          null
        )
      : [];
    const cs = (cases || [])[0];
    hydrated.push({
      ...s,
      questions: (questions || []).sort(
        (a, b) => (a.question_order || 0) - (b.question_order || 0)
      ),
      case_study: cs
        ? {
            scenario: cs.scenario,
            prompts: [cs.question_a, cs.question_b, cs.question_c, cs.question_d].filter(
              Boolean
            ),
          }
        : null,
    });
  }

  return {
    className: klass.class_name,
    curriculumName: curriculum?.subject_name,
    gradeLevel: curriculum
      ? GRADE_LABEL[curriculum.curriculum_difficulty]
      : null,
    subunits: hydrated,
  };
}

// Class analytics — averages + completion computed from StudentProgress across
// the enrolled roster, rolled up by unit and by student, plus a "needs
// attention" list. Used by the teacher's "Download Analytics" button.
async function loadAnalyticsData(classId) {
  const klass = await quest.entities.Class.get(classId);
  if (!klass) throw new Error("Class not found");
  const curriculum = klass.curriculum_id
    ? await quest.entities.Curriculum.get(klass.curriculum_id)
    : null;

  const unitRows = klass.curriculum_id
    ? await quest.entities.Unit.filter({ curriculum_id: klass.curriculum_id }, "unit_order", null)
    : [];

  const unitsWithSubs = [];
  const allSubunits = [];
  for (const u of unitRows || []) {
    const subs = await quest.entities.Subunit.filter({ unit_id: u.id }, "subunit_order", null);
    const list = subs || [];
    unitsWithSubs.push({ unit: u, subs: list });
    for (const s of list) allSubunits.push({ ...s, unit_name: u.unit_name });
  }
  const subunitIds = new Set(allSubunits.map((s) => s.id));

  const enrollments = await quest.entities.StudentEnrollment.filter({ class_id: classId });
  const roster = enrollments || [];
  const studentIds = roster.map((e) => e.student_id).filter(Boolean);

  let progress = [];
  if (studentIds.length) {
    const rows = await quest.entities.StudentProgress.filter({ student_id: studentIds });
    progress = (rows || []).filter((p) => subunitIds.has(p.subunit_id));
  }

  // A single completed score per student+subunit (prefer learn, fall back to
  // the latest review score).
  const scoreOf = (p) =>
    p.new_session_completed
      ? (typeof p.new_session_score === "number" ? p.new_session_score : null)
      : (typeof p.last_review_score === "number" ? p.last_review_score : null);
  const isDone = (p) => !!p.new_session_completed;

  const studentCount = roster.length;
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // Per-subunit rollup.
  const subStats = new Map(); // subunitId -> { scores:[], completed:0 }
  for (const p of progress) {
    const st = subStats.get(p.subunit_id) || { scores: [], completed: 0 };
    const sc = scoreOf(p);
    if (sc != null) st.scores.push(sc);
    if (isDone(p)) st.completed += 1;
    subStats.set(p.subunit_id, st);
  }

  const units = unitsWithSubs
    .filter((g) => g.subs.length > 0)
    .map((g) => {
      const scores = [];
      let completed = 0;
      for (const s of g.subs) {
        const st = subStats.get(s.id);
        if (st) {
          scores.push(...st.scores);
          completed += st.completed;
        }
      }
      const denom = g.subs.length * (studentCount || 1);
      return {
        name: g.unit.unit_name,
        avg: avg(scores),
        completionPct: studentCount ? (completed / denom) * 100 : null,
      };
    });

  const strugglingSubunits = allSubunits
    .map((s) => ({ name: s.subunit_name, unit: s.unit_name, avg: avg((subStats.get(s.id) || {}).scores || []) }))
    .filter((s) => s.avg != null && s.avg < 70)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 12);

  // Per-student rollup.
  const byStudent = new Map(); // student_id -> scores[], completed
  for (const p of progress) {
    const st = byStudent.get(p.student_id) || { scores: [], completed: 0 };
    const sc = scoreOf(p);
    if (sc != null) st.scores.push(sc);
    if (isDone(p)) st.completed += 1;
    byStudent.set(p.student_id, st);
  }
  const students = roster
    .map((e) => {
      const st = byStudent.get(e.student_id) || { scores: [], completed: 0 };
      return {
        name: e.student_full_name || e.student_email || "Student",
        avg: avg(st.scores),
        completedCount: st.completed,
      };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  const allScores = [];
  let allCompleted = 0;
  for (const st of subStats.values()) {
    allScores.push(...st.scores);
    allCompleted += st.completed;
  }
  const completionDenom = allSubunits.length * (studentCount || 1);

  return {
    className: klass.class_name,
    curriculumName: curriculum?.subject_name,
    gradeLevel: curriculum ? GRADE_LABEL[curriculum.curriculum_difficulty] : null,
    studentCount,
    subunitCount: allSubunits.length,
    classAvg: avg(allScores),
    completionPct: completionDenom ? (allCompleted / completionDenom) * 100 : null,
    units,
    strugglingSubunits,
    students,
  };
}

export async function generatePDF({ type, contentId, branding, data }) {
  // Strip glyphs the built-in PDF font can't render (math symbols etc.) so the
  // render never aborts with "unsupported number".
  const b = deepSanitizePdf(branding);
  let doc;
  if (type === "quiz") {
    const d = deepSanitizePdf(await loadQuizData(contentId));
    doc = <QuizPacket {...d} branding={b} />;
  } else if (type === "caseStudy") {
    const d = deepSanitizePdf(await loadCaseStudyData(contentId));
    doc = <CaseStudyPacket {...d} branding={b} />;
  } else if (type === "subunit") {
    const d = deepSanitizePdf(await loadSubunitData(contentId));
    doc = <SubunitPacket {...d} branding={b} />;
  } else if (type === "classWorkbook") {
    const d = deepSanitizePdf(await loadClassData(contentId));
    doc = <ClassWorkbook {...d} branding={b} />;
  } else if (type === "classAnalytics") {
    const d = deepSanitizePdf(await loadAnalyticsData(contentId));
    doc = <ClassAnalytics {...d} branding={b} />;
  } else if (type === "parentReport") {
    if (!data) throw new Error("parentReport requires data");
    doc = <ParentReport {...deepSanitizePdf(data)} branding={b} />;
  } else {
    throw new Error(`Unknown PDF type: ${type}`);
  }
  return pdf(doc).toBlob();
}

// Render a PDF from the in-memory shape returned by the publicTryFunnel
// Edge Function (no DB lookup). Used by the /Try lead magnet flow.
export async function generateTryPDF({
  video,
  quiz,
  case_study,
  gradeLevel,
  branding,
}) {
  const LETTER_TO_NUM = { A: 1, B: 2, C: 3, D: 4 };
  const questions = (quiz || []).map((q, i) => ({
    id: i,
    question_text: q.question,
    choice_1: q.choice_a,
    choice_2: q.choice_b,
    choice_3: q.choice_c,
    choice_4: q.choice_d,
    correct_choice:
      LETTER_TO_NUM[String(q.correct_choice || "").toUpperCase()] || 1,
    explanation: q.explanation,
    question_order: i,
  }));
  const prompts = (case_study?.discussion_questions || []).map(dqText);
  const topic = video?.title || "YouTube video";

  // Strip glyphs the built-in PDF font can't render (math symbols etc.).
  const sTopic = sanitizePdfText(topic);
  const sQuestions = deepSanitizePdf(questions);
  const sPrompts = deepSanitizePdf(prompts);
  const sScenario = sanitizePdfText(case_study?.scenario);
  const b = deepSanitizePdf(branding);

  const doc = case_study?.scenario ? (
    <SubunitPacket
      topic={sTopic}
      gradeLevel={gradeLevel}
      questions={sQuestions}
      scenario={sScenario}
      prompts={sPrompts}
      branding={b}
    />
  ) : (
    <QuizPacket
      topic={sTopic}
      gradeLevel={gradeLevel}
      source={sanitizePdfText(video?.channelTitle)}
      questions={sQuestions}
      branding={b}
    />
  );

  return pdf(doc).toBlob();
}

export async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

export function buildFileName(type, label) {
  const date = new Date().toISOString().slice(0, 10);
  const safe = (label || "Quest")
    .replace(/[^a-z0-9\- ]/gi, "")
    .trim()
    .replace(/\s+/g, "-");
  const typeLabel = {
    quiz: "Quiz",
    caseStudy: "Case-Study",
    subunit: "Packet",
    classWorkbook: "Workbook",
    classAnalytics: "Analytics",
    parentReport: "Progress-Report",
  }[type] || "Packet";
  return `${safe}-${typeLabel}-${date}.pdf`;
}

export async function downloadPDF({ type, contentId, branding, data, label }) {
  const blob = await generatePDF({ type, contentId, branding, data });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildFileName(type, label);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
