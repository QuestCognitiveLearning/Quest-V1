// Re-exports the Supabase-backed custom client under the `quest` name so the
// rest of the codebase can keep using `quest.entities.X`, `quest.auth.me()`,
// and `quest.functions.invoke(...)` without changes.
export { customClient as quest } from "@/components/lib/custom-sdk.jsx";
