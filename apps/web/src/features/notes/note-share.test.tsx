import { afterEach,describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShareCollectionPanel } from './SharePanel';
import { shareApi } from './share-api';
afterEach(()=>vi.unstubAllGlobals());
describe('note link sharing',()=>{
 it('offers link sharing with private fields opt-out without network on render',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const html=renderToStaticMarkup(<ShareCollectionPanel noteId="note" notes={[]} noteCount={1}/>);
  expect(html).toContain('Поделиться местом');expect(html).toContain('Создать ссылку');
  expect(html).not.toContain('Скачать файл');expect(html).not.toContain('type="file"');
  expect(html.match(/role="switch"\/?>/g)).toHaveLength(3);
  expect(html.match(/role="switch" checked=""/g)).toHaveLength(1);
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not contact removed share backend',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(shareApi('/notes/note/shares','POST')).rejects.toThrow('файлами');expect(fetcher).not.toHaveBeenCalled();});
});
