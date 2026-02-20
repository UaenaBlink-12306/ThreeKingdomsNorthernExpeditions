import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { antPath } from "leaflet-ant-path";
import "leaflet-polylinedecorator";

import type { GameState } from "../types";
import { PLACE_MAP, PLACES } from "../places";
import { ROUTE_MAP } from "../routes";
import armyIconUrl from "../assets/icons/army.svg";
import flagIconUrl from "../assets/icons/flag.svg";
import FxOverlay from "./FxOverlay";

interface MapPanelProps {
  state: GameState;
  audioEnabled: boolean;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolateAlongPath(points: [number, number][], progress: number): [number, number] {
  if (points.length < 2) {
    return points[0] ?? [33.0676, 107.0238];
  }
  const t = clampProgress(progress);
  const lengths: number[] = [];
  let total = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = L.latLng(points[i][0], points[i][1]);
    const end = L.latLng(points[i + 1][0], points[i + 1][1]);
    const seg = start.distanceTo(end);
    lengths.push(seg);
    total += seg;
  }

  if (total <= 0) {
    return points[0];
  }

  const target = total * t;
  let acc = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const seg = lengths[i];
    if (acc + seg >= target) {
      const ratio = (target - acc) / seg;
      const [aLat, aLng] = points[i];
      const [bLat, bLng] = points[i + 1];
      return [aLat + (bLat - aLat) * ratio, aLng + (bLng - aLng) * ratio];
    }
    acc += seg;
  }
  return points[points.length - 1];
}

function headingAtProgress(points: [number, number][], progress: number): number {
  const [lat1, lng1] = interpolateAlongPath(points, progress);
  const [lat2, lng2] = interpolateAlongPath(points, Math.min(1, progress + 0.02));
  const dy = lat2 - lat1;
  const dx = lng2 - lng1;
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Number.isFinite(angle) ? angle : 0;
}

function MapReadyBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function MapPanel({ state, audioEnabled }: MapPanelProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const displayProgressRef = useRef(0);
  const antLayerRef = useRef<L.Layer | null>(null);
  const decoratorRef = useRef<L.Layer | null>(null);
  const cameraTimerRef = useRef<number | null>(null);
  const prevRouteRef = useRef<string | null>(null);
  const prevLocationRef = useRef(state.current_location);

  const activeRoute = state.active_route_id ? ROUTE_MAP[state.active_route_id] : undefined;
  const controlledSet = useMemo(() => new Set(state.controlled_locations), [state.controlled_locations]);

  useEffect(() => {
    if (!PLACE_MAP[state.current_location]) {
      console.warn("Unknown current_location from backend:", state.current_location);
    }
    for (const placeId of state.controlled_locations) {
      if (!PLACE_MAP[placeId]) {
        console.warn("Unknown controlled location from backend:", placeId);
      }
    }
    if (state.active_route_id && !ROUTE_MAP[state.active_route_id]) {
      console.warn("Unknown active_route_id from backend:", state.active_route_id);
    }
  }, [state.current_location, state.controlled_locations, state.active_route_id]);

  useEffect(() => {
    if (prevRouteRef.current !== state.active_route_id) {
      displayProgressRef.current = 0;
      setDisplayProgress(0);
    }
  }, [state.active_route_id]);

  useEffect(() => {
    if (!state.active_route_id) {
      displayProgressRef.current = 0;
      setDisplayProgress(0);
      return;
    }

    const from = displayProgressRef.current;
    const to = clampProgress(state.route_progress);
    const duration = 760;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const value = from + (to - from) * eased;
      displayProgressRef.current = value;
      setDisplayProgress(value);
      if (p < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [state.route_progress, state.active_route_id]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const cleanupLayers = () => {
      if (antLayerRef.current) {
        map.removeLayer(antLayerRef.current);
        antLayerRef.current = null;
      }
      if (decoratorRef.current) {
        map.removeLayer(decoratorRef.current);
        decoratorRef.current = null;
      }
    };

    cleanupLayers();

    if (!activeRoute) {
      return cleanupLayers;
    }

    const latLngs = activeRoute.points.map(([lat, lng]) => L.latLng(lat, lng));

    const ant = antPath(latLngs, {
      className: "route-ant",
      color: "#ffe08a",
      pulseColor: "#fff6d0",
      weight: 4,
      delay: 700,
      dashArray: [12, 20],
      hardwareAccelerated: true,
    });
    ant.addTo(map);
    antLayerRef.current = ant;

    const decorator = (L as unknown as { polylineDecorator: Function; Symbol: any }).polylineDecorator(
      latLngs,
      {
        patterns: [
          {
            offset: 16,
            repeat: 44,
            symbol: (L as unknown as { Symbol: any }).Symbol.arrowHead({
              pixelSize: 9,
              polygon: false,
              pathOptions: {
                color: "#fff4ce",
                weight: 2,
                opacity: 0.9,
              },
            }),
          },
        ],
      }
    ) as L.Layer;
    decorator.addTo(map);
    decoratorRef.current = decorator;

    return cleanupLayers;
  }, [map, activeRoute?.id]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const routeChanged = prevRouteRef.current !== (activeRoute?.id ?? null);
    const locationChanged = prevLocationRef.current !== state.current_location;
    if (!routeChanged && !locationChanged) {
      return;
    }

    if (cameraTimerRef.current !== null) {
      window.clearTimeout(cameraTimerRef.current);
    }

    cameraTimerRef.current = window.setTimeout(() => {
      if (routeChanged && activeRoute) {
        const bounds = L.latLngBounds(activeRoute.points.map(([lat, lng]) => [lat, lng] as [number, number]));
        map.fitBounds(bounds.pad(0.25), { animate: true, duration: 1.0 });
      } else if (locationChanged) {
        const place = PLACE_MAP[state.current_location];
        if (place) {
          map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 6.7), {
            animate: true,
            duration: 0.9,
          });
        }
      }
    }, 240);

    prevRouteRef.current = activeRoute?.id ?? null;
    prevLocationRef.current = state.current_location;

    return () => {
      if (cameraTimerRef.current !== null) {
        window.clearTimeout(cameraTimerRef.current);
      }
    };
  }, [map, state.current_location, activeRoute]);

  const currentPlace = PLACE_MAP[state.current_location];
  const activePoints = activeRoute?.points ?? [];

  const armyPosition = useMemo<[number, number]>(() => {
    if (activePoints.length > 1) {
      return interpolateAlongPath(activePoints, displayProgress);
    }
    if (currentPlace) {
      return [currentPlace.lat, currentPlace.lng];
    }
    return [33.0676, 107.0238];
  }, [activePoints, displayProgress, currentPlace]);

  const armyHeading = useMemo(() => {
    if (activePoints.length > 1) {
      return headingAtProgress(activePoints, displayProgress);
    }
    return 0;
  }, [activePoints, displayProgress]);

  const armyIcon = useMemo(
    () =>
      L.divIcon({
        className: "army-div-icon",
        html: `<div class="army-marker-inner" style="transform: rotate(${armyHeading}deg)"><img src="${armyIconUrl}" alt="army"/></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    [armyHeading]
  );

  const flagIcon = useMemo(
    () =>
      L.divIcon({
        className: "flag-div-icon",
        html: `<img src="${flagIconUrl}" alt="flag" />`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    []
  );

  return (
    <section className="panel map-panel">
      <header className="map-header">
        <h2>战区态势图</h2>
        <span>当前位置：{currentPlace ? currentPlace.name : state.current_location}</span>
      </header>
      <div className="map-wrap">
        <MapContainer
          center={[33.0676, 107.0238]}
          zoom={6.6}
          scrollWheelZoom
          className="map-canvas"
          preferCanvas
        >
          <MapReadyBridge onReady={setMap} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {activeRoute ? (
            <Polyline
              positions={activeRoute.points}
              pathOptions={{
                color: "#f6c770",
                weight: 10,
                opacity: 0.3,
                className: "route-glow",
              }}
            />
          ) : null}

          {currentPlace && state.wei_pressure >= 5 ? (
            <Circle
              center={[currentPlace.lat, currentPlace.lng]}
              radius={13000 + state.wei_pressure * 2300}
              pathOptions={{
                color: "#b84a4a",
                weight: 1,
                fillColor: "#b84a4a",
                fillOpacity: Math.min(0.28, 0.04 + state.wei_pressure * 0.02),
                className: "threat-ring",
              }}
            />
          ) : null}

          {PLACES.map((place) => {
            const isCurrent = place.id === state.current_location;
            const isControlled = controlledSet.has(place.id);
            return (
              <CircleMarker
                key={place.id}
                center={[place.lat, place.lng]}
                radius={isCurrent ? 10 : isControlled ? 8 : 6}
                pathOptions={{
                  color: isCurrent ? "#ffd98b" : isControlled ? "#9ddf85" : "#8a8a8a",
                  weight: isCurrent ? 3 : 2,
                  fillColor: isCurrent ? "#f9b24f" : isControlled ? "#4f9e39" : "#626262",
                  fillOpacity: isCurrent ? 0.85 : isControlled ? 0.62 : 0.28,
                  className: isCurrent
                    ? "place-current-marker"
                    : isControlled
                      ? "place-controlled-marker"
                      : "place-idle-marker",
                }}
              >
                <Tooltip direction="top" permanent={isCurrent} offset={[0, -12]}>
                  {isCurrent ? "当前战区 / Current Front" : place.name}
                </Tooltip>
                <Popup>
                  <strong>{place.name}</strong>
                  <div>当前：{isCurrent ? "是" : "否"}</div>
                  <div>控制：{isControlled ? "已控制" : "未控制"}</div>
                </Popup>
              </CircleMarker>
            );
          })}

          {PLACES.filter((place) => controlledSet.has(place.id)).map((place) => (
            <Marker key={`flag-${place.id}`} position={[place.lat, place.lng]} icon={flagIcon} interactive={false} />
          ))}

          <Marker position={armyPosition} icon={armyIcon} zIndexOffset={1200}>
            <Tooltip direction="top">北伐主力</Tooltip>
          </Marker>
        </MapContainer>

        <FxOverlay map={map} state={state} audioEnabled={audioEnabled} />
      </div>
    </section>
  );
}
