// src/state/useRouteDesigner.ts
import { useCallback, useMemo, useState } from "react";
import type { LatLng, Route, Segment } from "./types.ts";
import { nanoid } from "../utils/ids.ts";
import { polylineMiles } from "../utils/geo.ts";

export type Step =
  | "idle"
  | "drawing"
  | "saved"
  | "splitting"
  | "segments"
  | "tracking";

export function useRouteDesigner() {
  // map / location
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);

  // drawing
  const [step, setStep] = useState<Step>("idle");
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  const [routeName, setRouteName] = useState("");
  const [route, setRoute] = useState<Route | null>(null);

  // splitting
  const [splitIndices, setSplitIndices] = useState<number[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);

  // tracking
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [trackingPath, setTrackingPath] = useState<LatLng[]>([]);
  const [trackingRunning, setTrackingRunning] = useState(false);
  const [trackingSeconds, setTrackingSeconds] = useState(0);
  const [trackingStartedAt, setTrackingStartedAt] = useState<number | null>(null);

  // -------- Drawing --------
  const startDrawing = useCallback(() => {
    setStep("drawing");
    setDraftPoints([]);
    setRouteName("");
    setRoute(null);
    setSplitIndices([]);
    setSegments([]);
    setActiveSegmentId(null);
    setTrackingPath([]);
    setTrackingRunning(false);
    setTrackingSeconds(0);
    setTrackingStartedAt(null);
  }, []);

  const addDraftPoint = useCallback((p: LatLng) => {
    setDraftPoints((prev) => [...prev, p]);
  }, []);

  const undoLastDraftPoint = useCallback(() => {
    setDraftPoints((prev) => prev.slice(0, -1));
  }, []);

  const clearDraftPoints = useCallback(() => {
    setDraftPoints([]);
  }, []);

  const saveCompleteRoute = useCallback(() => {
    if (draftPoints.length < 2) return;

    const r: Route = {
      id: nanoid(),
      name: routeName.trim() || "Untitled Route",
      points: draftPoints,
      createdAt: Date.now(),
    };

    setRoute(r);
    setStep("saved");
  }, [draftPoints, routeName]);

  const deleteRoute = useCallback(() => {
    setRoute(null);
    setDraftPoints([]);
    setRouteName("");
    setSplitIndices([]);
    setSegments([]);
    setActiveSegmentId(null);
    setTrackingPath([]);
    setTrackingRunning(false);
    setTrackingSeconds(0);
    setTrackingStartedAt(null);
    setStep("idle");
  }, []);

  // -------- Splitting --------
  const startSplitting = useCallback(() => {
    if (!route) return;
    setStep("splitting");
    setSplitIndices([]);
  }, [route]);

  const addSplitPoint = useCallback(
    (pointIndex: number) => {
      if (!route) return;
      if (pointIndex <= 0 || pointIndex >= route.points.length - 1) return;

      setSplitIndices((prev) => {
        if (prev.includes(pointIndex)) return prev;
        return [...prev, pointIndex].sort((a, b) => a - b);
      });
    },
    [route]
  );

  const removeSplitPoint = useCallback((pointIndex: number) => {
    setSplitIndices((prev) => prev.filter((i) => i !== pointIndex));
  }, []);

  const previewSegments = useMemo(() => {
    if (!route) return [];
    const cuts = [0, ...splitIndices, route.points.length - 1];

    const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#06b6d4", "#f97316"];

    return cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1];
      return {
        id: `preview-${i}`,
        startIndex: start,
        endIndex: end,
        count: end - start + 1,
        color: colors[i % colors.length],
        boundarySplitIndex: i < cuts.length - 2 ? cuts[i + 1] : null,
      };
    });
  }, [route, splitIndices]);

  const createSegments = useCallback(() => {
    if (!route) return;
    const cuts = [0, ...splitIndices, route.points.length - 1];

    const next: Segment[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      next.push({
        id: nanoid(),
        routeId: route.id,
        name: `Segment ${i + 1}`,
        startIndex: cuts[i],
        endIndex: cuts[i + 1],
        status: "unassigned",
      });
    }

    setSegments(next);
    setStep("segments");
  }, [route, splitIndices]);

  // -------- Assignments --------
  const assignSegment = useCallback((segmentId: string, person: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId
          ? { ...s, assignedTo: person, status: "assigned" }
          : s
      )
    );
  }, []);

  const unassignSegment = useCallback((segmentId: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId
          ? { ...s, assignedTo: undefined, status: "unassigned" }
          : s
      )
    );
  }, []);

  // -------- Tracking --------
  const beginTrackingSegment = useCallback((segmentId: string) => {
    setActiveSegmentId(segmentId);
    setTrackingPath([]);
    setTrackingSeconds(0);
    setTrackingRunning(false);
    setTrackingStartedAt(null);
    setStep("tracking");
  }, []);

  const startTracking = useCallback(() => {
    setTrackingRunning(true);
    setTrackingStartedAt(Date.now());
  }, []);

  const stopTracking = useCallback(() => setTrackingRunning(false), []);
  const tickTrackingSecond = useCallback(() => {
    setTrackingSeconds((s) => s + 1);
  }, []);

  const pushTrackingPoint = useCallback(
    (p: LatLng) => {
      if (step !== "tracking" || !trackingRunning) return;
      setTrackingPath((prev) => [...prev, p]);
    },
    [step, trackingRunning]
  );

  // inside useRouteDesigner.ts

const finishTracking = useCallback(() => {
  if (!route || !activeSegmentId) return;

  const miles = polylineMiles(trackingPath);
  const seconds = trackingSeconds;
  const mphAvg = seconds > 0 ? miles / (seconds / 3600) : 0;

  setSegments((prev) =>
    prev.map((s) =>
      s.id === activeSegmentId
        ? {
            ...s,
            status: "completed",
            stats: { miles, seconds, mphAvg },
            completedPath: trackingPath, // ✅ NEW
          }
        : s
    )
  );

  setActiveSegmentId(null);
  setTrackingPath([]);
  setTrackingRunning(false);
  setTrackingSeconds(0);
  setTrackingStartedAt(null);
  setStep("segments");
}, [route, activeSegmentId, trackingPath, trackingSeconds]);


  // -------- Derived --------
  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) || null,
    [segments, activeSegmentId]
  );

  const plannedSegmentPoints = useMemo(() => {
    if (!route || !activeSegment) return [];
    return route.points.slice(activeSegment.startIndex, activeSegment.endIndex + 1);
  }, [route, activeSegment]);

  const plannedStartPoint = plannedSegmentPoints[0] ?? null;

  return {
    userLocation,
    setUserLocation,
    mapCenter,
    setMapCenter,
    searchCenter,
    setSearchCenter,

    step,
    setStep,
    draftPoints,
    addDraftPoint,
    undoLastDraftPoint,
    clearDraftPoints,
    routeName,
    setRouteName,
    route,
    saveCompleteRoute,
    startDrawing,
    deleteRoute,

    startSplitting,
    splitIndices,
    addSplitPoint,
    removeSplitPoint,
    previewSegments,
    createSegments,

    segments,
    assignSegment,
    unassignSegment,

    activeSegmentId,
    activeSegment,
    plannedSegmentPoints,
    plannedStartPoint,
    beginTrackingSegment,
    trackingPath,
    trackingRunning,
    trackingSeconds,
    trackingStartedAt,
    startTracking,
    stopTracking,
    tickTrackingSecond,
    pushTrackingPoint,
    finishTracking,
  };
}
