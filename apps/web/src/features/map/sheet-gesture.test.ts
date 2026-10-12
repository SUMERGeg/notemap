import { describe, expect, it } from 'vitest';
import { startSheetDrag, moveSheetDrag, finishSheetDrag } from './sheet-gesture';

describe('жест нижней панели',()=>{
  it('следует за пальцем и ограничивает оба края',()=>{
    const drag=startSheetDrag(300,0,200,0);expect(moveSheetDrag(drag,370,100)).toBe(70);expect(moveSheetDrag(drag,700,200)).toBe(200);expect(moveSheetDrag(drag,100,300)).toBe(0);
  });
  it('медленно сворачивается и раскрывается по ближайшему положению',()=>{
    const down=startSheetDrag(0,0,200,0);moveSheetDrag(down,130,500);expect(finishSheetDrag(down,700)).toBe(true);
    const up=startSheetDrag(300,200,200,0);moveSheetDrag(up,160,500);expect(finishSheetDrag(up,700)).toBe(false);
  });
  it('быстрый короткий свайп переключает положение, остановка убирает инерцию',()=>{
    const down=startSheetDrag(0,0,200,0);moveSheetDrag(down,35,30);expect(finishSheetDrag(down,35)).toBe(true);expect(finishSheetDrag(down,300)).toBe(false);
    const up=startSheetDrag(300,200,200,0);moveSheetDrag(up,265,30);expect(finishSheetDrag(up,35)).toBe(false);
  });
  it('не считает касание и небольшое дрожание свайпом',()=>{
    const drag=startSheetDrag(100,0,200,0);moveSheetDrag(drag,103,10);expect(finishSheetDrag(drag,15)).toBeNull();
  });
});
