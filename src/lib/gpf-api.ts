/**
 * gpf-api.ts
 * Fonctions utilitaires pour les APIs REST de la Géoplateforme IGN
 * Toutes les APIs utilisées ici sont publiques (sans clé)
 */

import { GPF_ENDPOINTS } from './ign-layers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  label: string;
  type: string;
  x: number; // longitude WGS84
  y: number; // latitude WGS84
  city?: string;
  postcode?: string;
  context?: string;
}

export interface ElevationResult {
  lon: number;
  lat: number;
  z: number;
  acc: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface RouteResult {
  distance: number;     // mètres
  duration: number;     // secondes
  geometry: GeoJSON.LineString;
  legs: RouteStep[];
}

// ─── Géocodage ────────────────────────────────────────────────────────────────

/**
 * Géocode une adresse textuelle vers des coordonnées WGS84
 * Doc : https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url = new URL(`${GPF_ENDPOINTS.GEOCODAGE}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('returntruegeometry', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Géocodage échoué: ${res.status}`);

  const data = await res.json();

  return (data.features ?? []).map((f: any) => ({
    label: f.properties.label ?? f.properties.name,
    type: f.properties.type,
    x: f.geometry.coordinates[0],
    y: f.geometry.coordinates[1],
    city: f.properties.city,
    postcode: f.properties.postcode,
    context: f.properties.context,
  }));
}

/**
 * Géocodage inverse : coordonnées → adresse
 */
export async function reverseGeocode(lon: number, lat: number): Promise<GeocodeResult | null> {
  const url = new URL(`${GPF_ENDPOINTS.GEOCODAGE}/reverse`);
  url.searchParams.set('lon', lon.toFixed(6));
  url.searchParams.set('lat', lat.toFixed(6));

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return null;

  return {
    label: f.properties.label ?? '',
    type: f.properties.type,
    x: f.geometry.coordinates[0],
    y: f.geometry.coordinates[1],
    city: f.properties.city,
    postcode: f.properties.postcode,
  };
}

// ─── Altimétrie ───────────────────────────────────────────────────────────────

/**
 * Récupère l'altitude d'un point (ou liste de points)
 * Doc : https://geoservices.ign.fr/documentation/services/services-geoplateforme/altimetrie
 */
export async function getElevation(
  points: { lon: number; lat: number }[]
): Promise<ElevationResult[]> {
  const lonlat = points.map((p) => `${p.lon},${p.lat}`).join('|');
  const url = new URL(`${GPF_ENDPOINTS.ALTIMETRIE}/elevationLine`);
  url.searchParams.set('lon', points.map((p) => p.lon).join('|'));
  url.searchParams.set('lat', points.map((p) => p.lat).join('|'));
  url.searchParams.set('resource', 'ign_rge_alti_wld');
  url.searchParams.set('delimiter', '|');
  url.searchParams.set('indent', 'false');
  url.searchParams.set('measures', 'false');
  url.searchParams.set('zonly', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Altimétrie échouée: ${res.status}`);

  const data = await res.json();

  return (data.elevations ?? []).map((e: any) => ({
    lon: e.lon,
    lat: e.lat,
    z: e.z,
    acc: e.acc ?? 0,
  }));
}

// ─── Itinéraire ───────────────────────────────────────────────────────────────

/**
 * Calcule un itinéraire entre deux points
 * Doc : https://geoservices.ign.fr/documentation/services/services-geoplateforme/itineraire
 */
export async function calculateRoute(
  start: { lon: number; lat: number },
  end: { lon: number; lat: number },
  profile: 'car' | 'pedestrian' = 'car'
): Promise<RouteResult> {
  const url = new URL(`${GPF_ENDPOINTS.ITINERAIRE}/itineraire`);
  url.searchParams.set('resource', 'bdtopo-osrm');
  url.searchParams.set('profile', profile);
  url.searchParams.set('optimization', 'fastest');
  url.searchParams.set('start', `${start.lon},${start.lat}`);
  url.searchParams.set('end', `${end.lon},${end.lat}`);
  url.searchParams.set('geometryFormat', 'geojson');
  url.searchParams.set('getSteps', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Itinéraire échoué: ${res.status}`);

  const data = await res.json();

  return {
    distance: data.distance ?? 0,
    duration: data.duration ?? 0,
    geometry: data.geometry,
    legs: (data.portions ?? []).flatMap((p: any) =>
      (p.steps ?? []).map((s: any) => ({
        instruction: s.instruction?.text ?? '',
        distance: s.distance ?? 0,
        duration: s.duration ?? 0,
      }))
    ),
  };
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
