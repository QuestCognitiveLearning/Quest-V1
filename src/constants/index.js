/**
 * @file   constants/index.js
 * @desc   App-wide constants. Anything that's a magic number, magic string,
 *         or shared enum belongs here. Pages and components import named
 *         constants rather than hard-coding values.
 * @author Quest Learning core team
 */

// === Account types ===
export const ACCOUNT_TYPE = Object.freeze({
  TEACHER: 'teacher',
  STUDENT: 'student',
});

// === Subscription tiers ===
export const SUBSCRIPTION_STATUS = Object.freeze({
  FREE: 'free',
  TRIAL: 'trial',
  PREMIUM: 'premium',
  GRACE_PERIOD: 'grace_period',
});

export const SUBSCRIPTION_TIER = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
});

// === Session types ===
export const SESSION_TYPE = Object.freeze({
  NEW_TOPIC: 'new_topic',
  REVIEW: 'review',
});

// === Quiz difficulty ===
export const DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

// === Timing (milliseconds) ===
export const TOAST_DISMISS_MS = 4_000;
export const SESSION_RESUME_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const AUTH_REFRESH_RETRY_MS = 500;
export const OAUTH_REDIRECT_TIMEOUT_MS = 5_000;
export const ME_FETCH_TIMEOUT_MS = 5_000;

// === Limits ===
export const MAX_PROMPT_CHARS = 50_000;
export const MAX_FEEDBACK_TAG_COUNT = 3;
export const MAX_QUIZ_QUESTIONS_PER_SUBUNIT = 40;

// === Route names (mirrors keys in pages.config.js) ===
export const ROUTE = Object.freeze({
  LANDING: 'Landing',
  SIGN_IN: 'SignIn',
  ROLE_SELECTION: 'RoleSelection',
  PRICING: 'Pricing',
  TEACHER_DASHBOARD: 'TeacherDashboard',
  TEACHER_LIVE_SESSION: 'TeacherLiveSession',
  TEACHER_SETTINGS: 'TeacherSettings',
  LEARNING_HUB: 'LearningHub',
  KNOWLEDGE_MAP: 'KnowledgeMap',
  JOIN_CLASS: 'JoinClass',
  NEW_SESSION: 'NewSession',
  PRACTICE_SESSION: 'PracticeSession',
});
