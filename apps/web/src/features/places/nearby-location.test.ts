import { expect, it, vi } from 'vitest';
import { locateNearby } from './nearby-location';
it('не ищет по устаревшему или неточному GPS',async()=>{
  const geo={getCurrentPosition:(success:PositionCallback)=>success({timestamp:Date.now(),coords:{longitude:37,latitude:55,accuracy:1000}} as GeolocationPosition)} as Geolocation;
  await expect(locateNearby(geo,new AbortController().signal)).rejects.toThrow('неточная');
});
it('отменяет ожидание при уходе и игнорирует поздний ответ',async()=>{
  let callback:PositionCallback|undefined;const geo={getCurrentPosition:vi.fn((success:PositionCallback)=>{callback=success;})} as unknown as Geolocation;
  const abort=new AbortController();const pending=locateNearby(geo,abort.signal);abort.abort();
  await expect(pending).rejects.toMatchObject({name:'AbortError'});
  callback!({timestamp:Date.now(),coords:{longitude:37,latitude:55,accuracy:20}} as GeolocationPosition);
});
