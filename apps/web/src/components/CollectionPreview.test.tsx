import { expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CollectionPreview } from '../features/notes/CollectionPreview';
import type { SharePreview } from '../features/notes/share-api';
it('shows a compact empty collection without loading a map of an unrelated location',()=>{
 const html=renderToStaticMarkup(<CollectionPreview preview={{name:'Тест',author_name:'Автор',items:[]} as unknown as SharePreview}/>);
 expect(html).toContain('Пока нет мест');expect(html).not.toContain('Открываем карту');expect(html).not.toContain('Посмотреть места (0)');
});
