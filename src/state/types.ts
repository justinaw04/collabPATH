// src/state/types.ts
export type LatLng = { lat: number; lng: number };

export type Route = {
  id: string;
  name: string;
  points: LatLng[];
  createdAt: number;
};

export type SegmentStatus = "unassigned" | "assigned" | "completed";

export type SegmentStats = {
  miles: number;
  seconds: number;
  mphAvg: number;
};

export type Segment = {
  id: string;
  routeId: string;
  name: string;
  startIndex: number;
  endIndex: number;
  status: SegmentStatus;
  assignedTo?: string;
  stats?: SegmentStats;

  // ✅ NEW: actual walked path for this segment
  completedPath?: LatLng[];
};
