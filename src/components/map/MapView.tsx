'use client';

/**
 * MapView.tsx
 * Composant carte OpenLayers + extensions IGN
 * — Mesure longueur / surface géodésique
 * — Mode paysagiste : dessin par élément du catalogue
 * — Zoom max 22 (≈ 1/140 · lat France)
 * - TypeScript prend encore Map pour la classe OpenLayers (pas générique), pas pour Map<K,V>. Il suffit de ne plus utiliser Map<>
 */

import { useEffect, useRef } from 'react';
import type { IGNLayer } from '@/lib/ign-layers';
import { GPF_ENDPOINTS } from '@/lib/ign-layers';
import type { MeasureMode, MeasureResult } from '@/lib/measure';
import {
  formatLength,
  formatArea,
  getLengthMeters,
  getAreaSqMeters,
} from '@/lib/measure';
import type { ElementPaysagiste, LigneMetrage } from '@/lib/paysagiste';
import { generateId } from '@/lib/paysagiste';

import type { LineString as GeoJSONLineString } from 'geojson';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import { fromLonLat, toLonLat } from 'ol/proj';
import { ScaleLine, FullScreen, Zoom } from 'ol/control';
import { defaults as defaultInteractions, Draw, Snap } from 'ol/interaction';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import GeoJSON from 'ol/format/GeoJSON';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import type { DrawEvent } from 'ol/interaction/Draw';
import type MapBrowserEvent from 'ol/MapBrowserEvent';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapCoords {
  lon: number;
  lat: number;
  zoom: number;
}

export interface MapViewProps {
  layers: IGNLayer[];
  opacities: Record<string, number>;
  onCoordsChange?: (coords: MapCoords) => void;
  onMapClick?: (lon: number, lat: number) => void;
  onMapReady?: (map: OlMap) => void;
  routeGeometry?: GeoJSONLineString | null;
  markerCoords?: [number, number] | null;
  // Mesure simple
  measureMode: MeasureMode;
  onMeasureResult?: (result: MeasureResult | null) => void;
  // Mode paysagiste
  activeElement: ElementPaysagiste | null;
  onPaysagisteFeature?: (ligne: LigneMetrage, featureId: string) => void;
  paysagisteFeatureToDelete?: string | null;
}

// ─── Styles mesure ────────────────────────────────────────────────────────────

const STYLE_LENGTH = new Style({
  stroke: new Stroke({ color: '#f59e0b', width: 2.5, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#f59e0b' }),
    stroke: new Stroke({ color: 'white', width: 1.5 }),
  }),
});

const STYLE_AREA = new Style({
  stroke: new Stroke({ color: '#8b5cf6', width: 2.5, lineDash: [6, 4] }),
  fill: new Fill({ color: 'rgba(139,92,246,0.12)' }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#8b5cf6' }),
    stroke: new Stroke({ color: 'white', width: 1.5 }),
  }),
});

function measureStyleFn(mode: MeasureMode) {
  return (feature: Feature) => {
    const geom = feature.getGeometry();
    if (!geom) return [];
    const base = mode === 'length' ? STYLE_LENGTH : STYLE_AREA;
    const label = mode === 'length' ? formatLength(geom) : formatArea(geom);
    return [
      base,
      new Style({
        text: new Text({
          text: label,
          font: 'bold 12px monospace',
          fill: new Fill({
            color: mode === 'length' ? '#f59e0b' : '#8b5cf6',
          }),
          stroke: new Stroke({
            color: 'rgba(15,17,23,0.85)',
            width: 4,
          }),
          offsetY: -14,
        }),
      }),
    ];
  };
}

// ─── Styles paysagiste (dynamique par couleur d'élément) ──────────────────────

function makePaysagisteStyle(
  color: string,
  fillAlpha = 0.2,
  strokeDash?: number[],
) {
  const rgb = hexToRgb(color);
  return new Style({
    stroke: new Stroke({ color, width: 2.5, lineDash: strokeDash }),
    fill: new Fill({ color: `rgba(${rgb},${fillAlpha})` }),
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: 'white', width: 2 }),
    }),
  });
}

function makePaysagisteDrawStyle(color: string) {
  const rgb = hexToRgb(color);
  return new Style({
    stroke: new Stroke({ color, width: 2, lineDash: [5, 4] }),
    fill: new Fill({ color: `rgba(${rgb},0.1)` }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: 'white', width: 1.5 }),
    }),
  });
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MapView({
  layers,
  opacities,
  onCoordsChange,
  onMapClick,
  onMapReady,
  routeGeometry,
  markerCoords,
  measureMode,
  onMeasureResult,
  activeElement,
  onPaysagisteFeature,
  paysagisteFeatureToDelete,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<OlMap | null>(null);

  const tileLayers = useRef<Map<string, TileLayer> | null>(null);
  const markerLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const routeLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const measureLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const paysagisteLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const drawRef = useRef<Draw | null>(null);
  const snapRef = useRef<Snap | null>(null);

  const measureModeRef = useRef<MeasureMode>('none');
  const activeElementRef = useRef<ElementPaysagiste | null>(null);

  // Map featureId → Feature pour suppression
  const featureMapRef = useRef<Map<string, Feature>>(new Map());

  // ── Init carte ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = new OlMap({
      target: mapRef.current,
      view: new View({
        center: fromLonLat([2.3488, 48.8534]),
        zoom: 12,
        minZoom: 2,
        maxZoom: 22,
      }),
      controls: [
        new Zoom(),
        new ScaleLine({
          units: 'metric',
          bar: true,
          steps: 4,
          text: true,
          minWidth: 120,
        }),
        new FullScreen(),
      ],
      interactions: defaultInteractions({
        altShiftDragRotate: false,
        pinchRotate: false,
      }),
    });

    mapInstance.current = map;
    tileLayers.current = new Map<string, TileLayer>();

    loadAllWMTSLayers(map, layers, tileLayers.current).then(() =>
      onMapReady?.(map),
    );

    // Couche marqueurs géocodage
    const markerSrc = new VectorSource();
    const markerLayer = new VectorLayer({
      source: markerSrc,
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#3b82f6' }),
          stroke: new Stroke({ color: 'white', width: 2 }),
        }),
      }),
      zIndex: 200,
    });
    map.addLayer(markerLayer);
    markerLayerRef.current = markerLayer;

    // Couche itinéraire
    const routeSrc = new VectorSource();
    const routeLayer = new VectorLayer({
      source: routeSrc,
      style: new Style({
        stroke: new Stroke({
          color: '#3b82f6',
          width: 4,
          lineDash: [8, 4],
        }),
      }),
      zIndex: 90,
    });
    map.addLayer(routeLayer);
    routeLayerRef.current = routeLayer;

    // Couche mesures simples
    const measureSrc = new VectorSource();
    const measureLayer = new VectorLayer({
      source: measureSrc,
      zIndex: 110,
    });
    map.addLayer(measureLayer);
    measureLayerRef.current = measureLayer;

    // Couche paysagiste
    const paysSrc = new VectorSource();
    const paysLayer = new VectorLayer({
      source: paysSrc,
      zIndex: 105,
    });
    map.addLayer(paysLayer);
    paysagisteLayerRef.current = paysLayer;

    // Events
    map.on('pointermove', (e: MapBrowserEvent) => {
      const [lon, lat] = toLonLat(e.coordinate);
      onCoordsChange?.({
        lon,
        lat,
        zoom: map.getView().getZoom() ?? 0,
      });
    });

    map.on('click', (e: MapBrowserEvent) => {
      if (measureModeRef.current !== 'none' || activeElementRef.current !== null)
        return;
      const [lon, lat] = toLonLat(e.coordinate);
      onMapClick?.(lon, lat);
    });

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gestion mode mesure ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    const measureLayer = measureLayerRef.current;
    if (!map || !measureLayer) return;

    measureModeRef.current = measureMode;
    removeDraw(map);

    if (measureMode === 'none') {
      if (mapRef.current) mapRef.current.style.cursor = '';
      return;
    }

    if (mapRef.current) mapRef.current.style.cursor = 'crosshair';

    const src = measureLayer.getSource()!;
    const draw = new Draw({
      source: src,
      type: measureMode === 'length' ? 'LineString' : 'Polygon',
      style: measureStyleFn(measureMode) as any,
    });

    draw.on('drawstart', (e) => {
      e.feature.getGeometry()!.on('change', () => {
        const g = e.feature.getGeometry()!;
        onMeasureResult?.({
          mode: measureMode,
          value:
            measureMode === 'length' ? formatLength(g) : formatArea(g),
          rawMeters: getLengthMeters(g),
          rawSqMeters:
            measureMode === 'area'
              ? getAreaSqMeters(g)
              : undefined,
          points: 0,
        });
      });
    });

    draw.on('drawend', (e: DrawEvent) => {
      const g = e.feature.getGeometry()!;
      e.feature.setStyle(
        measureMode === 'length' ? STYLE_LENGTH : STYLE_AREA,
      );
      onMeasureResult?.({
        mode: measureMode,
        value:
          measureMode === 'length' ? formatLength(g) : formatArea(g),
        rawMeters: getLengthMeters(g),
        rawSqMeters:
          measureMode === 'area'
            ? getAreaSqMeters(g)
            : undefined,
        points: 0,
      });
    });

    map.addInteraction(draw);
    drawRef.current = draw;

    const snap = new Snap({ source: src });
    map.addInteraction(snap);
    snapRef.current = snap;
  }, [measureMode, onMeasureResult]);

  // ── Gestion mode paysagiste ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    const paysLayer = paysagisteLayerRef.current;
    if (!map || !paysLayer) return;

    activeElementRef.current = activeElement;
    removeDraw(map);

    if (!activeElement) {
      if (mapRef.current) mapRef.current.style.cursor = '';
      return;
    }

    if (mapRef.current) mapRef.current.style.cursor = 'crosshair';

    const src = paysLayer.getSource()!;
    const drawStyle = makePaysagisteDrawStyle(activeElement.color);

    const draw = new Draw({
      source: src,
      type: activeElement.geomType,
      style: drawStyle,
    });

    draw.on('drawend', (e: DrawEvent) => {
      const geom = e.feature.getGeometry()!;
      const featureId = generateId();
      e.feature.setId(featureId);

      // Style final
      const finalStyle = makePaysagisteStyle(
        activeElement.color,
        activeElement.fillAlpha ?? 0.2,
        activeElement.strokeDash,
      );

      const styles: Style[] = [finalStyle];

      const labelText =
        activeElement.unite === 'u'
          ? activeElement.icone
          : activeElement.geomType === 'LineString'
          ? `${activeElement.icone} ${formatLength(geom)}`
          : `${activeElement.icone} ${formatArea(geom)}`;

      styles.push(
        new Style({
          text: new Text({
            text: labelText,
            font: '11px sans-serif',
            fill: new Fill({ color: activeElement.color }),
            stroke: new Stroke({
              color: 'rgba(15,17,23,0.9)',
              width: 3,
            }),
            overflow: true,
          }),
        }),
      );

      e.feature.setStyle(styles);

      // Calcul quantité
      let quantite = 1;
      if (activeElement.geomType === 'LineString') {
        quantite = getLengthMeters(geom);
      } else if (activeElement.geomType === 'Polygon') {
        quantite = getAreaSqMeters(geom);
      }

      featureMapRef.current.set(featureId, e.feature);

      const ligne: LigneMetrage = {
        id: generateId(),
        elementId: activeElement.id,
        nom: activeElement.nom,
        categorie: activeElement.categorie,
        unite: activeElement.unite,
        quantite,
        geomType: activeElement.geomType,
        color: activeElement.color,
        createdAt: Date.now(),
        featureId,
      };

      onPaysagisteFeature?.(ligne, featureId);
    });

    map.addInteraction(draw);
    drawRef.current = draw;

    if (activeElement.geomType !== 'Point') {
      const snap = new Snap({ source: src });
      map.addInteraction(snap);
      snapRef.current = snap;
    }
  }, [activeElement, onPaysagisteFeature]);

  // ── Suppression d'une feature paysagiste ────────────────────────────────────
  useEffect(() => {
    if (!paysagisteFeatureToDelete || !paysagisteLayerRef.current) return;
    const src = paysagisteLayerRef.current.getSource()!;
    const feature = featureMapRef.current.get(paysagisteFeatureToDelete);
    if (feature) {
      src.removeFeature(feature);
      featureMapRef.current.delete(paysagisteFeatureToDelete);
    }
  }, [paysagisteFeatureToDelete]);

  // ── Couches WMTS visibilité ─────────────────────────────────────────────────
  useEffect(() => {
    if (!tileLayers.current) return;
    layers.forEach((l) => {
      const tl = tileLayers.current!.get(l.id);
      if (tl) tl.setVisible(l.defaultVisible);
    });
  }, [layers]);

  // ── Opacité ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tileLayers.current) return;
    Object.entries(opacities).forEach(([id, op]) => {
      const tl = tileLayers.current!.get(id);
      if (tl) tl.setOpacity(op);
    });
  }, [opacities]);

  // ── Itinéraire ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!routeLayerRef.current) return;
    const src = routeLayerRef.current.getSource()!;
    src.clear();
    if (routeGeometry) {
      const feature = new GeoJSON().readFeature(
        {
          type: 'Feature',
          geometry: routeGeometry,
          properties: {},
        },
        {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        },
      );
      src.addFeature(feature as Feature);
      
	const extent = src.getExtent();
		if (extent) {
	  mapInstance.current?.getView().fit(extent, {padding: [60, 60, 60, 60],duration: 800 });
//	}

	  // mapInstance.current
        // ?.getView()
        // .fit(src.getExtent(), {
          // padding: [60, 60, 60, 60],
          // duration: 800,
//      });
    }


    }
  }, [routeGeometry]);  

  // ── Marqueur ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!markerLayerRef.current) return;
    const src = markerLayerRef.current.getSource()!;
    src.clear();
    if (markerCoords) {
      src.addFeature(
        new Feature({
          geometry: new Point(fromLonLat(markerCoords)),
        }),
      );
      mapInstance.current?.getView().animate({
        center: fromLonLat(markerCoords),
        zoom: 15,
        duration: 600,
      });
    }
  }, [markerCoords]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

function removeDraw(map: OlMap) {
  const toRemove = map
    .getInteractions()
    .getArray()
    .filter((i) => i instanceof Draw || i instanceof Snap);
  toRemove.forEach((i) => map.removeInteraction(i));
}

async function loadAllWMTSLayers(
  map: OlMap,
  layers: IGNLayer[],
  tileLayersMap: Map<string, TileLayer>,
): Promise<void> {
  try {
    const res = await fetch(
      `${GPF_ENDPOINTS.WMTS}?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities`,
    );
    const text = await res.text();
    const caps = new WMTSCapabilities().read(text);

    for (const layerDef of layers) {
      try {
        const options = optionsFromCapabilities(caps, {
          layer: layerDef.id,
          matrixSet: 'PM',
          style: 'normal',
        });
        if (!options) {
          console.warn(`Couche IGN introuvable: ${layerDef.id}`);
          continue;
        }
        const tl = new TileLayer({
          source: new WMTS(options),
          visible: layerDef.defaultVisible,
          opacity: layerDef.defaultOpacity,
          zIndex: layerDef.defaultVisible ? 1 : 0,
          properties: { id: layerDef.id },
        });
        map.addLayer(tl);
        tileLayersMap.set(layerDef.id, tl);
      } catch (e: unknown) {
        console.warn(`Couche ${layerDef.id}:`, e);
      }
    }
  } catch (e: unknown) {
    console.error('GetCapabilities WMTS:', e);
    for (const layerDef of layers) {
      const tl = new TileLayer({
        source: new WMTS({
          url: `${GPF_ENDPOINTS.WMTS}?`,
          layer: layerDef.id,
          matrixSet: 'PM',
          format: 'image/png',
          projection: 'EPSG:3857',
          style: 'normal',
          tileGrid: undefined as any,
          requestEncoding: 'KVP',
        }),
        visible: layerDef.defaultVisible,
        opacity: layerDef.defaultOpacity,
        properties: { id: layerDef.id },
      });
      map.addLayer(tl);
      tileLayersMap.set(layerDef.id, tl);
    }
  }
}