'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

function pinIcon(color = '#c8553d', label?: string) {
  return L.divIcon({
    className: 'pin-marker',
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    html: `<div style="position:relative;width:36px;height:46px">
      <svg viewBox="0 0 36 46" width="36" height="46"><path d="M18 45s15-14.6 15-27A15 15 0 0 0 3 18c0 12.4 15 27 15 27Z" fill="${color}" stroke="#0c0907" stroke-width="2"/><circle cx="18" cy="18" r="6.5" fill="#faf4e9"/></svg>
      ${label ? `<span style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0c0907;color:#f0c879;font:600 11px system-ui;padding:2px 6px;border-radius:6px">${label}</span>` : ''}
    </div>`,
  });
}

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
  }, [map, points]);
  return null;
}

function ClickToMove({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Mapa genérico: un pin arrastrable (selector) o varios pines fijos (panel). */
export default function LeafletMap({
  center,
  zoom = 15,
  draggable,
  onChange,
  points = [],
  className = 'h-64',
}: {
  center: [number, number];
  zoom?: number;
  draggable?: boolean;
  onChange?: (lat: number, lng: number) => void;
  points?: MapPoint[];
  className?: string;
}) {
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m && onChange) {
          const { lat, lng } = m.getLatLng();
          onChange(lat, lng);
        }
      },
    }),
    [onChange],
  );

  return (
    <div className={`relative z-0 overflow-hidden rounded-2xl border border-ink-700 ${className}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {draggable && (
          <>
            <Marker position={center} draggable eventHandlers={handlers} ref={markerRef} icon={pinIcon('#c8553d')} />
            <Recenter center={center} />
            {onChange && <ClickToMove onPick={onChange} />}
          </>
        )}
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={pinIcon(p.color, p.label)} />
        ))}
        {!draggable && points.length >= 2 && <FitBounds points={points} />}
      </MapContainer>
    </div>
  );
}
