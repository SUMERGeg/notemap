import { afterEach, expect, it, vi } from 'vitest';
import { applyPwaUpdate } from './pwa';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('перезагружает приложение только после перехода на новый worker',async()=>{
  const postMessage=vi.fn(),reload=vi.fn();
  const serviceWorker=Object.assign(new EventTarget(),{getRegistration:vi.fn(async()=>({waiting:{postMessage}}))});
  vi.stubGlobal('navigator',{serviceWorker});vi.stubGlobal('location',{reload});
  const updating=applyPwaUpdate();await Promise.resolve();
  expect(postMessage).toHaveBeenCalledWith({type:'NOTEMAP_ACTIVATE_UPDATE'});expect(reload).not.toHaveBeenCalled();
  serviceWorker.dispatchEvent(new Event('controllerchange'));await updating;
  expect(reload).toHaveBeenCalledOnce();
  serviceWorker.dispatchEvent(new Event('controllerchange'));expect(reload).toHaveBeenCalledOnce();
});
it('при отсутствии готовой версии не перезагружает текущую',async()=>{
  const reload=vi.fn();vi.stubGlobal('navigator',{serviceWorker:{getRegistration:async()=>({waiting:null})}});vi.stubGlobal('location',{reload});
  await expect(applyPwaUpdate()).rejects.toThrow('ещё не загружена');expect(reload).not.toHaveBeenCalled();
});
