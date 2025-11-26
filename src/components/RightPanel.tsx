// src/components/RightPanel.tsx
import { SplitPanel } from "./SplitPanel.tsx";
import { SegmentList } from "./SegmentList.tsx";
import { TrackingPanel } from "./TrackingPanel.tsx";

export function RightPanel({ state }: any) {
  const { step } = state;

  return (
    <div className="w-[380px] h-full bg-white border-l p-4 overflow-y-auto">
      {step === "idle" && <IdlePanel state={state} />}
      {step === "drawing" && <DrawingPanel state={state} />}
      {step === "saved" && <SavedPanel state={state} />}
      {step === "splitting" && <SplitPanel state={state} />}
      {step === "segments" && <SegmentList state={state} />}
      {step === "tracking" && <TrackingPanel state={state} />}
    </div>
  );
}

function IdlePanel({ state }: any) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Route Designer</h2>
      <p className="text-sm text-gray-600">
        Search an address or use your location. Press Start Drawing to begin.
      </p>

      <button
        onClick={state.startDrawing}
        className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold"
      >
        Start Drawing
      </button>
    </section>
  );
}

function DrawingPanel({ state }: any) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Drawing Mode</h2>
      <div className="text-sm text-gray-600">
        Click on the map to add points.
      </div>

      <div className="rounded-xl border p-3">
        <div className="font-semibold">Points Added</div>
        <div className="text-sm">{state.draftPoints.length}</div>
      </div>

      <input
        className="w-full border rounded-xl p-3"
        placeholder="Title this route"
        value={state.routeName}
        onChange={(e: any) => state.setRouteName(e.target.value)}
      />

      <button
        onClick={state.saveCompleteRoute}
        disabled={state.draftPoints.length < 2}
        className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold disabled:opacity-40"
      >
        Save Complete Route
      </button>

      <button
        onClick={state.undoLastDraftPoint}
        disabled={state.draftPoints.length === 0}
        className="w-full rounded-xl border py-3 disabled:opacity-40"
      >
        Undo Last Point
      </button>

      <button
        onClick={() => state.setStep("idle")}
        className="w-full rounded-xl border py-3"
      >
        Cancel Drawing
      </button>
    </section>
  );
}

function SavedPanel({ state }: any) {
  const r = state.route;
  if (!r) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Completed Route</h2>

      <div className="rounded-2xl border bg-blue-100 p-4">
        <div className="font-semibold">{r.name}</div>
        <div className="text-sm">{r.points.length} points • saved</div>
      </div>

      <button
        onClick={state.startSplitting}
        className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold"
      >
        Split Into Segments
      </button>

      <button
        onClick={state.startDrawing}
        className="w-full rounded-xl border py-3"
      >
        Redesign Route
      </button>

      <button
        onClick={state.deleteRoute}
        className="w-full rounded-xl border py-3 text-red-600"
      >
        Delete Route
      </button>
    </section>
  );
}
