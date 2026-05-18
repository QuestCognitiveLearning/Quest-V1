// Per-call-site OpenAI model routing. One source of truth — every call site
// imports from here so we can re-tune in one place.
//
// Tiers chosen from a head-to-head benchmark (see commit history). Key findings:
//   - gpt-5-mini beat gpt-5 on case-study pedagogy at 1/6 the price.
//   - gpt-4o and gpt-4o-mini produced physics errors on the same benchmark.
//     Do not route any correctness-sensitive call there.
//   - gpt-4.1-mini is the sweet spot for chat-like calls (fast, no errors).
//   - gpt-4.1-nano is fine for outputs that are a single digit or 1 sentence.

export const LLM_MODELS = {
  // High-stakes generation. Content here becomes the source of truth for
  // every student who later takes this subunit — bad model answers
  // mis-grade everyone, so we spend on these.
  QUIZ_GENERATION:        'gpt-5-mini',  // 40 MCQs, JSON-strict, distractor quality matters
  CASE_STUDY_GENERATION:  'gpt-5-mini',  // Drives grading. Benchmark winner.
  ATTENTION_CHECKS:       'gpt-5-mini',  // Must not forward-reference future segments
  INQUIRY_CONTENT:        'gpt-5-mini',  // Image prompt quality → image quality
  STANDARDS_PICKER:       'gpt-4.1-mini', // Reformat-only task; mini is plenty fast and accurate. Switched off gpt-5-mini because full standard sets timed out the edge worker.

  // Mid-tier. Comparison / scoring tasks where the answer is bounded.
  CASE_STUDY_GRADING:     'gpt-4.1-mini', // Compares student answer to model answer
  CASE_STUDY_FOLLOWUP:    'gpt-4.1-mini', // Student-facing 2-3 sentence Q&A

  // Chat-tier. Short student-facing reactions, 1-2 sentences, no factual claims.
  SOCRATIC_TUTOR:         'gpt-4.1-mini',
  MC_CHOICE_GENERATOR:    'gpt-4.1-mini', // 3 distractors per Socratic question

  // Cheapest tier. Outputs a single digit / short summary.
  FEEDBACK_SCORING:       'gpt-4.1-nano', // Returns 1, 2, or 3
  VIDEO_SUMMARY:          'gpt-4.1-nano', // 2-3 sentence summary
};

// Image generation quality. `medium` is visually near-identical to `high` for
// 1024px-wide hook images and costs ~$0.07 vs $0.25.
export const IMAGE_QUALITY = 'medium';
