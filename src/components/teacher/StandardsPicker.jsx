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

  const runTranslation = async () => {
    setTranslating(true);
    setTranslatedUnits(null);
    setTranslationError("");
    setCoveredRawIds(new Set());
    try {
      const res = await quest.integrations.Core.InvokeLLM({
        model: LLM_MODELS.STANDARDS_PICKER,
        prompt: `You are an expert curriculum designer. Convert these raw educational standards for "${subjectName}" into a well-organized, comprehensive curriculum.

Rules:
1. Create a reasonable number of units based on the content — not too few, not too many. Each unit should cover a distinct conceptual area. Let the standards naturally dictate how many units there are.
2. Each unit should have a balanced number of subunits. Do NOT make units too broad or pack too many subunits into one.
3. Convert each standard into a SHORT, punchy subunit name (4-8 words max). Be specific, not generic. Example: "Analyze characteristics of life and engage in argument about the designation of viruses as non-living" → "Viruses as Non-Living Organisms"
4. CONSOLIDATE related standards into a single subunit whenever they cover the same teachable concept. A subunit should be the size of one focused 10–15 minute video — large enough that a single YouTube lesson can plausibly cover it, small enough to remain specific. Each subunit becomes one video, so avoid creating many tiny subunits about minor variations of the same idea. When in doubt, merge.
   - DO merge: "Identify the structure of DNA" + "Describe the function of DNA" + "Explain DNA replication basics" → ONE subunit "DNA Structure, Function & Replication".
   - DO merge: "Analyze the cell membrane" + "Describe membrane transport" → ONE subunit "Cell Membrane & Transport".
   - DO NOT merge across genuinely different concepts (e.g., do not merge "Mitosis" with "Genetic Inheritance" — those are separate teachable units).
5. For each subunit, list the IDs of EVERY raw standard it covers in "covered_ids". A merged subunit will have multiple ids; that is expected and good.
6. Unit names should be clear and specific (e.g. "Cell Structure & Function" not just "Cells").
7. CRITICAL: Every single raw standard must be covered by at least one subunit — do not skip or omit any. Merging is fine and encouraged; dropping is not.

Return JSON only:
{
  "units": [
    {
      "unit_name": "Specific Unit Name",
      "subunits": [
        { "name": "Short Subunit Name", "covered_ids": ["rawStandardId1", "rawStandardId2"] }
      ]
    }
  ]
}

Raw standards:
${JSON.stringify(rawStandards.map(s => ({ id: s.id, description: s.description || s.statementNotation || s.listId || "(no description)", depth: s.depth })), null, 2)}`,
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
                        covered_ids: { type: "array", items: { type: "string" } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const units = res.units || [];
      setTranslatedUnits(units);
      setRevealedCount(0);
      setCoveredRawIds(new Set());

      // Animate subunits onto the right-side panel one at a time, and check
      // off their corresponding raw standards on the left in lockstep. Same
      // counter (revealedCount) drives both — they can never get out of sync.
      const flat = [];
      units.forEach((u, ui) => {
        (u.subunits || []).forEach((s, si) => {
          flat.push({ unitIdx: ui, subIdx: si, ids: s.covered_ids || [] });
        });
      });

      // ~220ms per step feels intentional without dragging. For a typical
      // 25-subunit curriculum the whole sweep takes ~5.5s.
      const REVEAL_MS = 220;
      flat.forEach((step, i) => {
        setTimeout(() => {
          setRevealedCount((c) => Math.max(c, i + 1));
          setCoveredRawIds((prev) => {
            const next = new Set(prev);
            step.ids.forEach((id) => next.add(id));
            return next;
          });
        }, (i + 1) * REVEAL_MS);
      });
    } catch (e) {
      // Supabase functions.invoke wraps non-2xx as FunctionsHttpError with a
      // generic message; the real cause is in e.context.response. Try to read
      // that body so the user (and any future debugger) sees the actual error.
      let msg = e?.message || (typeof e === 'string' ? e : '');
      try {
        const resp = e?.context?.response || e?.context;
        if (resp && typeof resp.text === 'function') {
          const body = await resp.text();
          if (body) {
            try {
              const parsed = JSON.parse(body);
              msg = `${parsed.error || parsed.message || body} (HTTP ${resp.status || '?'})`;
            } catch {
              msg = `${body} (HTTP ${resp.status || '?'})`;
            }
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
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-xs text-center">AI is organizing your standards<br />into a clean curriculum...</p>
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