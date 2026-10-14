import { describe, expect, it, vi } from 'vitest';
import { watchLocation, locationPoint, accuracyRadius } from './live-location';

describe('геопозиция на карте',()=>{
  it('обновляется, приостанавливается в фоне и игнорирует запоздалые callbacks',()=>{
    const callbacks:PositionCallback[]=[];const geo={watchPosition:vi.fn((success:PositionCallback)=>{callbacks.push(success);return callbacks.length;}),clearWatch:vi.fn()} as unknown as Geolocation;
    const visibility=Object.assign(new EventTarget(),{hidden:false});const changed=vi.fn(),failed=vi.fn();
    const stop=watchLocation(geo,{changed,failed},visibility);
    const position={coords:{longitude:37.6,latitude:55.7,accuracy:15}} as GeolocationPosition;
    callbacks[0](position);expect(changed).toHaveBeenCalledWith({longitude:37.6,latitude:55.7,accuracy:15});
    visibility.hidden=true;visibility.dispatchEvent(new Event('visibilitychange'));expect(geo.clearWatch).toHaveBeenCalledWith(1);
    callbacks[0](position);expect(changed).toHaveBeenCalledOnce();
    visibility.hidden=false;visibility.dispatchEvent(new Event('visibilitychange'));expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    stop();callbacks[1](position);expect(changed).toHaveBeenCalledOnce();
    expect(geo.clearWatch).toHaveBeenCalledWith(2);
  });
  it('отклоняет неправильные координаты и ограничивает размер ореола',()=>{
    expect(locationPoint({longitude:NaN,latitude:55,accuracy:15} as GeolocationCoordinates)).toBeNull();
    expect(locationPoint({longitude:37,latitude:95,accuracy:15} as GeolocationCoordinates)).toBeNull();
    expect(locationPoint({longitude:37,latitude:55,accuracy:-1} as GeolocationCoordinates)).toBeNull();
    expect(accuracyRadius(30,55,16)).toBeGreaterThan(accuracyRadius(30,55,12));
    expect(accuracyRadius(100000,55,18)).toBe(150);
  });
  it('не запускает GPS в фоне и останавливает watcher при отказе в разрешении',()=>{
    let rejected:PositionErrorCallback|undefined;
    const geo={watchPosition:vi.fn((_success:PositionCallback,error:PositionErrorCallback)=>{rejected=error;return 7;}),clearWatch:vi.fn()} as unknown as Geolocation;
    const visibility=Object.assign(new EventTarget(),{hidden:true});const failed=vi.fn();
    const stop=watchLocation(geo,{changed:vi.fn(),failed},visibility);
    expect(geo.watchPosition).not.toHaveBeenCalled();
    visibility.hidden=false;visibility.dispatchEvent(new Event('visibilitychange'));
    rejected!({code:1} as GeolocationPositionError);
    expect(failed).toHaveBeenCalledWith(expect.any(String),true);expect(geo.clearWatch).toHaveBeenCalledWith(7);stop();
  });
});
