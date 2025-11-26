// src/App.tsx
import { useEffect } from "react";
import { MapView } from "./components/MapView.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { RightPanel } from "./components/RightPanel.tsx";
import { useRouteDesigner } from "./state/useRouteDesigner.ts";

export default function App() {
  const state = useRouteDesigner();

  const {
    setUserLocation,
    setMapCenter,
    setSearchCenter,
    pushTrackingPoint,
    userLocation,
    mapCenter,
    searchCenter,
    step,
  } = state;

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(p);

        if (!mapCenter && !searchCenter) {
          setMapCenter(p);
        }
      },
      () => {},
      { enableHighAccuracy: true }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(p);
        if (step === "tracking") pushTrackingPoint(p);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    setUserLocation,
    setMapCenter,
    pushTrackingPoint,
    mapCenter,
    searchCenter,
    step,
  ]);

  return (
    <div className="w-screen h-screen flex">
      <div className="relative flex-1">
        <SearchBar
          onSelect={(p) => {
            setMapCenter(p);
            setSearchCenter(p);
          }}
          onRecenter={() => {
            if (!userLocation) return;
            setMapCenter(userLocation);
            setSearchCenter(null);
          }}
        />

        <MapView
          center={mapCenter}
          userLocation={userLocation}
          searchCenter={searchCenter}
          draftPoints={state.draftPoints}
          routePoints={state.route?.points ?? null}
          segments={state.segments}
          previewSegments={state.previewSegments}
          trackingPath={state.trackingPath}
          activeSegmentPoints={state.plannedSegmentPoints}
          mode={step}
          onMapClick={state.addDraftPoint}
        />
      </div>

      <RightPanel state={state} />
    </div>
  );
}
