// src/components/TrackingPanel.tsx
import { useEffect, useMemo } from "react";
import type { LatLng } from "../state/types.ts";

export function TrackingPanel({ state }: any) {
  const {
    activeSegment: seg,
    plannedStartPoint: startPt,
    userLocation: userLoc,
    trackingRunning,
    tickTrackingSecond,
    trackingPath,
    trackingSeconds,
    startTracking,
    stopTracking,
    finishTracking,
  } = state;

  const distanceMeters = useMemo(() => {
    if (!startPt || !userLoc) return null;
    return haversineMeters(userLoc, startPt);
  }, [startPt, userLoc]);

  const distanceLabel = useMemo(() => {
    if (distanceMeters == null) return "—";
    const miles = distanceMeters / 1609.344;
    const feet = distanceMeters * 3.28084;
    return miles >= 0.1 ? `${miles.toFixed(2)} miles` : `${Math.round(feet)} feet`;
  }, [distanceMeters]);

  useEffect(() => {
    if (!trackingRunning) return;
    const id = setInterval(() => tickTrackingSecond(), 1000);
    return () => clearInterval(id);
  }, [trackingRunning, tickTrackingSecond]);

  if (!seg) return null;

  // rough live miles calc for UI (final stats still from hook)
  const miles =
    trackingPath.length > 1
      ? trackingPath.reduce(
          (acc: number, _p: any, i: number, arr: any[]) => {
            if (i === 0) return acc;
            const a = arr[i - 1],
              b = arr[i];
            const dx = b.lng - a.lng;
            const dy = b.lat - a.lat;
            return acc + Math.sqrt(dx * dx + dy * dy);
          },
          0
        ) * 69
      : 0;

  const mph = trackingSeconds > 0 ? miles / (trackingSeconds / 3600) : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Track your walk/run</h2>

      <div className="rounded-2xl border bg-pink-50 p-4 space-y-1">
        <div className="font-semibold">{seg.name}</div>
        <div className="text-sm text-gray-700">
          Planned Route: {seg.endIndex - seg.startIndex + 1} points
        </div>
        {seg.assignedTo && (
          <div className="text-sm text-gray-700">
            Runner/Walker: {seg.assignedTo}
          </div>
        )}
      </div>

      {/* Distance to start (only before tracking starts) */}
      {!trackingRunning && (
        <div className="rounded-xl border p-3 bg-blue-50 text-sm">
          <div className="font-semibold">Distance to start point</div>
          <div className="text-gray-700">{distanceLabel}</div>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="miles" value={miles.toFixed(2)} />
        <StatBox
          label="Time"
          value={`${Math.floor(trackingSeconds / 60)}:${String(
            trackingSeconds % 60
          ).padStart(2, "0")}`}
        />
        <StatBox label="mph" value={mph.toFixed(1)} />
      </div>

      {/* GPS status */}
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <span>📍</span>
          <span className="font-semibold">GPS Status</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">Active</span>
      </div>

      {/* buttons */}
      {!trackingRunning ? (
        <button
          onClick={startTracking}
          className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold"
        >
          Start Tracking
        </button>
      ) : (
        <button
          onClick={stopTracking}
          className="w-full rounded-xl border py-3 font-bold"
        >
          Pause Tracking
        </button>
      )}

      <button
        onClick={finishTracking}
        className="w-full rounded-xl border py-3 font-bold"
      >
        Finish Segment
      </button>

      {/* instructions */}
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm space-y-2">
        <div className="font-semibold">Instructions</div>
        <ol className="list-decimal ml-5 space-y-1">
          <li>
            Go to the starting point of your route segment
            {startPt && (
              <span className="block text-xs text-gray-600 mt-1">
                Start: ({startPt.lat.toFixed(5)}, {startPt.lng.toFixed(5)})
              </span>
            )}
          </li>
          <li>Click “Start Tracking” to begin GPS recording</li>
          <li>Walk/run along your assigned path (your path will draw in blue)</li>
          <li>Click “Finish Segment” when done</li>
          <li>Your stats will be saved to the segment</li>
        </ol>
      </div>
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-blue-50 p-3 text-center border">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs font-semibold text-gray-600">{label}</div>
    </div>
  );
}

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
