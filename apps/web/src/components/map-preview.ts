export function starsForRating(rating: number | null) {
  const value = Math.max(0, Math.min(10, rating ?? 0)) / 2;
  return Array.from({ length: 5 }, (_, index) => Math.max(0, Math.min(1, value - index)));
}

export function mapTilePosition(longitude: number, latitude: number, zoom = 15) {
  const count = 2 ** zoom;
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180;
  const worldX = (lon + 180) / 360 * count;
  const worldY = Math.max(0, Math.min(count - Number.EPSILON * count, (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * count));
  return { x: Math.floor(worldX), y: Math.floor(worldY), offsetX: (worldX % 1) * 256, offsetY: (worldY % 1) * 256, zoom };
}
