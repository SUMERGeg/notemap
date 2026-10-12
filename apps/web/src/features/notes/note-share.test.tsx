import { afterEach,describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShareCollectionPanel } from './SharePanel';
import { shareApi } from './share-api';
afterEach(()=>vi.unstubAllGlobals());
describe('local note file sharing',()=>{
 it('offers note export with private fields opt-out without network on render',()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const html=renderToStaticMarkup(<ShareCollectionPanel noteId="note" notes={[]} noteCount={1}/>);expect(html).toContain('Поделиться заметкой');expect(html).toContain('Скачать файл подборки');expect(html).not.toContain('Поделиться коллекцией');expect(html).not.toContain('checked=');expect(fetcher).not.toHaveBeenCalled();});
 it('does not contact removed share backend',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(shareApi('/notes/note/shares','POST')).rejects.toThrow('файлами');expect(fetcher).not.toHaveBeenCalled();});
});
