export type Viewport = { longitude: number; latitude: number; zoom: number };
export const VIEWPORT_KEY = 'notemap.viewport.v1';
export const DEFAULT_VIEWPORT: Viewport = { longitude: 37.6173, latitude: 55.7558, zoom: 12 };

export function validCoordinates(longitude: unknown, latitude: unknown): boolean {
  return typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

export function readViewport(raw: string | null): Viewport {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value && validCoordinates(value.longitude, value.latitude)
      && typeof value.zoom === 'number' && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 18) {
      return { longitude: value.longitude, latitude: value.latitude, zoom: value.zoom };
    }
  } catch { /* Storage must not prevent opening the map. */ }
  return { ...DEFAULT_VIEWPORT };
}
