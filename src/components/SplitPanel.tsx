// src/components/SplitPanel.tsx
import { useState } from "react";

export function SplitPanel({ state }: any) {
  const [inputIdx, setInputIdx] = useState<number>(2);

  const r = state.route;
  if (!r) return null;

  const n = r.points.length;
  const previews = state.previewSegments as any[];

  return (
    <section className="mt-2 space-y-4">
      <h2 className="text-lg font-bold">Split Into Segments</h2>

      <div className="rounded-2xl border bg-blue-100 p-4">
        <div className="font-semibold">{r.name}</div>
        <div className="text-sm">{n} Points Drawn</div>
      </div>

      {/* Add split boundary */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Split at point #</label>

        <input
          type="number"
          min={2}
          max={n - 1}
          value={inputIdx}
          onChange={(e) => setInputIdx(Number(e.target.value))}
          className="w-full border rounded-xl p-3"
        />

        <button
          onClick={() => state.addSplitPoint(inputIdx - 1)}
          className="w-full rounded-xl bg-blue-500 text-white py-3 font-bold"
        >
          Add Split Point
        </button>

        <div className="text-xs text-gray-500">
          Choose any point from 2 to {n - 1}
        </div>
      </div>

      {/* Preview segments list */}
      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        {previews.map((seg, idx) => {
          const label = `Segment ${idx + 1}`;
          return (
            <div
              key={seg.id}
              className="border rounded-2xl p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ background: seg.color }}
                />
                <div>
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-gray-600">
                    Points {seg.startIndex + 1} → {seg.endIndex + 1} (
                    {seg.count})
                  </div>
                </div>
              </div>

              {/* Delete this segment by removing its split boundary */}
              {seg.boundarySplitIndex !== null ? (
                <button
                  onClick={() =>
                    state.removeSplitPoint(seg.boundarySplitIndex)
                  }
                  className="text-red-500 font-semibold"
                  title="Delete segment (removes this split)"
                >
                  Delete
                </button>
              ) : (
                <div className="text-xs text-gray-400 pr-1">Last segment</div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={state.createSegments}
        className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold"
      >
        Create {state.splitIndices.length + 1} Segments
      </button>

      <button
        onClick={() => state.setStep("saved")}
        className="w-full rounded-xl border py-3"
      >
        Cancel
      </button>
    </section>
  );
}
