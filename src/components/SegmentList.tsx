// src/components/SegmentList.tsx
import { useMemo, useState } from "react";

export function SegmentList({ state }: any) {
  // per-segment draft names (keyed by segment id)
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  function setDraft(id: string, value: string) {
    setDraftNames((prev) => ({ ...prev, [id]: value }));
  }
  function getDraft(id: string) {
    return draftNames[id] ?? ""; // default blank
  }

  // ---- tracker counts ----
  const counts = useMemo(() => {
    const total = state.segments.length;
    const assigned = state.segments.filter((s: any) => s.status === "assigned")
      .length;
    const completed = state.segments.filter((s: any) => s.status === "completed")
      .length;
    return { total, assigned, completed };
  }, [state.segments]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Segments</h2>

      {/* Segment Tracker */}
      <div className="grid grid-cols-3 gap-3">
        <TrackerBox
          label="Segments"
          value={counts.total}
          bgClass="bg-blue-100"
          textClass="text-blue-700"
        />
        <TrackerBox
          label="Assigned"
          value={counts.assigned}
          bgClass="bg-purple-100"
          textClass="text-purple-700"
        />
        <TrackerBox
          label="Completed"
          value={counts.completed}
          bgClass="bg-amber-100"
          textClass="text-amber-700"
        />
      </div>

      {/* Segment cards */}
      {state.segments.map((s: any, idx: number) => {
        const label = s.name ?? `Segment ${idx + 1}`;
        const draft = getDraft(s.id);

        const isUnassigned = s.status === "unassigned";
        const isAssigned = s.status === "assigned";
        const isCompleted = s.status === "completed";

        return (
          <div key={s.id} className="border rounded-2xl p-4 space-y-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold">{label}</div>
              <div className="text-sm text-gray-600">
                Points {s.startIndex + 1} → {s.endIndex + 1}
              </div>
            </div>

            {/* Completed stats */}
            {isCompleted && s.stats && (
              <div className="text-sm">
                ✅ Completed • {s.stats.miles.toFixed(2)} mi •{" "}
                {(s.stats.seconds / 60).toFixed(1)} min •{" "}
                {s.stats.mphAvg.toFixed(1)} mph
              </div>
            )}

            {/* Assignment area */}
            {isUnassigned && (
              <div className="space-y-2">
                <input
                  className="w-full border rounded-xl p-2"
                  value={draft}
                  onChange={(e) => setDraft(s.id, e.target.value)}
                  placeholder="Assign to..."
                />

                <button
                  onClick={() => {
                    if (!draft.trim()) return;
                    state.assignSegment(s.id, draft.trim());
                    setDraft(s.id, "");
                  }}
                  disabled={!draft.trim()}
                  className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40"
                >
                  Assign
                </button>
              </div>
            )}

            {/* Assigned / Completed display (NO textbox) */}
            {(isAssigned || isCompleted) && s.assignedTo && (
              <div className="rounded-xl bg-purple-50 border border-purple-100 px-3 py-2 text-sm">
                Assigned to:{" "}
                <span className="font-semibold text-purple-700">
                  {s.assignedTo}
                </span>
              </div>
            )}

            {/* Buttons below assignment */}
            {isAssigned && (
              <div className="space-y-2">
                <button
                  onClick={() => state.beginTrackingSegment(s.id)}
                  className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold"
                >
                  Start GPS tracking
                </button>

                <button
                  onClick={() => state.unassignSegment(s.id)}
                  className="w-full px-3 py-2 rounded-xl border text-red-600 font-semibold"
                >
                  Unassign
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function TrackerBox({
  label,
  value,
  bgClass,
  textClass,
}: {
  label: string;
  value: number;
  bgClass: string;
  textClass: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${bgClass}`}>
      <div className={`text-2xl font-bold ${textClass}`}>{value}</div>
      <div className={`text-sm font-semibold ${textClass}`}>{label}</div>
    </div>
  );
}
