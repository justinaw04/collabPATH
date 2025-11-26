// src/components/MapView.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, Segment } from "../state/types.ts";
import type { Step } from "../state/useRouteDesigner.ts";

type PreviewSeg = {
  id: string;
  startIndex: number;
  endIndex: number;
  color: string;
};

type Props = {
  center: LatLng | null;
  userLocation: LatLng | null;
  searchCenter: LatLng | null;

  draftPoints: LatLng[];
  routePoints: LatLng[] | null;

  segments: Segment[];
  previewSegments: PreviewSeg[];

  trackingPath: LatLng[];
  activeSegmentPoints: LatLng[];

  mode: Step;
  onMapClick?: (p: LatLng) => void;
};

export function MapView({
  center,
  userLocation,
  searchCenter,
  draftPoints,
  routePoints,
  segments,
  previewSegments,
  trackingPath,
  activeSegmentPoints,
  mode,
  onMapClick,
}: Props) {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<Step>(mode);
  const onMapClickRef = useRef<Props["onMapClick"]>(onMapClick);

  const personMarkerRef = useRef<maplibregl.Marker | null>(null);

  // tick when style changes so we re-attempt drawing in prod
  const [styleTick, setStyleTick] = useState(0);

  useEffect(() => {
    modeRef.current = mode;
    onMapClickRef.current = onMapClick;
  }, [mode, onMapClick]);

  // ---------- INIT MAP ONCE ----------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: center ? [center.lng, center.lat] : [-87.6298, 41.8781],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    // log maplibre internal errors in prod
    map.on("error", (e) => console.error("MAP ERROR:", e.error));

    // bump tick when style becomes ready / changes
    map.on("load", () => setStyleTick((t) => t + 1));
    map.on("styledata", () => setStyleTick((t) => t + 1));

    map.on("click", (e) => {
      const m = modeRef.current;
      const cb = onMapClickRef.current;
      if (cb && m === "drawing") {
        cb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mapRef.current = map;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- RECENTER ----------
  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center]);

  // ---------- UPSERT HELPERS (WITH PROD DIAGNOSTICS) ----------
  const upsertLine = useCallback(
    (id: string, points: LatLng[], color: string, width = 4, opacity = 1) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded() || points.length < 2) return;

      const coords = points.map((p) => [p.lng, p.lat]);

      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      };

      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;

      if (src) {
        src.setData(data);
      } else {
        try {
          map.addSource(id, { type: "geojson", data });
        } catch (e) {
          console.error("ADD SOURCE FAILED", id, e);
          return;
        }
      }

      if (!map.getLayer(id)) {
        try {
          map.addLayer({
            id,
            type: "line",
            source: id,
            paint: {
              "line-color": color,
              "line-width": width,
              "line-opacity": opacity,
            },
          });
        } catch (e) {
          console.error("ADD LAYER FAILED", id, e);
          return;
        }
      } else {
        try {
          map.setPaintProperty(id, "line-color", color);
          map.setPaintProperty(id, "line-width", width);
          map.setPaintProperty(id, "line-opacity", opacity);
        } catch (e) {
          console.error("SET PAINT FAILED", id, e);
        }
      }
    },
    []
  );

  const upsertPoints = useCallback(
    (id: string, points: LatLng[], color = "#111827") => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded() || points.length === 0) return;

      const features: GeoJSON.Feature<GeoJSON.Point>[] = points.map((p, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { index: i + 1 },
      }));

      const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features,
      };

      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;

      if (src) {
        src.setData(data);
      } else {
        try {
          map.addSource(id, { type: "geojson", data });
        } catch (e) {
          console.error("ADD SOURCE FAILED", id, e);
          return;
        }
      }

      const circlesId = `${id}-circles`;
      const labelsId = `${id}-labels`;

      if (!map.getLayer(circlesId)) {
        try {
          map.addLayer({
            id: circlesId,
            type: "circle",
            source: id,
            paint: {
              "circle-radius": 6,
              "circle-color": color,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
        } catch (e) {
          console.error("ADD LAYER FAILED", circlesId, e);
          return;
        }
      } else {
        try {
          map.setPaintProperty(circlesId, "circle-color", color);
        } catch (e) {
          console.error("SET PAINT FAILED", circlesId, e);
        }
      }

      if (!map.getLayer(labelsId)) {
        try {
          map.addLayer({
            id: labelsId,
            type: "symbol",
            source: id,
            layout: {
              "text-field": ["get", "index"],
              "text-size": 12,
              "text-offset": [0, -1.2],
              "text-anchor": "bottom",
            },
            paint: {
              "text-color": "#111827",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            },
          });
        } catch (e) {
          console.error("ADD LAYER FAILED", labelsId, e);
        }
      }
    },
    []
  );

  // ---------- REDRAW ALL OVERLAYS (UPSERT) ----------
  const redrawAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // draft line
    if (mode === "drawing") {
      upsertLine("draft-line", draftPoints, "#2563eb", 4, 1);
    }

    // base route
    if (routePoints) {
      upsertLine("route-line", routePoints, "#a855f7", 5, 0.7);
    }

    // numbered points
    const ptsToLabel =
      mode === "drawing" ? draftPoints : routePoints ?? [];
    const showLabels =
      mode === "splitting" || mode === "segments" || mode === "saved";

    if (ptsToLabel.length) {
      upsertPoints("route-points", ptsToLabel, "#111827");
      if (map.getLayer("route-points-labels")) {
        map.setLayoutProperty(
          "route-points-labels",
          "visibility",
          showLabels ? "visible" : "none"
        );
      }
    }

    // preview segments while splitting
    if (mode === "splitting" && routePoints) {
      previewSegments.forEach((ps) => {
        const segPts = routePoints.slice(ps.startIndex, ps.endIndex + 1);
        upsertLine(`preview-${ps.id}`, segPts, ps.color, 6, 0.95);
      });
    }

    // final segments
    if (routePoints) {
      segments.forEach((s, idx) => {
        const segPts =
          s.status === "completed" &&
          s.completedPath &&
          s.completedPath.length > 1
            ? s.completedPath
            : routePoints.slice(s.startIndex, s.endIndex + 1);

        const color =
          s.status === "completed"
            ? "#22c55e"
            : s.status === "assigned"
            ? idx % 2
              ? "#f59e0b"
              : "#ef4444"
            : "#9ca3af";

        upsertLine(`seg-${s.id}`, segPts, color, 5, 0.95);
      });
    }

    // active segment highlight
    if (mode === "tracking") {
      upsertLine("active-seg", activeSegmentPoints, "#a855f7", 8, 1);
    }

    // tracking overlay
    if (mode === "tracking") {
      upsertLine("tracking-line", trackingPath, "#2563eb", 4, 1);
    }

    // search pin
    if (searchCenter) {
      upsertPoints("search-pin", [searchCenter], "#ef4444");
    }

    // user icon / dot
    if (userLocation) {
      if (mode === "tracking") {
        if (!personMarkerRef.current) {
          const el = document.createElement("div");
          el.textContent = "🧍";
          el.style.fontSize = "22px";
          el.style.transform = "translate(-50%, -50%)";

          personMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map);
        } else {
          personMarkerRef.current.setLngLat([
            userLocation.lng,
            userLocation.lat,
          ]);
        }
      } else {
        if (personMarkerRef.current) {
          personMarkerRef.current.remove();
          personMarkerRef.current = null;
        }
        upsertPoints("user-dot", [userLocation], "#111827");
      }
    }
  }, [
    mode,
    draftPoints,
    routePoints,
    previewSegments,
    segments,
    activeSegmentPoints,
    trackingPath,
    searchCenter,
    userLocation,
    upsertLine,
    upsertPoints,
  ]);

  // ✅ retry until style is ready, then redrawAll
  useEffect(() => {
    let cancelled = false;

    const tryDraw = () => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      if (!map.isStyleLoaded()) {
        setTimeout(tryDraw, 200);
        return;
      }

      redrawAll();
    };

    tryDraw();
    return () => {
      cancelled = true;
    };
  }, [styleTick, redrawAll]);

  return <div ref={containerRef} className="w-full h-full z-0" />;
}
