import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RefreshDiffPanel } from './RefreshDiffPanel';
import type { RefreshDiff } from './import-api';

describe('manual refresh preview',()=>{
  it('shows real counts, field removal, private-note warning, cancellation and escaped shared text',()=>{
    const before={origin_note_id:'note',category:'food',place:{title:'<script>alert(1)</script>',latitude:55,longitude:37,origin:'custom'},text:'<img onerror=alert(1)>',rating:8};
    const after={origin_note_id:'note',category:'food',place:before.place};
    const diff:RefreshDiff={current_version:1,target_version:2,metadata_before:{name:'Old',author_name:'Author',description:null},metadata_after:{name:'New',author_name:'Author',description:null},added:[],removed:[],changed:[{before,after}],diff_token:'secret-proof',expires_at:'2026-10-12T00:00:00Z'};
    const html=renderToStaticMarkup(<RefreshDiffPanel diff={diff} busy={false} onConfirm={()=>{}} onCancel={()=>{}}/>);
    expect(html).toContain('1 изменены');
    expect(html).toContain('Не передан');
    expect(html).toContain('Твои личные заметки, фото и оценки сохранятся');
    expect(html).toContain('Оставить текущую версию');
    expect(html).toContain('Подтвердить обновление до версии 2');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('secret-proof');
  });
});
