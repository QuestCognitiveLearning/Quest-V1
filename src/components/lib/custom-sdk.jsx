/**
 * @file   custom-sdk.jsx
 * @desc   The "quest" client. Wraps @supabase/supabase-js to expose an
 *         entity-style SDK (quest.entities.User.list(), quest.auth.me(), etc.)
 *         backed entirely by Supabase Postgres + Auth + Edge Functions. No
 *         external SaaS dependency — everything routes through your Supabase
 *         project.
 *
 *         TODO [SECURITY]: me() and isAuthenticated() read session tokens from
 *         localStorage to bypass a supabase-js internal auth-lock deadlock
 *         observed during token refresh. The security standard requires
 *         HttpOnly cookies. Migrate after re-validating the deadlock on the
 *         latest supabase-js.
 *
 *         TODO [perf]: bulkCreate has no conflict handling — a unique-key
 *         collision rejects the entire batch. JoinClass.jsx works around this
 *         by catching at the call site; better fix is upsert + ignore-conflict
 *         per row.
 *
 * @author Quest Learning core team
 */

import { supabase } from "./supabase-client.jsx";

// Map Quest PascalCase entity names → public schema table names.
// (Most are snake_case + s/es; a few are collective nouns — listed explicitly.)
const TABLE_NAME_OVERRIDES = {
  User: "users",
  Curriculum: "curricula",
  Unit: "units",
  Subunit: "subunits",
  Class: "classes",
  StudentEnrollment: "student_enrollments",
  StudentProgress: "student_progress",
  Video: "videos",
  Article: "articles",
  Quiz: "quizzes",
  Question: "questions",
  QuizResult: "quiz_results",
  QuestionResponse: "question_responses",
  LearningSession: "learning_sessions",
  InquirySession: "inquiry_sessions",
  InquiryResponse: "inquiry_responses",
  AttentionCheck: "attention_checks",
  AttentionCheckResponse: "attention_check_responses",
  Achievement: "achievements",
  CaseStudy: "case_studies",
  CaseStudyResponse: "case_study_responses",
  Assignment: "assignments",
  SessionFeedback: "session_feedback",
  LiveSession: "live_sessions",
  LiveSessionParticipant: "live_session_participants",
  LiveSessionResponse: "live_session_responses",
  VideoQuestionResponse: "video_question_responses",
  Notification: "notifications",
  UnitImage: "unit_images",
  Branding: "branding",
  Lead: "leads",
  ParentReport: "parent_reports",
  GeneratedHandout: "generated_handouts",
  // The newer "learning session" concept (generated handouts assigned to
  // classes) lives in lesson_bundles. It is exposed as LessonBundle here
  // so it doesn't shadow LearningSession above — that one is the original
  // student-progress table and remains the canonical entity for per-
  // student session tracking.
  LessonBundle: "lesson_bundles",
  LessonBundleItem: "lesson_bundle_items",
  LessonBundleAssignment: "lesson_bundle_assignments",
  StudentSessionItemProgress: "student_bundle_item_progress",
  StudentBundleCompletion: "student_bundle_completion",
  // Backwards-compat aliases — older imports still reference the previous
  // names. Keep these mapped to lesson_bundles so existing reads don't
  // regress while call sites migrate to the LessonBundle* names.
  LearningSessionItem: "lesson_bundle_items",
  LearningSessionAssignment: "lesson_bundle_assignments",
};

function tableFor(entityName) {
  return (
    TABLE_NAME_OVERRIDES[entityName] ||
    entityName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
  );
}

// Generic CRUD wrapper matching the Quest entity SDK shape.
export class CustomEntity {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async list(orderBy = "-created_date", limit = null) {
    let q = supabase.from(this.tableName).select("*");
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      q = q.order(desc ? orderBy.slice(1) : orderBy, { ascending: !desc });
    }
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) {
      if (error.code === "PGRST205") {
        console.warn(`Table ${this.tableName} missing — returning []`);
        return [];
      }
      throw error;
    }
    return data || [];
  }

  async filter(conditions = {}, orderBy = "-created_date", limit = null) {
    let q = supabase.from(this.tableName).select("*");
    for (const [k, v] of Object.entries(conditions)) {
      q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
    }
    if (orderBy) {
      const desc = orderBy.startsWith("-");
      q = q.order(desc ? orderBy.slice(1) : orderBy, { ascending: !desc });
    }
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) {
      if (error.code === "PGRST205") return [];
      console.error(`Filter error for ${this.tableName}:`, error);
      throw error;
    }
    return data || [];
  }

  async get(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (error.code === "PGRST205") return null;
      throw error;
    }
    return data;
  }

  async create(data) {
    const { data: row, error } = await supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async update(id, data) {
    const { data: row, error } = await supabase
      .from(this.tableName)
      .update(data)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return row;
  }

  async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async bulkCreate(rows) {
    if (!rows || rows.length === 0) return [];
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(rows)
      .select();
    if (error) throw error;
    return data || [];
  }

  // Stub for Quest's realtime subscription API. Returns an unsubscribe
  // function so existing teardown code (`unsubscribe()`) keeps working.
  // Wire to Supabase Realtime channels later if live updates are needed.
  subscribe(_handler) {
    return () => {};
  }
}

// The User entity also exposes auth.me / updateMe / logout / etc.
class UserEntity extends CustomEntity {
  constructor() {
    super("users");
  }

  async me() {
    // Read session straight from localStorage to avoid supabase-js's internal
    // auth lock, which can deadlock during a token refresh.
    const projectRef = (import.meta.env.VITE_SUPABASE_URL || "")
      .replace("https://", "")
      .split(".")[0];
    const stored = localStorage.getItem(`sb-${projectRef}-auth-token`);
    const session = stored ? JSON.parse(stored) : null;
    const authUser = session?.user;
    if (!authUser) {
      const err = new Error("Not authenticated");
      err.code = "NOT_AUTHENTICATED";
      throw err;
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const fetchOne = async (params, label) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(`${baseUrl}/rest/v1/users?${params}`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`,
            Accept: "application/json",
          },
          signal: ctrl.signal,
        });
        if (!res.ok) {
          throw new Error(`${label} HTTP ${res.status}: ${await res.text()}`);
        }
        const rows = await res.json();
        return rows[0] ?? null;
      } finally {
        clearTimeout(t);
      }
    };

    let row = await fetchOne(
      `auth_user_id=eq.${authUser.id}&limit=1`,
      "byAuthId",
    );
    if (!row) {
      row = await fetchOne(
        `email=eq.${encodeURIComponent(authUser.email)}&limit=1`,
        "byEmail",
      );
    }
    if (!row) {
      const err = new Error("User row not found");
      err.code = "USER_NOT_FOUND";
      throw err;
    }
    return row;
  }

  async updateMe(patch) {
    const me = await this.me();
    return this.update(me.id, patch);
  }

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    // Default to the landing page after sign-out. A `reload()` here would leave
    // the user on the current (now-protected) URL and RequireAuth would punt
    // them to /SignIn — we want them at the public landing instead.
    window.location.href = redirectUrl || '/';
  }

  redirectToLogin(nextUrl) {
    const target = nextUrl
      ? `/SignIn?next=${encodeURIComponent(nextUrl)}`
      : "/SignIn";
    window.location.href = target;
  }

  async isAuthenticated() {
    // Read straight from localStorage to avoid supabase-js's internal lock,
    // which can deadlock concurrent auth calls during a token refresh.
    const projectRef = (import.meta.env.VITE_SUPABASE_URL || "")
      .replace("https://", "")
      .split(".")[0];
    const stored = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!stored) return false;
    try {
      const session = JSON.parse(stored);
      return !!session?.access_token && !!session?.user;
    } catch {
      return false;
    }
  }
}

// Dynamic entity proxy so any quest.entities.X access works.
function entitiesProxy() {
  const cache = new Map();
  const userEntity = new UserEntity();
  cache.set("User", userEntity);
  return new Proxy(
    {},
    {
      get(_, name) {
        if (typeof name !== "string") return undefined;
        if (cache.has(name)) return cache.get(name);
        const entity = new CustomEntity(tableFor(name));
        cache.set(name, entity);
        return entity;
      },
    }
  );
}

// Function invoker — proxies through Supabase Edge Functions.
// Edge Functions for these names will be added in a later phase.
async function invokeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
  });
  if (error) throw error;
  return { data };
}

// Integrations (LLM / file uploads / email) — proxy to Edge Functions.
const integrations = {
  Core: {
    InvokeLLM: (args) => invokeFunction("invokeLLM", args).then((r) => r.data),
    UploadFile: async ({ file }) => {
      const path = `uploads/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("public-uploads")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("public-uploads")
        .getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
    GenerateImage: (args) =>
      invokeFunction("generateImage", args).then((r) => r.data),
    ExtractDataFromUploadedFile: (args) =>
      invokeFunction("extractDataFromUploadedFile", args).then((r) => r.data),
  },
};

export function createCustomClient() {
  const userEntity = new UserEntity();
  return {
    entities: entitiesProxy(),
    auth: {
      me: () => userEntity.me(),
      updateMe: (data) => userEntity.updateMe(data),
      logout: (redirectUrl) => userEntity.logout(redirectUrl),
      redirectToLogin: (nextUrl) => userEntity.redirectToLogin(nextUrl),
      isAuthenticated: () => userEntity.isAuthenticated(),
      signInWithGoogle: async (redirectTo) => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectTo || `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        return data;
      },
    },
    functions: {
      invoke: invokeFunction,
    },
    integrations,
    storage: supabase.storage,
  };
}

export const customClient = createCustomClient();
