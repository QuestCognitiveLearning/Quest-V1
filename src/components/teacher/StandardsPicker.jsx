import React, { useState, useEffect, useMemo } from "react";
import { quest } from "@/api/questClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, BookOpen, GraduationCap, MapPin,
  Search, Sparkles, ChevronRight, ArrowRight, Check, Circle, Globe
} from "lucide-react";
import { LLM_MODELS } from "@/lib/llmModels";

// US states — used to filter the CSP jurisdiction list when in "By State" mode.
const US_STATES = new Set(["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"]);

// Curated national / program-level standards. IDs come directly from the
// Common Standards Project API (verified 2026-05-13). Order = recommended.
const NATIONAL_PROGRAM_IDS = new Map([
  ['0A5FD99233A74D8FA3A74F52E5F6CDEC', { displayTitle: 'AP / College Board',                  tag: 'AP'         }],
  ['71E5AA409D894EB0B43A8CD82F727BFE', { displayTitle: 'Next Generation Science Standards',   tag: 'NGSS'       }],
  ['67810E9EF6944F9383DCC602A3484C23', { displayTitle: 'Common Core State Standards',         tag: 'Common Core'}],
  ['6C108E8EC1944844B15FEFE71337CFB6', { displayTitle: 'International Baccalaureate',         tag: 'IB'         }],
  ['823708C7149D46A0BDC265B88F1AD4C9', { displayTitle: 'National Council of Teachers of Math',tag: 'NCTM'       }],
  ['B93E61C2A9784FB5B8E7D086E78913B9', { displayTitle: 'National Geography Education',        tag: 'Geography'  }],
  ['4F7824964E604BBB8210E4E1EF10A2EF', { displayTitle: 'National Core Arts Standards',        tag: 'Arts'       }],
  ['A66ADAD3FB044D2F9B81C67CE1C6E7C3', { displayTitle: 'National Health Education Standards', tag: 'Health'     }],
]);

// ─── Phase 1: Select source/subject/grade ──────────────────────────────────
function SelectionPanel({
  jurisdictions, selectedJurisdiction, onSelectJurisdiction, loadingJurisdiction,
  standardSets, selectedSubject, onSelectSubject, selectedGrade, onSelectGrade,
  onFetchRaw, fetchingRaw
}) {
  // Which kind of source is the teacher choosing? Tab persists locally — the
  // parent only sees the resulting jurisdiction selection.
  const [sourceTab, setSourceTab] = useState('state'); // 'state' | 'program'
  const [jurisdictionSearch, setJurisdictionSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");

  // States tab: filter the full jurisdiction list down to the 50 US states.
  const stateList = useMemo(() => {
    const filtered = jurisdictions.filter(j => US_STATES.has(j.title));
    const list = filtered.length > 0 ? filtered : jurisdictions;
    return jurisdictionSearch.trim()
      ? list.filter(j => j.title.toLowerCase().includes(jurisdictionSearch.toLowerCase()))
      : list;
  }, [jurisdictions, jurisdictionSearch]);

  // Programs tab: filter to the curated national-program allowlist, preserving
  // the order of NATIONAL_PROGRAM_IDS. Override the title with the friendlier
  // displayTitle so the picker isn't dominated by acronyms.
  const programList = useMemo(() => {
    const byId = new Map(jurisdictions.map(j => [j.id, j]));
    const ordered = [...NATIONAL_PROGRAM_IDS.entries()]
      .map(([id, meta]) => {
        const found = byId.get(id);
        if (!found) return null;
        return { ...found, title: meta.displayTitle, _tag: meta.tag };
      })
      .filter(Boolean);
    return jurisdictionSearch.trim()
      ? ordered.filter(j => j.title.toLowerCase().includes(jurisdictionSearch.toLowerCase()))
      : ordered;
  }, [jurisdictions, jurisdictionSearch]);

  // Detect whether the currently-selected jurisdiction is a program (changes
  // Step 3 label from "Grade Level" → "Course").
  const isProgramSource = selectedJurisdiction
    ? NATIONAL_PROGRAM_IDS.has(selectedJurisdiction.id)
    : sourceTab === 'program';

  const subjects = useMemo(() => {
    const seen = new Set();
    return standardSets.map(s => s.subject).filter(s => s && !seen.has(s) && seen.add(s)).sort();
  }, [standardSets]);

  const filteredSubjects = useMemo(() =>
    subjectSearch.trim() ? subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase())) : subjects,
    [subjects, subjectSearch]
  );

  const grades = useMemo(() => {
    const seen = new Set();
    return standardSets.filter(s => s.subject === selectedSubject).map(s => s.title).filter(t => t && !seen.has(t) && seen.add(t)).sort();
  }, [standardSets, selectedSubject]);

  const matchedSet = useMemo(() =>
    standardSets.find(s => s.subject === selectedSubject && s.title === selectedGrade),
    [standardSets, selectedSubject, selectedGrade]
  );

  // Tab switch resets the in-Step-1 search but NOT the parent's selection —
  // a teacher who picked Tennessee from the State tab keeps that selection
  // visible until they explicitly pick something new (from either tab).
  const handleTabChange = (next) => {
    setSourceTab(next);
    setJurisdictionSearch("");
  };

  const sourceList = sourceTab === 'program' ? programList : stateList;
  const stepOneTitle = sourceTab === 'program' ? 'Program' : 'State';
  const searchPlaceholder = sourceTab === 'program' ? 'Search programs...' : 'Search states...';

  return (
    <div className="space-y-5">
      {/* Source — State or National Program */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-fuchsia-50">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            {sourceTab === 'program'
              ? <Globe className="w-3.5 h-3.5 text-white" />
              : <MapPin className="w-3.5 h-3.5 text-white" />}
          </div>
          <h3 className="text-sm font-bold text-gray-800">
            Step 1 — {stepOneTitle}
            {selectedJurisdiction && <span className="ml-2 text-purple-600 font-medium">· {selectedJurisdiction.title}</span>}
          </h3>
        </div>

        {/* Tab switch */}
        <div className="px-4 pt-3">
          <div role="tablist" aria-label="Source type" className="inline-flex p-0.5 bg-gray-100 rounded-lg">
            <button
              role="tab"
              aria-selected={sourceTab === 'state'}
              onClick={() => handleTabChange('state')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                sourceTab === 'state'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin className="w-3 h-3 inline -mt-px mr-1" /> By State
            </button>
            <button
              role="tab"
              aria-selected={sourceTab === 'program'}
              onClick={() => handleTabChange('program')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                sourceTab === 'program'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="w-3 h-3 inline -mt-px mr-1" /> By National Program
            </button>
          </div>
        </div>

        <div className="p-4 pt-3">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={jurisdictionSearch} onChange={e => setJurisdictionSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-8 h-8 text-xs border-gray-200" />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {sourceList.length === 0 && (
              <p className="text-xs text-gray-400 py-2">No matches.</p>
            )}
            {sourceList.map(j => (
              <button key={j.id} onClick={() => onSelectJurisdiction(j)}
                className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all whitespace-nowrap ${
                  selectedJurisdiction?.id === j.id ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600"
                }`}>
                {j.title}
              </button>
            ))}
          </div>
          {sourceTab === 'program' && (
            <p className="mt-3 text-xs text-gray-400">
              National frameworks like AP, NGSS, Common Core, and IB. Pick the program your curriculum is aligned to.
            </p>
          )}
        </div>
      </div>

      {loadingJurisdiction && (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-xs py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          Loading standards for {selectedJurisdiction?.title}...
        </div>
      )}

      {/* Subject */}
      {!loadingJurisdiction && subjects.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-sky-50">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">
              Step 2 — Subject
              {selectedSubject && <span className="ml-2 text-blue-600 font-medium">· {selectedSubject}</span>}
            </h3>
          </div>
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} placeholder="Search subjects..." className="pl-8 h-8 text-xs border-gray-200" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filteredSubjects.map(s => (
                <button key={s} onClick={() => { onSelectSubject(s); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                    selectedSubject === s ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grade */}
      {selectedSubject && grades.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">
              Step 3 — {isProgramSource ? 'Course' : 'Grade Level'}
              {selectedGrade && <span className="ml-2 text-indigo-600 font-medium">· {selectedGrade}</span>}
            </h3>
          </div>
          <div className="p-4 flex flex-wrap gap-1.5">
            {grades.map(g => (
              <button key={g} onClick={() => onSelectGrade(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                  selectedGrade === g ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedSet && (
        <Button onClick={onFetchRaw} disabled={fetchingRaw}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-5 text-sm font-semibold rounded-xl shadow-lg">
          {fetchingRaw
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading Standards...</>
            : <><ArrowRight className="w-4 h-4 mr-2" /> View Standards</>}
        </Button>
      )}
    </div>
  );
}

// ─── Phase 2: Show raw standards + AI translation side-by-side ─────────────
function StandardsReviewPanel({ rawStandards, subjectName, onConfirm, onBack }) {
  const [translating, setTranslating] = useState(false);
  const [translatedUnits, setTranslatedUnits] = useState(null);
  const [translationError, setTranslationError] = useState("");
  const [coveredRawIds, setCoveredRawIds] = useState(new Set());
  // Chunked-translation progress + live ETA (so a big standard set never times
  // out and the teacher sees time-left, like curriculum generation).
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [startedAt, setStartedAt] = useState(null);
  const [etaAnchor, setEtaAnchor] = useState(null); // { rate, anchorAt, remaining }
  const [, setEtaTick] = useState(0);
  // revealedCount = how many subunits (in flat order across all units) have
  // been "stepped in" so far. Drives both the right-side card reveal and the
  // left-side checkmark sweep — they share this counter so they stay in sync.
  const [revealedCount, setRevealedCount] = useState(0);
  const totalSubunits = (translatedUnits || []).reduce(
    (sum, u) => sum + (u.subunits?.length || 0),
    0,
  );
  const reveallComplete = totalSubunits > 0 && revealedCount >= totalSubunits;

  useEffect(() => {
    runTranslation();
  }, []);

  // 1s ticker so the ETA recomputes while translating.
  useEffect(() => {
    if (!translating) return;
    const id = setInterval(() => setEtaTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [translating]);

  // Live "time left" while chunks process — throughput from completed chunks.
  // Anchored countdown: re-anchored at each completion (smoothed rate × steps
  // left), then it just subtracts elapsed-since-anchor — so it only ticks DOWN
  // between completions instead of climbing then snapping back.
  const estimateRemaining = () => {
    if (!etaAnchor) return progress.current === 0 ? "Estimating time…" : "";
    if (etaAnchor.remaining <= 0) return "finishing up…";
    const projMs = etaAnchor.remaining * etaAnchor.rate - (Date.now() - etaAnchor.anchorAt);
    const secs = Math.max(3, Math.round(projMs / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `~${m} min ${s} sec left` : `~${s} sec left`;
  };

  // Phase 1: pull CLUMPED subunits out of a chunk of standards. Small prompt +
  // small output → never times out. Standards are clumped (many per subunit),
  // not one-per-standard. Retries transient failures.
  const extractSubunits = async (standards, attempt = 0) => {
    try {
      const res = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.STANDARDS_PICKER,
        prompt: `You are an expert curriculum designer for "${subjectName}". Group these standards into a SHORT list of CLUMPED subunits.

Standards are usually clumped — each subunit is ONE focused 10–15 minute video that covers MULTIPLE related standards. Aggressively merge related standards into the same subunit; do NOT create one subunit per standard. Give each subunit a short, specific name (4–8 words). List the IDs of EVERY standard each subunit covers; every standard must be covered exactly once.

Return JSON only: { "subunits": [ { "name": "Short Subunit Name", "covered_ids": ["id1","id2","id3"] } ] }

Standards:
${JSON.stringify(standards.map((s) => ({ id: s.id, description: s.description || s.statementNotation || s.listId || "(no description)" })))}`,
        response_json_schema: {
          type: "object",
          properties: {
            subunits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  covered_ids: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      });
      return res.subunits || [];
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        return extractSubunits(standards, attempt + 1);
      }
      throw e;
    }
  };

  // Phase 2: organize all extracted subunits into a clean curriculum — AT MOST
  // 12 units, AT MOST 7 subunits each — merging near-duplicates. Input is just
  // names (by index) so it stays small and fast.
  const organizeUnits = async (subNames, attempt = 0) => {
    try {
      const res = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.STANDARDS_PICKER,
        prompt: `You are organizing subunits into a clean curriculum for "${subjectName}".

HARD LIMITS you MUST obey: AT MOST 12 units total, AT MOST 7 subunits per unit, and AT LEAST 3 subunits per unit. Never create a unit with only 1 or 2 subunits — fold tiny groups into a related unit so every unit has real substance.

Units are BROAD, GENERAL themes (big buckets like "Cells", "Genetics", "Ecology", "Forces & Motion") — NOT narrow topics. Within each unit, the subunits are the SPECIFIC concepts that belong to that theme. Merge subunits that cover essentially the same concept into ONE final subunit.

Every input subunit index must be placed in exactly ONE final subunit — never drop or skip any index. A final subunit may merge several input indices.

Subunits (index: name):
${subNames.map((s) => `${s.i}: ${s.name}`).join("\n")}

Return JSON only: { "units": [ { "unit_name": "Specific Unit Name", "subunits": [ { "name": "Short Subunit Name", "members": [0, 3, 5] } ] } ] }`,
        response_json_schema: {
          type: "object",
          properties: {
            units: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  unit_name: { type: "string" },
                  subunits: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        members: { type: "array", items: { type: "number" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return res.units || [];
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        return organizeUnits(subNames, attempt + 1);
      }
      throw e;
    }
  };

  const runTranslation = async () => {
    setTranslating(true);
    setTranslatedUnits(null);
    setTranslationError("");
    setCoveredRawIds(new Set());

    // Phase 1 in small chunks (no single call can time out), then one phase-2
    // organize pass. Progress = chunks + the final organize step.
    const CHUNK = 25;
    const CONCURRENCY = 3;
    const chunks = [];
    for (let i = 0; i < rawStandards.length; i += CHUNK) chunks.push(rawStandards.slice(i, i + CHUNK));
    if (chunks.length === 0) { setTranslatedUnits([]); setTranslating(false); return; }

    const totalSteps = chunks.length + 1; // +1 = the final organize pass
    const start = Date.now();
    setProgress({ current: 0, total: totalSteps });
    setStartedAt(start);
    setEtaAnchor(null);

    const results = new Array(chunks.length).fill(null);
    const queue = chunks.map((c, i) => ({ c, i }));
    let done = 0;
    let firstError = null;
    let smoothRate = 0; // ms per step, EMA-smoothed so the ETA doesn't lurch
    const worker = async () => {
      while (queue.length) {
        const { c, i } = queue.shift();
        try {
          const subs = await extractSubunits(c);
          // Reconcile: keep only this chunk's real IDs, then sweep up any
          // standard the model forgot so the chunk is always fully covered.
          const chunkIds = new Set(c.map((s) => s.id));
          subs.forEach((su) => { su.covered_ids = [...new Set((su.covered_ids || []).filter((id) => chunkIds.has(id)))]; });
          const covered = new Set(subs.flatMap((su) => su.covered_ids));
          const missing = c.filter((s) => !covered.has(s.id)).map((s) => s.id);
          if (missing.length) {
            if (subs.length) subs[subs.length - 1].covered_ids.push(...missing);
            else subs.push({ name: "Additional standards", covered_ids: missing });
          }
          results[i] = subs;
        } catch (e) { if (!firstError) firstError = e; }
        done += 1;
        setProgress({ current: done, total: totalSteps });
        // Re-anchor the countdown from real throughput (smoothed).
        const inst = (Date.now() - start) / done;
        smoothRate = smoothRate ? 0.6 * smoothRate + 0.4 * inst : inst;
        setEtaAnchor({ rate: smoothRate, anchorAt: Date.now(), remaining: Math.max(0, totalSteps - done) });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));
      const rawSubs = results.flat().filter(Boolean); // [{ name, covered_ids }]
      if (rawSubs.length === 0) throw firstError || new Error("No standards could be processed.");

      // Phase 2: organize into <=12 units / <=7 subunits, merging duplicates.
      const organized = await organizeUnits(rawSubs.map((s, i) => ({ i, name: s.name })));
      setProgress((p) => ({ current: p.total, total: p.total }));

      const used = new Set();
      const units = (organized || []).map((u) => ({
        unit_name: u.unit_name,
        subunits: (u.subunits || []).map((fs) => {
          (fs.members || []).forEach((m) => { if (rawSubs[m]) used.add(m); });
          return {
            name: fs.name,
            // Union the source subunits' standard IDs so coverage is preserved.
            covered_ids: [...new Set((fs.members || []).flatMap((m) => rawSubs[m]?.covered_ids || []))],
          };
        }),
      }));

      // Coverage guarantee: any subunit the organizer didn't place lands in an
      // "Additional Concepts" unit — so every standard is ALWAYS covered.
      const unused = rawSubs.map((_, i) => i).filter((i) => !used.has(i));
      if (unused.length) {
        units.push({
          unit_name: "Additional Concepts",
          subunits: unused.map((i) => ({ name: rawSubs[i].name, covered_ids: rawSubs[i].covered_ids || [] })),
        });
      }

      // Total-failure fallback: if the organizer returned nothing usable, group
      // the extracted subunits into units of 7 so the result is still valid.
      if (units.length === 0 || units.every((u) => (u.subunits || []).length === 0)) {
        units.length = 0;
        for (let i = 0; i < rawSubs.length; i += 7) {
          units.push({
            unit_name: `Unit ${units.length + 1}`,
            subunits: rawSubs.slice(i, i + 7).map((s) => ({ name: s.name, covered_ids: s.covered_ids || [] })),
          });
        }
      }

      // Every unit needs substance — merge any unit with < 3 subunits into a
      // neighbor (preferring one that stays within 7) until none are too small
      // (or only one unit remains). Coverage is unchanged — subunits just move.
      let changed = true;
      while (changed && units.length > 1) {
        changed = false;
        for (let i = 0; i < units.length; i++) {
          if ((units[i].subunits || []).length >= 3) continue;
          const small = units[i];
          const neighbors = [i - 1, i + 1].filter((j) => j >= 0 && j < units.length);
          let target = neighbors.find((j) => units[j].subunits.length + small.subunits.length <= 7);
          if (target === undefined) target = neighbors[0];
          if (target == null) break;
          units[target].subunits.push(...small.subunits);
          units.splice(i, 1);
          changed = true;
          break;
        }
      }

      setTranslatedUnits(units);
      setRevealedCount(0);
      setCoveredRawIds(new Set());

      const flat = [];
      units.forEach((u, ui) => (u.subunits || []).forEach((s, si) => flat.push({ unitIdx: ui, subIdx: si, ids: s.covered_ids || [] })));
      const REVEAL_MS = 120;
      flat.forEach((step, i) => {
        setTimeout(() => {
          setRevealedCount((c) => Math.max(c, i + 1));
          setCoveredRawIds((prev) => { const next = new Set(prev); step.ids.forEach((id) => next.add(id)); return next; });
        }, (i + 1) * REVEAL_MS);
      });
    } catch (e) {
      let msg = e?.message || (typeof e === 'string' ? e : '');
      try {
        const resp = e?.context?.response || e?.context;
        if (resp && typeof resp.text === 'function') {
          const body = await resp.text();
          if (body) {
            try { const parsed = JSON.parse(body); msg = `${parsed.error || parsed.message || body} (HTTP ${resp.status || '?'})`; }
            catch { msg = `${body} (HTTP ${resp.status || '?'})`; }
          }
        }
      } catch { /* keep whatever we already had */ }
      console.error('[StandardsPicker] translation failed:', e, '→', msg);
      setTranslationError(msg || 'Unknown error');
      setTranslatedUnits([]);
    } finally {
      setTranslating(false);
    }
  };

  const handleConfirm = () => {
    if (!translatedUnits) return;
    const units = translatedUnits.map(u => ({
      unit_name: u.unit_name,
      subunits: (u.subunits || []).map(s => s.name).filter(Boolean)
    }));
    onConfirm({ units, subjectName });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          ← Back to selection
        </button>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-orange-400" /> Raw Standards
          <div className="w-2 h-2 rounded-full bg-green-500 ml-2" /> AI Curriculum
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 h-[520px]">
        {/* LEFT: Raw Standards */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 shrink-0">
            <BookOpen className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Raw Standards</span>
            <span className="ml-auto text-xs text-gray-400">{rawStandards.length} standards</span>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
            {rawStandards.map(s => {
              const covered = coveredRawIds.has(s.id);
              return (
                <div key={s.id}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-500 ${
                    covered ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-100"
                  }`}
                  style={{ marginLeft: `${s.depth * 12}px` }}>
                  <div className={`shrink-0 mt-0.5 transition-all duration-300 ${covered ? "text-green-500" : "text-gray-300"}`}>
                    {covered ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  </div>
                  <p className={`leading-relaxed transition-colors duration-300 ${covered ? "text-green-800" : "text-gray-600"}`}>
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: AI Translated Curriculum */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">AI Curriculum</span>
            {(translating || (translatedUnits && !reveallComplete)) && (
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400 ml-auto" />
            )}
            {!translating && translatedUnits && reveallComplete && (
              <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1 p-3">
            {translating && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 px-6">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-xs text-center">AI is organizing your standards<br />into a clean curriculum...</p>
                {progress.total > 0 && (
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-center text-gray-500 mt-2">{estimateRemaining()}</p>
                  </div>
                )}
              </div>
            )}
            {!translating && translatedUnits && (
              <div className="space-y-3">
                {(() => {
                  // Walk units in order and figure out how many subunits of
                  // each have entered via the staged reveal. `cursor` tracks
                  // our position in the flat ordering used by revealedCount.
                  let cursor = 0;
                  return translatedUnits.map((unit, ui) => {
                    const subs = unit.subunits || [];
                    const start = cursor;
                    cursor += subs.length;
                    // How many of THIS unit's subunits are currently visible.
                    const visible = Math.max(0, Math.min(subs.length, revealedCount - start));
                    // Don't render the unit card at all until its first
                    // subunit has been stepped in.
                    if (visible === 0) return null;
                    return (
                      <div
                        key={ui}
                        className="border border-indigo-100 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300"
                      >
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-2 flex items-center gap-2">
                          <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center text-white text-xs font-bold">{ui + 1}</div>
                          <span className="text-white text-xs font-semibold">{unit.unit_name}</span>
                        </div>
                        <div className="p-2 space-y-1">
                          {subs.slice(0, visible).map((sub, si) => (
                            <div
                              key={si}
                              className="flex items-center gap-2 px-2 py-1.5 bg-indigo-50 rounded-lg animate-in fade-in slide-in-from-bottom-1 duration-300"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="text-xs text-indigo-800 font-medium">{sub.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
            {!translating && translatedUnits?.length === 0 && (
              <div className="text-center py-10 px-4 space-y-3">
                <p className="text-xs text-gray-500">Could not translate standards.</p>
                {translationError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-left">
                    {translationError}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runTranslation}
                  className="text-xs"
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coverage summary */}
      {!translating && translatedUnits && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-800">
              {coveredRawIds.size} of {rawStandards.length} standards covered
            </span>
          </div>
          <Button onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 h-8 rounded-lg font-semibold">
            Use This Curriculum <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function StandardsPicker({ onStandardsSelected }) {
  const [phase, setPhase] = useState("select"); // "select" | "review"

  const [loadingJurisdictions, setLoadingJurisdictions] = useState(true);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [loadingJurisdiction, setLoadingJurisdiction] = useState(false);
  const [standardSets, setStandardSets] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [fetchingRaw, setFetchingRaw] = useState(false);
  const [rawStandards, setRawStandards] = useState([]);
  const [rawSubjectName, setRawSubjectName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadJurisdictions(); }, []);

  const loadJurisdictions = async () => {
    setLoadingJurisdictions(true);
    try {
      const res = await quest.functions.invoke('fetchStandards', { action: 'list' });
      setJurisdictions(res.data.jurisdictions || []);
    } catch (e) {
      setError("Failed to load jurisdictions.");
    } finally {
      setLoadingJurisdictions(false);
    }
  };

  const handleSelectJurisdiction = async (jurisdiction) => {
    if (selectedJurisdiction?.id === jurisdiction.id) return;
    setSelectedJurisdiction(jurisdiction);
    setSelectedSubject("");
    setSelectedGrade("");
    setStandardSets([]);
    setLoadingJurisdiction(true);
    try {
      const res = await quest.functions.invoke('fetchStandards', { action: 'getJurisdiction', jurisdictionId: jurisdiction.id });
      setStandardSets(res.data.jurisdiction?.standardSets || []);
    } catch (e) {
      setError("Failed to load standards.");
    } finally {
      setLoadingJurisdiction(false);
    }
  };

  const matchedSet = useMemo(() =>
    standardSets.find(s => s.subject === selectedSubject && s.title === selectedGrade),
    [standardSets, selectedSubject, selectedGrade]
  );

  const handleFetchRaw = async () => {
    if (!matchedSet) return;
    setFetchingRaw(true);
    try {
      const res = await quest.functions.invoke('fetchStandards', { action: 'fetch', standardSetId: matchedSet.id });
      const standardSet = res.data.standardSet;
      const standardsList = Object.values(standardSet.standards || {}).sort((a, b) => a.position - b.position);
      setRawStandards(standardsList.filter(s => s.description || s.listId || s.statementNotation));
      setRawSubjectName(standardSet.title || selectedSubject);
      setPhase("review");
    } catch (e) {
      setError("Failed to fetch standards.");
    } finally {
      setFetchingRaw(false);
    }
  };

  const handleConfirm = ({ units, subjectName }) => {
    onStandardsSelected({ subjectName, units });
  };

  if (loadingJurisdictions) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-400 text-sm">Loading standards database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <Button variant="outline" onClick={() => { setError(""); loadJurisdictions(); }}>Retry</Button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <StandardsReviewPanel
        rawStandards={rawStandards}
        subjectName={rawSubjectName}
        onConfirm={handleConfirm}
        onBack={() => setPhase("select")}
      />
    );
  }

  return (
    <SelectionPanel
      jurisdictions={jurisdictions}
      selectedJurisdiction={selectedJurisdiction}
      onSelectJurisdiction={handleSelectJurisdiction}
      loadingJurisdiction={loadingJurisdiction}
      standardSets={standardSets}
      selectedSubject={selectedSubject}
      onSelectSubject={(s) => { setSelectedSubject(s); setSelectedGrade(""); }}
      selectedGrade={selectedGrade}
      onSelectGrade={setSelectedGrade}
      onFetchRaw={handleFetchRaw}
      fetchingRaw={fetchingRaw}
    />
  );
}