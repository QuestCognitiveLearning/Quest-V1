/**
 * @file tier.js
 * @desc Single source of truth for tier capability checks. The legacy
 *       `subscription_tier` column ('free' | 'premium') is kept for
 *       backwards compatibility; the new `tier` column ('free' | 'classroom'
 *       | 'studio' | 'enterprise') is the authoritative one going forward.
 *
 *       Helpers here accept a user object and return booleans so feature
 *       gates stay declarative at call sites (no enum branching scattered).
 */

export const TIERS = ["free", "classroom", "studio", "enterprise"];

const INF = Number.POSITIVE_INFINITY;

export const TIER_LIMITS = {
  free: {
    maxClasses: 1,
    maxStudents: 30,
    aiGenerationsPerMonth: 10,
    liveSessionsEnabled: false,
    pandaTutorEnabled: false,
    brandingEnabled: false,
    parentReportsEnabled: false,
    enterpriseFeatures: false,
  },
  classroom: {
    maxClasses: INF,
    maxStudents: INF,
    aiGenerationsPerMonth: INF,
    liveSessionsEnabled: true,
    pandaTutorEnabled: true,
    brandingEnabled: false,
    parentReportsEnabled: false,
    enterpriseFeatures: false,
  },
  studio: {
    maxClasses: INF,
    maxStudents: INF,
    aiGenerationsPerMonth: INF,
    liveSessionsEnabled: true,
    pandaTutorEnabled: true,
    brandingEnabled: true,
    parentReportsEnabled: true,
    enterpriseFeatures: false,
  },
  enterprise: {
    maxClasses: INF,
    maxStudents: INF,
    aiGenerationsPerMonth: INF,
    liveSessionsEnabled: true,
    pandaTutorEnabled: true,
    brandingEnabled: true,
    parentReportsEnabled: true,
    enterpriseFeatures: true,
  },
};

// Reads the effective tier from a user record. Prefers the new `tier` column;
// falls back to the legacy `subscription_tier` mapping for users whose row
// has not yet been touched by Phase 3's webhook update.
//
// Tutor-fallback: a user tagged as a tutor (new_role='tutor') with a paid
// subscription (subscription_tier='premium', including 'trial' status) is
// treated as Studio tier even if the new `tier` column hasn't been written
// yet. Without this, the syncStripeSubscription path — which historically
// only set the legacy `subscription_tier` — leaves Studio buyers locked
// out of Branding / Parent Reports / Booking pages until a separate sync
// happens to write `tier='studio'`. The pages themselves still enforce
// the real DB tier server-side via Edge Function checks, so this only
// affects client-side UI gating.
export function getUserTier(user) {
  if (!user) return "free";
  if (user.tier && TIER_LIMITS[user.tier]) return user.tier;
  if (user.subscription_tier === "premium") {
    if (user.new_role === "tutor") return "studio";
    return "classroom";
  }
  return "free";
}

export function getUserRole(user) {
  if (!user) return "teacher";
  return user.new_role || (user.role === "admin" ? "admin" : "teacher");
}

export function getLimits(user) {
  return TIER_LIMITS[getUserTier(user)] || TIER_LIMITS.free;
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
      studio: "Studio",
      enterprise: "Enterprise",
    }[tier] || tier
  );
}

export function upgradeMessageFor(featureKey) {
  switch (featureKey) {
    case "brandingEnabled":
    case "parentReportsEnabled":
      return "Upgrade to Studio for branded packets and automated parent progress reports.";
    case "liveSessionsEnabled":
    case "pandaTutorEnabled":
      return "Upgrade to Classroom to run live sessions and turn on the AI Panda Tutor.";
    default:
      return "Upgrade your plan to unlock this feature.";
  }
}
