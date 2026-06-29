/**
 * Case-study discussion questions come in two shapes across the platform:
 *   - plain strings:           ["What causes X?", ...]
 *   - { question, answer }:    [{ question: "What causes X?", answer: "…" }, ...]
 *
 * The object shape carries an optional expected answer and is produced whenever
 * content is reviewed/edited with the teacher's "expected answers" enabled
 * (curriculum, and now single / live / assigned sessions). These helpers read
 * either shape so every consumer — players, previews, PDFs — stays tolerant.
 */
export const dqText = (item) =>
  typeof item === "string" ? item : item?.question || "";

export const dqAnswer = (item) =>
  typeof item === "string" ? "" : item?.answer || "";
