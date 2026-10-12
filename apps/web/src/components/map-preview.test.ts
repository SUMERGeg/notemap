import { describe, expect, it } from 'vitest';
import { mapTilePosition, starsForRating } from './map-preview';

describe('карточки реальных мест', () => {
  it('сохраняет десятибалльную оценку при отображении пяти звёзд', () => {
    expect(starsForRating(9)).toEqual([1, 1, 1, 1, .5]);
    expect(starsForRating(null)).toEqual([0, 0, 0, 0, 0]);
    expect(starsForRating(1)).toEqual([.5, 0, 0, 0, 0]);
  });
  it('центрирует точку независимо от положения внутри тайла', () => {
    const origin = mapTilePosition(0, 0, 2);
    expect(origin).toEqual({ x: 2, y: 2, offsetX: 0, offsetY: 0, zoom: 2 });
    const edge = mapTilePosition(180, 90, 3);
    expect(edge.x).toBe(0);
    expect(edge.y).toBeGreaterThanOrEqual(0);
    expect(edge.y).toBeLessThan(8);
    expect(Number.isFinite(edge.offsetY)).toBe(true);
  });
});
