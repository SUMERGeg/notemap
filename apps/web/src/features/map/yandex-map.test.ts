import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeMapController, groupPoints } from './yandex-map';
import type { YandexSdk, NativeListeners } from './yandex-js';

afterEach(()=>vi.useRealTimers());
function fixture(){
  let listeners:NativeListeners={};
  const update=vi.fn(),destroy=vi.fn(),removeChild=vi.fn();
  const sdk={
    YMap:class { center=[37.6,55.7];zoom=12;bounds=[[37,56],[38,55]];addChild(){return this;}removeChild=removeChild;update=update;destroy=destroy; },
    YMapDefaultSchemeLayer:class {static defaultProps={source:'scheme'};},
    YMapDefaultFeaturesLayer:class {},
    YMapListener:class {constructor(value:NativeListeners){listeners=value;}},
  } as unknown as YandexSdk;
  const ready=vi.fn(),failed=vi.fn();
  const map=new NativeMapController(sdk,{} as HTMLElement,{longitude:37.6,latitude:55.7,zoom:12},{ready,failed});
  return {map,ready,failed,update,destroy,removeChild,get listeners(){return listeners;}};
}
describe('основная карта Яндекс JS API',()=>{
  it('снимает ожидание только после готовых тайлов и игнорирует события после удаления',()=>{
    vi.useFakeTimers();const f=fixture();
    f.listeners.onStateChanged!({getLayerState:()=>({tilesReady:0})});expect(f.ready).not.toHaveBeenCalled();
    f.listeners.onStateChanged!({getLayerState:()=>({tilesReady:4})});expect(f.ready).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(25000);expect(f.failed).not.toHaveBeenCalled();
    f.map.remove();f.listeners.onStateChanged!({getLayerState:()=>({tilesReady:8})});expect(f.ready).toHaveBeenCalledOnce();expect(f.destroy).toHaveBeenCalledOnce();
  });
  it('завершает зависшую загрузку ошибкой; поздние тайлы восстанавливают карту',()=>{
    vi.useFakeTimers();const f=fixture();vi.advanceTimersByTime(20000);expect(f.failed).toHaveBeenCalledOnce();
    f.listeners.onStateChanged!({getLayerState:()=>({tilesReady:1})});expect(f.ready).toHaveBeenCalledOnce();f.map.remove();
  });
  it('обновляет камеру и отступы одним вызовом без промежуточного бокового сдвига',()=>{
    const f=fixture();f.map.jumpTo({center:[30,60],zoom:30,padding:{top:90,right:10,bottom:200,left:20}});
    expect(f.update).toHaveBeenCalledExactlyOnceWith({margin:[90,10,200,20],location:{center:[30,60],zoom:19,duration:0}});f.map.remove();
  });
  it('группирует 500 совпадающих точек и сохраняет возможность открыть каждую',()=>{
    const points=Array.from({length:500},(_,i)=>({id:String(i),longitude:37.6,latitude:55.7}));
    const groups=groupPoints(points,19);expect(groups).toHaveLength(1);expect(groups[0].points).toHaveLength(500);
    expect(new Set(groups[0].points.map(p=>p.id)).size).toBe(500);
    expect(groupPoints([...points.slice(0,1),{id:'far',longitude:30,latitude:60}],12)).toHaveLength(2);
  });
  it('не воспринимает нажатие на личный маркер как добавление новой точки',()=>{
    const f=fixture(),pick=vi.fn();f.map.on('click',pick);
    f.listeners.onClick!({type:'marker'},{coordinates:[37,55]});expect(pick).not.toHaveBeenCalled();
    f.listeners.onClick!(undefined,{coordinates:[37,55]});expect(pick).toHaveBeenCalledWith({lngLat:{lng:37,lat:55}});f.map.remove();
  });
  it('при открытии коллекции учитывает панель и предел масштаба',()=>{
    const f=fixture();Object.assign(f.map.getContainer(),{clientWidth:600,clientHeight:800});
    f.map.fitBounds([[37.6,55.7],[37.601,55.701]],{maxZoom:15,duration:0,padding:{top:100,right:40,bottom:300,left:40}});
    expect(f.update).toHaveBeenCalledExactlyOnceWith({margin:[100,40,300,40],camera:{azimuth:0},location:{center:expect.any(Array),zoom:15,duration:0}});f.map.remove();
  });
});
