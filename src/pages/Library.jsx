/**
 * Library — standalone view of saved handouts. Same content + actions that
 * live inside Generate.jsx, but on its own page so the sidebar "Library"
 * item lands the user directly on the library rather than scrolling them
 * through the Generate input form.
 *
 * Reuses quest.entities.GeneratedHandout. Click "Open" → /Generate?handout=ID
 * which Generate already handles via the existing setStage('result') path
 * (Generate listens for the param). "Use in live session" + "Assign" + a
 * search bar are the only additional surface.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import TeacherLayout from "../components/teacher/TeacherLayout";
import { quest } from "@/api/questClient";
import {
  Library as LibraryIcon,
  Loader2,
  Search,
  PlayCircle,
  Send,
  Plus,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

export default function Library() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = async (teacherId) => {
    setLoading(true);
    try {
      const data = await quest.entities.GeneratedHandout?.filter?.(
        { teacher_id: teacherId },
        "-created_at",
        100,
      );
      setRows(data || []);
    } catch (err) {
      console.error("Library load failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await quest.auth.me();
        setUser(me);
        await load(me.id);
      } catch (err) {
        console.error("Library auth failed:", err);
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      [r.title, r.source_type]
        .map((s) => (s || "").toLowerCase())
        .some((s) => s.includes(q)),
    );
  }, [rows, query]);

  const onRunLive = (row) => {
    navigate(createPageUrl("LiveSessionBuilder") + `?fromHandout=${row.id}`);
  };

  const onDelete = async (rowId) => {
    if (!window.confirm("Delete this handout from your library?")) return;
    try {
      await quest.entities.GeneratedHandout.delete(rowId);
      setRows((r) => r.filter((x) => x.id !== rowId));
    } catch (err) {
      toast.error("Could not delete.");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    if (!window.confirm(`Delete ${n} handout${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map((id) => quest.entities.GeneratedHandout.delete(id)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = ids.filter((_, i) => results[i].status === "fulfilled");
      setRows((r) => r.filter((x) => !ok.includes(x.id)));
      clearSelection();
      setSelectMode(false);
      if (failed > 0) {
        toast.error(`${failed} delete${failed === 1 ? "" : "s"} failed.`);
      } else {
        toast.success(`Deleted ${ok.length} handout${ok.length === 1 ? "" : "s"}.`);
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <TeacherLayout user={user} onSignOut={() => quest.auth.logout()} activeNav="library">
      <div className="min-h-screen bg-slate-50" style={{ fontFamily: '"Inter", sans-serif' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

        <div className="max-w-5xl mx-auto px-6 py-8">
          <header className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Saved</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                <LibraryIcon className="w-7 h-7 text-[#2563EB]" />
                Library
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Every handout you've saved — open, run live, assign, or delete.
              </p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("Generate"))}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New handout
            </Button>
          </header>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or source"
                className="border-none focus-visible:ring-0 px-0 h-8 flex-1"
              />
              <span className="text-xs text-slate-400">
                {filtered.length} of {rows.length}
              </span>
              {rows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectMode) clearSelection();
                    setSelectMode((on) => !on);
                  }}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  {selectMode ? "Cancel" : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      Select
                    </>
                  )}
                </Button>
              )}
            </div>

            {selectMode && selectedIds.size > 0 && (
              <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {selectedIds.size} selected
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkDeleting}
                  onClick={bulkDelete}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  {bulkDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected
                </Button>
              </div>
            )}

            {loading ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <LibraryIcon className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm text-slate-500 mt-3">
                  {rows.length === 0
                    ? "Nothing saved yet. Generate a handout and hit Save to library."
                    : "No handouts match your search."}
                </p>
                {rows.length === 0 && (
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => navigate(createPageUrl("Generate"))}
                  >
                    <Plus className="w-4 h-4" />
                    Generate one
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 p-5">
                {filtered.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <div
                      key={row.id}
                      onClick={selectMode ? () => toggleSelect(row.id) : undefined}
                      className={`bg-white border rounded-xl p-4 flex flex-col gap-2 transition-colors ${
                        selectMode
                          ? `cursor-pointer ${
                              isSelected
                                ? "border-[#2563EB] ring-2 ring-[#2563EB]/30 bg-blue-50/40"
                                : "border-slate-200 hover:border-slate-300"
                            }`
                          : "border-slate-200 hover:border-[#2563EB]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {selectMode && (
                            isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#2563EB] mt-0.5 flex-shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
                            )
                          )}
                          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                            {row.title || "Untitled handout"}
                          </h3>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 shrink-0">
                          {row.source_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {(row.payload?.quiz?.length || 0)} questions
                        {row.payload?.case_study?.scenario ? " · 1 case study" : ""}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Saved {new Date(row.created_at).toLocaleDateString()}
                      </p>
                      {!selectMode && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => onRunLive(row)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Use live
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`${createPageUrl("Generate")}?handout=${row.id}`)
                            }
                            className="h-8 px-3 text-xs"
                          >
                            Open
                          </Button>
                          <button
                            type="button"
                            onClick={() => onDelete(row.id)}
                            className="ml-auto text-xs text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
