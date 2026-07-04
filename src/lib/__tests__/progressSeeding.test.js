import { afterEach, describe, expect, it, vi } from "vitest";

// Warn-don't-block contract: whatever the seed_student_progress RPC does —
// error, reject, or hang — ensureProgressSeeded must resolve and never
// throw, so the student's class list always renders.
vi.mock("@/components/lib/supabase-client.jsx", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/components/lib/supabase-client.jsx";
import { ensureProgressSeeded, SEED_TIMEOUT_MS } from "@/lib/progressSeeding";

const CLASSES = [
  { id: "c1", curriculum_id: "curr1" },
  { id: "c2", curriculum_id: null }, // no curriculum → never called
];

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("ensureProgressSeeded (warn, don't block)", () => {
  it("resolves when the RPC returns an error payload, and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    supabase.rpc.mockResolvedValue({ error: { message: "permission denied" } });
    await expect(ensureProgressSeeded("s1", CLASSES)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(supabase.rpc).toHaveBeenCalledTimes(1); // only the curriculum class
    warn.mockRestore();
  });

  it("resolves when the RPC rejects outright (network failure)", async () => {
    supabase.rpc.mockRejectedValue(new Error("fetch failed"));
    await expect(ensureProgressSeeded("s1", CLASSES)).resolves.toBeUndefined();
  });

  it("gives up waiting after SEED_TIMEOUT_MS when the RPC hangs", async () => {
    vi.useFakeTimers();
    supabase.rpc.mockReturnValue(new Promise(() => {})); // never settles
    let settled = false;
    const p = ensureProgressSeeded("s1", CLASSES).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(SEED_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe(true);
  });

  it("skips the RPC entirely with no curriculum classes or no student", async () => {
    await ensureProgressSeeded("s1", [{ id: "c2", curriculum_id: null }]);
    await ensureProgressSeeded(null, CLASSES);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
