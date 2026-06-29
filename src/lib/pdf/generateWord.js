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
import { dqText } from "@/lib/caseStudy";

const LETTERS = ["A", "B", "C", "D"];
const BRAND = "2563EB";
const INK = "1A1A1A";
const MUTED = "475569";


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
              new TextRun({ text: dqText(q), size: 22, color: INK }),
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
