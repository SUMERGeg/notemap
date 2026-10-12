import { describe, expect, it, vi } from 'vitest';
import { createComparisonMetrics } from './comparison-metrics';

describe('измерение сравнительной карты',()=>{
  it('замеряет только первое отображение и сохраняет ошибки отдельных тайлов',()=>{
    let clock=100;const changed=vi.fn();const metrics=createComparisonMetrics(changed,()=>clock);
    metrics.tileLoaded();metrics.tileFailed();clock=375;metrics.rendered();
    expect(changed).toHaveBeenLastCalledWith({firstTileMs:275,tiles:1,errors:1});
    clock=500;metrics.tileLoaded();metrics.rendered();
    expect(changed).toHaveBeenLastCalledWith({firstTileMs:275,tiles:2,errors:1});
  });
  it('не выдаёт время пустого кадра и не обновляет экран после ухода',()=>{
    const changed=vi.fn();const metrics=createComparisonMetrics(changed,()=>10);
    metrics.rendered();expect(changed).not.toHaveBeenCalled();
    metrics.dispose();metrics.tileLoaded();metrics.tileFailed();metrics.rendered();
    expect(changed).not.toHaveBeenCalled();
  });
});
