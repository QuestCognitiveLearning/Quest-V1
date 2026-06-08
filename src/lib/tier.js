/**
 * @file tier.js
 * @desc Single source of truth for tier capability checks. The legacy
 *       `subscription_tier` column ('free' | 'premium') is kept for
 *       backwards compatibility; the new `tier` column ('free' | 'classroom')
 *       is the authoritative one going forward.
 *
 *       Helpers here accept a user object and return booleans so feature
 *       gates stay declarative at call sites (no enum branching scattered).
 */

export const TIERS = ["free", "classroom"];

const INF = Number.POSITIVE_INFINITY;

export const TIER_LIMITS = {
  free: {
    maxClasses: 1,
    maxStudents: 30,
    aiGenerationsPerMonth: 10,
    liveSessionsEnabled: false,
    pandaTutorEnabled: false,
  },
  classroom: {
    maxClasses: INF,
    maxStudents: INF,
    aiGenerationsPerMonth: INF,
    liveSessionsEnabled: true,
    pandaTutorEnabled: true,
  },
};

// Reads the effective tier from a user record. Prefers the new `tier` column;
// falls back to the legacy `subscription_tier` mapping. Legacy Studio /
// Enterprise tier values (from the old tutor build) collapse to 'classroom'
// so existing subscribers retain teacher access while their Stripe
// subscription remains active.
export function getUserTier(user) {
  if (!user) return "free";
  if (user.tier === "classroom" || user.tier === "free") return user.tier;
  if (user.tier === "studio" || user.tier === "enterprise") return "classroom";
  if (user.subscription_tier === "premium") return "classroom";
  return "free";
}

export function getLimits(user) {
  return TIER_LIMITS[getUserTier(user)] || TIER_LIMITS.free;
}

// Coarse role label used by i18n + tutor-vs-teacher UI gating. The DB has
// account_type (student/teacher) and new_role (tutor) — tutor wins when
// both are present so the Studio surface renders.
export function getUserRole(user) {
  if (!user) return "teacher";
  if (user.new_role === "tutor") return "tutor";
  if (user.account_type === "tutor") return "tutor";
  return "teacher";
}

export function canCreateClass(user, currentClassCount) {
  const limit = getLimits(user).maxClasses;
  return currentClassCount < limit;
}

export function isFeatureEnabled(user, featureKey) {
  const limits = getLimits(user);
  return !!limits[featureKey];
}

export function tierLabel(tier) {
  return (
    {
      free: "Free",
      classroom: "Classroom",
    }[tier] || tier
  );
}

export function upgradeMessageFor(featureKey) {
  switch (featureKey) {
    case "liveSessionsEnabled":
    case "pandaTutorEnabled":
      return "Upgrade to Classroom to run live sessions and turn on the AI Panda Tutor.";
    default:
      return "Upgrade your plan to unlock this feature.";
  }
}
