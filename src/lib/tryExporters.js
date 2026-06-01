/**
 * @file   tryExporters.js
 * @desc   Client-side PDF and Word exporters for the /Try funnel. PDF uses
 *         jspdf (text-rendered so teachers can copy/paste); Word uses an HTML
 *         blob with application/msword MIME so Microsoft Word opens it
 *         natively — no docx-library dependency needed.
 *
 *         Shared input shape (from publicTryFunnel `generate`):
 *           { video: { title, channelTitle, ... },
 *             quiz: [{ question, choice_a..d, correct_choice, explanation }],
 *             case_study: { scenario, discussion_questions: [string] } }
 */
import { jsPDF } from 'jspdf';

const A4_MARGIN = 56;
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LINE_HEIGHT = 16;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(title) {
  return (title || 'quest-handout')
    .replace(/[^a-z0-9-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .toLowerCase() || 'quest-handout';
}

export function exportPdf({ video, quiz, case_study }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const maxWidth = A4_WIDTH - A4_MARGIN * 2;
  let y = A4_MARGIN;

  const newPageIfNeeded = (needed) => {
    if (y + needed > A4_HEIGHT - A4_MARGIN) {
      doc.addPage();
      y = A4_MARGIN;
    }
  };

  const writeWrapped = (text, opts = {}) => {
    const { size = 11, style = 'normal', spacing = 6 } = opts;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text || '', maxWidth);
    for (const line of lines) {
      newPageIfNeeded(LINE_HEIGHT);
      doc.text(line, A4_MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += spacing;
  };

  // Header.
  writeWrapped(video?.title || 'Quest Learning Handout', { size: 18, style: 'bold', spacing: 4 });
  if (video?.channelTitle) {
    writeWrapped(`Source: ${video.channelTitle} (YouTube)`, { size: 9, style: 'italic', spacing: 14 });
  }

  // Case study.
  if (case_study?.scenario) {
    writeWrapped('Case Study', { size: 14, style: 'bold', spacing: 4 });
    writeWrapped(case_study.scenario, { size: 11, spacing: 10 });
    if (case_study.discussion_questions?.length) {
      writeWrapped('Discussion Questions', { size: 12, style: 'bold', spacing: 4 });
      case_study.discussion_questions.forEach((q, i) => {
        writeWrapped(`${i + 1}. ${q}`, { size: 11, spacing: 4 });
      });
      y += 8;
    }
  }

  // Quiz.
  if (quiz?.length) {
    newPageIfNeeded(40);
    writeWrapped('Quiz', { size: 14, style: 'bold', spacing: 6 });
    quiz.forEach((q, i) => {
      newPageIfNeeded(LINE_HEIGHT * 7);
      writeWrapped(`${i + 1}. ${q.question}`, { size: 11, style: 'bold', spacing: 2 });
      writeWrapped(`A. ${q.choice_a}`, { size: 11, spacing: 1 });
      writeWrapped(`B. ${q.choice_b}`, { size: 11, spacing: 1 });
      writeWrapped(`C. ${q.choice_c}`, { size: 11, spacing: 1 });
      writeWrapped(`D. ${q.choice_d}`, { size: 11, spacing: 8 });
    });

    // Answer key on a fresh page.
    doc.addPage();
    y = A4_MARGIN;
    writeWrapped('Answer Key', { size: 14, style: 'bold', spacing: 8 });
    quiz.forEach((q, i) => {
      writeWrapped(`${i + 1}. ${q.correct_choice}${q.explanation ? ` — ${q.explanation}` : ''}`, { size: 10, spacing: 4 });
    });
  }

  // Footer on last page.
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Generated with Quest Learning · questlearning.co', A4_MARGIN, A4_HEIGHT - 24);

  doc.save(`${safeFilename(video?.title)}.pdf`);
}

// Word export via HTML-as-.doc — Word opens this directly. No library needed.
export function exportDoc({ video, quiz, case_study }) {
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const quizHtml = (quiz || []).map((q, i) => `
    <p><b>${i + 1}. ${esc(q.question)}</b></p>
    <p style="margin-left:18pt">A. ${esc(q.choice_a)}<br/>
       B. ${esc(q.choice_b)}<br/>
       C. ${esc(q.choice_c)}<br/>
       D. ${esc(q.choice_d)}</p>
  `).join('');

  const answerKeyHtml = (quiz || []).map((q, i) =>
    `<p>${i + 1}. <b>${esc(q.correct_choice)}</b>${q.explanation ? ` — ${esc(q.explanation)}` : ''}</p>`
  ).join('');

  const discussionHtml = (case_study?.discussion_questions || []).map((q, i) =>
    `<p>${i + 1}. ${esc(q)}</p>`
  ).join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${esc(video?.title || 'Quest Learning Handout')}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color:#111; }
    h1 { font-size: 18pt; margin-bottom: 4pt; }
    h2 { font-size: 14pt; margin-top: 24pt; margin-bottom: 6pt; }
    .source { color:#666; font-style: italic; font-size: 9pt; margin-bottom: 18pt; }
    .pagebreak { page-break-before: always; }
  </style>
</head>
<body>
  <h1>${esc(video?.title || 'Quest Learning Handout')}</h1>
  ${video?.channelTitle ? `<div class="source">Source: ${esc(video.channelTitle)} (YouTube)</div>` : ''}

  ${case_study?.scenario ? `
    <h2>Case Study</h2>
    <p>${esc(case_study.scenario)}</p>
    ${discussionHtml ? `<h2>Discussion Questions</h2>${discussionHtml}` : ''}
  ` : ''}

  ${quizHtml ? `<h2>Quiz</h2>${quizHtml}` : ''}

  ${answerKeyHtml ? `<div class="pagebreak"></div><h2>Answer Key</h2>${answerKeyHtml}` : ''}

  <p style="margin-top:32pt;color:#888;font-size:9pt;font-style:italic">
    Generated with Quest Learning · questlearning.co
  </p>
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  downloadBlob(blob, `${safeFilename(video?.title)}.doc`);
}
