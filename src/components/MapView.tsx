// src/components/MapView.tsx
import { useEffect, useRef } from "react";
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

  // keep latest mode/callback for click handler without re-binding
  const modeRef = useRef<Step>(mode);
  const onMapClickRef = useRef<Props["onMapClick"]>(onMapClick);

  // person marker for tracking
  const personMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    onMapClickRef.current = onMapClick;
  }, [mode, onMapClick]);

  // ---------- MAP INIT (ONCE) ----------
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

    map.on("click", (e) => {
      const m = modeRef.current;
      const cb = onMapClickRef.current;
      if (cb && m === "drawing") {
        cb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mapRef.current = map;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ init once on purpose

  // ---------- RECENTER ----------
  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.easeTo({ center: [center.lng, center.lat], duration: 500 });
  }, [center]);

  // ---------- HELPERS ----------
  function setLine(
    id: string,
    points: LatLng[],
    color: string,
    width = 4,
    opacity = 1
  ) {
    const map = mapRef.current;
    if (!map) return;

    const coords = points.map((p) => [p.lng, p.lat]);

    const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;

    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    };

    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(id, { type: "geojson", data });
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
    }
  }

  function removeLayerAndSource(id: string) {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  function setPointsLayer(id: string, points: LatLng[], color = "#111827") {
    const map = mapRef.current;
    if (!map) return;

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
      map.addSource(id, { type: "geojson", data });

      map.addLayer({
        id: `${id}-circles`,
        type: "circle",
        source: id,
        paint: {
          "circle-radius": 6,
          "circle-color": color,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: `${id}-labels`,
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
    }
  }

  function removePointsLayer(id: string) {
    const map = mapRef.current;
    if (!map) return;
    const layers = [`${id}-labels`, `${id}-circles`];
    layers.forEach((l) => map.getLayer(l) && map.removeLayer(l));
    map.getSource(id) && map.removeSource(id);
  }

  // ---------- DRAFT LINE ----------
  useEffect(() => {
    if (!mapRef.current) return;

    if (mode === "drawing" && draftPoints.length > 1) {
      setLine("draft-line", draftPoints, "#2563eb", 4, 1);
    } else {
      removeLayerAndSource("draft-line");
    }
  }, [draftPoints, mode]);

  // ---------- FULL ROUTE BASE ----------
  useEffect(() => {
    if (!mapRef.current || !routePoints) return;
    setLine("route-line", routePoints, "#a855f7", 5, 0.7);
  }, [routePoints]);

  // ---------- NUMBERED POINTS ----------
  useEffect(() => {
    if (!mapRef.current) return;

    const pts = mode === "drawing" ? draftPoints : routePoints ?? [];
    const showLabels =
      mode === "splitting" || mode === "segments" || mode === "saved";

    if (pts.length > 0) {
      setPointsLayer("route-points", pts, "#111827");
      if (mapRef.current.getLayer("route-points-labels")) {
        mapRef.current.setLayoutProperty(
          "route-points-labels",
          "visibility",
          showLabels ? "visible" : "none"
        );
      }
    } else {
      removePointsLayer("route-points");
    }
  }, [draftPoints, routePoints, mode]);

  // ---------- PREVIEW SEGMENTS (SPLITTING) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routePoints) return;

    if (mode !== "splitting") {
      previewSegments.forEach((ps) =>
        removeLayerAndSource(`preview-${ps.id}`)
      );
      return;
    }

    previewSegments.forEach((ps) => {
      const pts = routePoints.slice(ps.startIndex, ps.endIndex + 1);
      setLine(`preview-${ps.id}`, pts, ps.color, 6, 0.95);
    });
  }, [previewSegments, routePoints, mode]);

  // ---------- FINAL SEGMENTS ----------
  useEffect(() => {
    if (!mapRef.current || !routePoints) return;

    segments.forEach((s, idx) => {
      const pts =
        s.status === "completed" && s.completedPath && s.completedPath.length > 1
          ? s.completedPath
          : routePoints.slice(s.startIndex, s.endIndex + 1);

      const color =
        s.status === "completed"
          ? "#22c55e" // ✅ green for completed
          : s.status === "assigned"
          ? idx % 2
            ? "#f59e0b"
            : "#ef4444"
          : "#9ca3af";

      setLine(`seg-${s.id}`, pts, color, 5, 0.95);
    });
  }, [segments, routePoints]);

  // ---------- ACTIVE SEGMENT HIGHLIGHT ----------
  useEffect(() => {
    if (!mapRef.current) return;

    if (mode === "tracking" && activeSegmentPoints.length > 1) {
      setLine("active-seg", activeSegmentPoints, "#a855f7", 8, 1);
    } else {
      removeLayerAndSource("active-seg");
    }
  }, [activeSegmentPoints, mode]);

  // ---------- LIVE TRACKING PATH ----------
  useEffect(() => {
    if (!mapRef.current) return;

    if (mode === "tracking" && trackingPath.length > 1) {
      setLine("tracking-line", trackingPath, "#2563eb", 4, 1);
    } else {
      removeLayerAndSource("tracking-line");
    }
  }, [trackingPath, mode]);

  // ---------- USER LOCATION: PERSON ICON DURING TRACKING ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    // ensure dot layer removed if person marker is used
    if (map.getLayer("user-dot")) {
      map.removeLayer("user-dot");
      map.removeSource("user-dot");
    }

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
      // not tracking → remove marker and show dot
      if (personMarkerRef.current) {
        personMarkerRef.current.remove();
        personMarkerRef.current = null;
      }

      const data: GeoJSON.Feature<GeoJSON.Point> = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [userLocation.lng, userLocation.lat],
        },
        properties: {},
      };

      map.addSource("user-dot", { type: "geojson", data });
      map.addLayer({
        id: "user-dot",
        type: "circle",
        source: "user-dot",
        paint: { "circle-radius": 6, "circle-color": "#111827" },
      });
    }
  }, [userLocation, mode]);

  // ---------- SEARCH PIN ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const id = "search-pin";

    if (!searchCenter) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      return;
    }

    const data: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [searchCenter.lng, searchCenter.lat],
      },
      properties: {},
    };

    const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;

    if (src) src.setData(data);
    else {
      map.addSource(id, { type: "geojson", data });
      map.addLayer({
        id,
        type: "circle",
        source: id,
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef4444",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [searchCenter]);

  return <div ref={containerRef} className="w-full h-full z-0" />;
}
