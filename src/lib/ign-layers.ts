/**
 * Catalogue des couches IGN/Géoplateforme disponibles sans clé API
 * Source : https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetCapabilities
 */

export interface IGNLayer {
  id: string;
  name: string;
  description: string;
  color: string;
  type: 'WMTS' | 'WMS' | 'WFS' | 'TMS';
  format?: string;
  apikey?: string;
  defaultVisible: boolean;
  defaultOpacity: number;
}

export const IGN_LAYERS: IGNLayer[] = [
  {
    id: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
    name: 'Plan IGN v2',
    description: 'Fond cartographique référence',
    color: '#3b82f6',
    type: 'WMTS',
    apikey: 'cartes',
    defaultVisible: true,
    defaultOpacity: 1,
  },
  {
    id: 'ORTHOIMAGERY.ORTHOPHOTOS',
    name: 'Orthophotos',
    description: 'Imagerie aérienne HD',
    color: '#22c55e',
    type: 'WMTS',
    apikey: 'ortho',
    defaultVisible: false,
    defaultOpacity: 0.9,
  },
  {
    id: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
    name: 'Parcellaire',
    description: 'Parcelles cadastrales PCI',
    color: '#f59e0b',
    type: 'WMTS',
    apikey: 'parcellaire',
    defaultVisible: false,
    defaultOpacity: 0.7,
  },
  {
    id: 'ELEVATION.SLOPES',
    name: 'Pentes',
    description: 'Carte des pentes du terrain',
    color: '#ef4444',
    type: 'WMTS',
    apikey: 'essentiels',
    defaultVisible: false,
    defaultOpacity: 0.6,
  },
  {
    id: 'LANDCOVER.HR_IMPERVIOUSNESS',
    name: 'Imperméabilité',
    description: 'Taux imperméabilisation sols',
    color: '#8b5cf6',
    type: 'WMTS',
    apikey: 'essentiels',
    defaultVisible: false,
    defaultOpacity: 0.6,
  },
];

/**
 * Endpoints publics Géoplateforme (sans clé)
 */
export const GPF_ENDPOINTS = {
  WMTS: 'https://data.geopf.fr/wmts',
  WMS: 'https://data.geopf.fr/wms/r',
  WFS: 'https://data.geopf.fr/wfs',
  GEOCODAGE: 'https://data.geopf.fr/geocodage',
  ALTIMETRIE: 'https://data.geopf.fr/altimetrie/rest',
  ITINERAIRE: 'https://data.geopf.fr/navigation',
  ISOCHRONE: 'https://data.geopf.fr/navigation',
};
