import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { quest } from "@/api/questClient";

const LETTERS = ["A", "B", "C", "D"];

async function loadQuiz(quizId) {
  const quiz = await quest.entities.Quiz.get(quizId);
  if (!quiz) throw new Error("Quiz not found");
  const [questionsRaw, subunit] = await Promise.all([
    quest.entities.Question.filter({ quiz_id: quizId }, "question_order", null),
    quest.entities.Subunit.get(quiz.subunit_id),
  ]);
  const questions = (questionsRaw || []).sort(
    (a, b) => (a.question_order || 0) - (b.question_order || 0)
  );
  return { topic: subunit?.subunit_name || "Quiz", questions };
}

async function loadCaseStudy(caseStudyId) {
  const cs = await quest.entities.CaseStudy.get(caseStudyId);
  if (!cs) throw new Error("Case study not found");
  const subunit = cs.subunit_id
    ? await quest.entities.Subunit.get(cs.subunit_id)
    : null;
  return {
    topic: subunit?.subunit_name || "Case Study",
    scenario: cs.scenario || "",
    prompts: [cs.question_a, cs.question_b, cs.question_c, cs.question_d].filter(
      Boolean
    ),
    modelAnswers: [cs.answer_a, cs.answer_b, cs.answer_c, cs.answer_d].filter(
      Boolean
    ),
  };
}

function quizDoc(topic, questions, branding) {
  const businessName = branding?.businessName || "Quest Learning";
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: topic, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${questions.length} multiple-choice questions · ${businessName}`,
          italics: true,
          size: 22,
          color: "475569",
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  questions.forEach((q, i) => {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: "2563EB" }),
          new TextRun({ text: q.question_text, bold: false }),
        ],
      })
    );
    [q.choice_1, q.choice_2, q.choice_3, q.choice_4]
      .filter((c) => c != null && c !== "")
      .forEach((c, ci) => {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `   ${LETTERS[ci]}.  ` }),
              new TextRun({ text: c }),
            ],
          })
        );
      });
  });

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 120 },
      children: [new TextRun({ text: "Answer Key", bold: true })],
    })
  );
  questions.forEach((q, i) => {
    const correct = LETTERS[(q.correct_choice || 1) - 1];
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: "2563EB" }),
          new TextRun({ text: correct, bold: true }),
          new TextRun({
            text: q.explanation ? `  —  ${q.explanation}` : "",
            color: "475569",
          }),
        ],
      })
    );
  });

  return new Document({ sections: [{ children }] });
}

function caseStudyDoc(topic, scenario, prompts, modelAnswers, branding) {
  const businessName = branding?.businessName || "Quest Learning";
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: `${topic} — Case Study`, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: businessName, italics: true, color: "475569" }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240 },
      children: [new TextRun({ text: "Scenario", bold: true })],
    }),
    new Paragraph({ children: [new TextRun(scenario)] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240 },
      children: [new TextRun({ text: "Prompts", bold: true })],
    }),
  ];
  prompts.forEach((p, i) =>
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: "2563EB" }),
          new TextRun({ text: p }),
        ],
      })
    )
  );
  if (modelAnswers.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240 },
        children: [new TextRun({ text: "Model Answers", bold: true })],
      })
    );
    modelAnswers.forEach((a, i) =>
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [
            new TextRun({
              text: `Prompt ${i + 1}: `,
              bold: true,
              color: "2563EB",
            }),
            new TextRun({ text: a }),
          ],
        })
      )
    );
  }
  return new Document({ sections: [{ children }] });
}

export async function generateWord({ type, contentId, branding }) {
  let doc;
  if (type === "quiz") {
    const d = await loadQuiz(contentId);
    doc = quizDoc(d.topic, d.questions, branding);
  } else if (type === "caseStudy") {
    const d = await loadCaseStudy(contentId);
    doc = caseStudyDoc(d.topic, d.scenario, d.prompts, d.modelAnswers, branding);
  } else {
    throw new Error(`Word export not supported for type: ${type}`);
  }
  return Packer.toBlob(doc);
}

export function buildWordFileName(type, label) {
  const date = new Date().toISOString().slice(0, 10);
  const safe = (label || "Quest")
    .replace(/[^a-z0-9\- ]/gi, "")
    .trim()
    .replace(/\s+/g, "-");
  const typeLabel = type === "quiz" ? "Quiz" : "Case-Study";
  return `${safe}-${typeLabel}-${date}.docx`;
}

export async function downloadWord({ type, contentId, branding, label }) {
  const blob = await generateWord({ type, contentId, branding });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildWordFileName(type, label);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
