'use client';

import dynamic from 'next/dynamic';

/** Leaflet usa `window`: se carga solo en el navegador. */
const Map = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-2xl bg-ink-800 animate-pulse grid place-items-center text-sand-500 text-sm">Cargando mapa…</div>,
});

export default Map;
export type { MapPoint } from './LeafletMap';

/** Distancia aproximada en km (fórmula de Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
