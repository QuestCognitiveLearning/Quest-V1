import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageNumber,
  Header,
  Footer,
  ImageRun,
} from "docx";
import { quest } from "@/api/questClient";

const LETTERS = ["A", "B", "C", "D"];
const BRAND = "2563EB";
const INK = "1A1A1A";
const MUTED = "475569";

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

// ---------------------------------------------------------------------------
// generateTryWord — produces a real .docx for the /try in-memory result shape
// (no DB lookup). Used by the trial-gated Word download on /try.
// ---------------------------------------------------------------------------

function pageFooter(branding) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${branding?.businessName || "questlearning.co"}  ·  `,
            size: 18,
            color: MUTED,
          }),
          new TextRun({
            children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
            size: 18,
            color: MUTED,
          }),
        ],
      }),
    ],
  });
}

function tryQuizDoc({ video, quiz, case_study, gradeLevel, branding }) {
  const topic = video?.title || "YouTube Handout";
  const businessName = branding?.businessName || "Quest Learning";
  const children = [];

  // Eyebrow
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "QUEST LEARNING HANDOUT",
          bold: true,
          color: BRAND,
          size: 18,
          characterSpacing: 40,
        }),
      ],
    }),
  );

  // Title
  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: topic,
          bold: true,
          size: 56,
          color: INK,
        }),
      ],
    }),
  );

  // Subtitle line
  const subtitleBits = [
    `${quiz.length} multiple-choice questions`,
    gradeLevel ? `Grade level: ${gradeLevel}` : null,
    video?.channelTitle ? `Source: ${video.channelTitle}` : null,
  ].filter(Boolean);
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: subtitleBits.join("  ·  "),
          color: MUTED,
          size: 22,
        }),
      ],
    }),
  );

  // Case study (if present)
  if (case_study?.scenario) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: "CASE STUDY SCENARIO",
            bold: true,
            color: BRAND,
            size: 18,
            characterSpacing: 30,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEF2FF" },
        border: {
          top:    { style: BorderStyle.SINGLE, size: 6, color: "DBEAFE" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "DBEAFE" },
          left:   { style: BorderStyle.SINGLE, size: 6, color: "DBEAFE" },
          right:  { style: BorderStyle.SINGLE, size: 6, color: "DBEAFE" },
        },
        children: [
          new TextRun({ text: case_study.scenario, size: 22, color: INK }),
        ],
      }),
    );
    if (case_study.discussion_questions?.length) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({
              text: "Discussion prompts",
              bold: true,
              size: 26,
              color: INK,
            }),
          ],
        }),
      );
      case_study.discussion_questions.forEach((q, i) => {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({ text: `${i + 1}. `, bold: true, color: BRAND, size: 22 }),
              new TextRun({ text: q, size: 22, color: INK }),
            ],
          }),
        );
        // Three answer lines per prompt
        for (let j = 0; j < 3; j++) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              },
              children: [new TextRun({ text: " ", size: 22 })],
            }),
          );
        }
      });
    }
  }

  // Quiz section
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "QUIZ",
          bold: true,
          color: BRAND,
          size: 18,
          characterSpacing: 30,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${topic} — ${quiz.length} questions`,
          bold: true,
          size: 28,
          color: INK,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Name: ______________________________   Date: __________`,
          size: 20,
          color: MUTED,
        }),
      ],
    }),
  );

  quiz.forEach((q, i) => {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        keepNext: true,
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: BRAND, size: 24 }),
          new TextRun({ text: q.question, bold: true, size: 24, color: INK }),
        ],
      }),
    );
    ["a", "b", "c", "d"].forEach((letter, ci) => {
      const choice = q[`choice_${letter}`];
      if (!choice) return;
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `○  `, size: 22, color: MUTED }),
            new TextRun({ text: `${LETTERS[ci]}. `, bold: true, size: 22, color: INK }),
            new TextRun({ text: choice, size: 22, color: INK }),
          ],
        }),
      );
    });
  });

  // Answer key
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "ANSWER KEY",
          bold: true,
          color: BRAND,
          size: 18,
          characterSpacing: 30,
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${topic} — Answers`,
          bold: true,
          size: 28,
          color: INK,
        }),
      ],
    }),
  );

  quiz.forEach((q, i) => {
    const correctLetter = String(q.correct_choice || "A").toUpperCase();
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, color: BRAND, size: 22 }),
          new TextRun({ text: correctLetter, bold: true, color: INK, size: 22 }),
          q.explanation
            ? new TextRun({ text: `  —  ${q.explanation}`, size: 20, color: MUTED })
            : new TextRun({ text: "" }),
        ],
      }),
    );
  });

  return new Document({
    creator: businessName,
    title: `${topic} — Quest Learning`,
    styles: {
      default: {
        document: { run: { font: "Calibri" } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter in twips
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        footers: { default: pageFooter(branding) },
        children,
      },
    ],
  });
}

export async function generateTryWord(input) {
  const doc = tryQuizDoc(input);
  return Packer.toBlob(doc);
}

export async function downloadTryWord({ result, branding, label }) {
  const blob = await generateTryWord({ ...result, branding });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildWordFileName("quiz", label || result?.video?.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
