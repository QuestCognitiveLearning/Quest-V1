import React from "react";
import { pdf } from "@react-pdf/renderer";
import { quest } from "@/api/questClient";
import QuizPacket from "./templates/QuizPacket.jsx";
import CaseStudyPacket from "./templates/CaseStudyPacket.jsx";
import SubunitPacket from "./templates/SubunitPacket.jsx";
import ClassWorkbook from "./templates/ClassWorkbook.jsx";
import ParentReport from "./templates/ParentReport.jsx";

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

export async function generatePDF({ type, contentId, branding, data }) {
  let doc;
  if (type === "quiz") {
    const d = await loadQuizData(contentId);
    doc = <QuizPacket {...d} branding={branding} />;
  } else if (type === "caseStudy") {
    const d = await loadCaseStudyData(contentId);
    doc = <CaseStudyPacket {...d} branding={branding} />;
  } else if (type === "subunit") {
    const d = await loadSubunitData(contentId);
    doc = <SubunitPacket {...d} branding={branding} />;
  } else if (type === "classWorkbook") {
    const d = await loadClassData(contentId);
    doc = <ClassWorkbook {...d} branding={branding} />;
  } else if (type === "parentReport") {
    if (!data) throw new Error("parentReport requires data");
    doc = <ParentReport {...data} branding={branding} />;
  } else {
    throw new Error(`Unknown PDF type: ${type}`);
  }
  return pdf(doc).toBlob();
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
