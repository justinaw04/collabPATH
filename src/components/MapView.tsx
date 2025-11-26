// src/components/MapView.tsx
import { useEffect, useRef, useState } from "react";
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

export function MapView(props: Props) {
  const {
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
  } = props;

  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const modeRef = useRef<Step>(mode);
  const onMapClickRef = useRef<Props["onMapClick"]>(onMapClick);

  const personMarkerRef = useRef<maplibregl.Marker | null>(null);

  // forces redraw after style is truly ready in prod
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

    // debug prod errors
    map.on("error", (e) => console.error("MAP ERROR:", e.error));

    // bump tick when style becomes ready / changes
    map.on("load", () => setStyleTick((t) => t + 1));
    map.on("styledata", () => {
      if (map.isStyleLoaded()) setStyleTick((t) => t + 1);
    });

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

  // ---------- HARD REDRAW ALL CUSTOM LAYERS ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // 1) remove any custom layers/sources we might have added before
    const removeIfExists = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };

    // known fixed ids
    const fixedIds = [
      "draft-line",
      "route-line",
      "active-seg",
      "tracking-line",
      "search-pin",
      "route-points",
      "route-points-circles",
      "route-points-labels",
      "user-dot",
    ];
    fixedIds.forEach(removeIfExists);

    // preview + segment layers are dynamic prefixes
    map.getStyle().layers?.forEach((l) => {
      if (
        l.id.startsWith("preview-") ||
        l.id.startsWith("seg-")
      ) {
        removeIfExists(l.id);
      }
    });
    Object.keys(map.getStyle().sources).forEach((sid) => {
      if (
        sid.startsWith("preview-") ||
        sid.startsWith("seg-")
      ) {
        removeIfExists(sid);
      }
    });

    // 2) helpers to add fresh layers
    const addLine = (
      id: string,
      points: LatLng[],
      color: string,
      width = 4,
      opacity = 1
    ) => {
      if (points.length < 2) return;
      const coords = points.map((p) => [p.lng, p.lat]);

      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      };

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
    };

    const addPoints = (id: string, points: LatLng[], color = "#111827") => {
      if (points.length === 0) return;

      const features: GeoJSON.Feature<GeoJSON.Point>[] = points.map((p, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { index: i + 1 },
      }));

      const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features,
      };

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
    };

    // 3) redraw in correct order

    // draft line
    if (mode === "drawing") {
      addLine("draft-line", draftPoints, "#2563eb", 4, 1);
    }

    // base route
    if (routePoints) {
      addLine("route-line", routePoints, "#a855f7", 5, 0.7);
    }

    // numbered points when relevant
    const ptsToLabel =
      mode === "drawing" ? draftPoints : routePoints ?? [];
    const showLabels =
      mode === "splitting" || mode === "segments" || mode === "saved";
    if (showLabels || mode === "drawing") {
      addPoints("route-points", ptsToLabel, "#111827");
      if (!showLabels) {
        map.setLayoutProperty("route-points-labels", "visibility", "none");
      }
    }

    // preview segments while splitting
    if (mode === "splitting" && routePoints) {
      previewSegments.forEach((ps) => {
        const segPts = routePoints.slice(ps.startIndex, ps.endIndex + 1);
        addLine(`preview-${ps.id}`, segPts, ps.color, 6, 0.95);
      });
    }

    // final segments
    if (routePoints) {
      segments.forEach((s, idx) => {
        const segPts =
          s.status === "completed" && s.completedPath && s.completedPath.length > 1
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

        addLine(`seg-${s.id}`, segPts, color, 5, 0.95);
      });
    }

    // active segment highlight in tracking
    if (mode === "tracking") {
      addLine("active-seg", activeSegmentPoints, "#a855f7", 8, 1);
    }

    // live tracking overlay
    if (mode === "tracking") {
      addLine("tracking-line", trackingPath, "#2563eb", 4, 1);
    }

    // search pin
    if (searchCenter) {
      map.addSource("search-pin", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [searchCenter.lng, searchCenter.lat],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "search-pin",
        type: "circle",
        source: "search-pin",
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef4444",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
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

        map.addSource("user-dot", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [userLocation.lng, userLocation.lat],
            },
            properties: {},
          },
        });

        map.addLayer({
          id: "user-dot",
          type: "circle",
          source: "user-dot",
          paint: {
            "circle-radius": 6,
            "circle-color": "#111827",
          },
        });
      }
    }
  }, [
    styleTick,
    mode,
    draftPoints,
    routePoints,
    previewSegments,
    segments,
    activeSegmentPoints,
    trackingPath,
    searchCenter,
    userLocation,
  ]);

  return <div ref={containerRef} className="w-full h-full z-0" />;
}
